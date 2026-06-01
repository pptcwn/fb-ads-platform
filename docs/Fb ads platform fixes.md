# 🛠️ FB Ads Platform — สิ่งที่ต้องแก้

> สรุปจากการรีวิวโค้ดจริงใน repo `pptcwn/fb-ads-platform`
> เรียงตามความเร่งด่วน (P0 = ทำก่อน)

---

## ✅ ของที่ทำได้ดีอยู่แล้ว (ไม่ต้องแตะ)

- Token encryption — AES-256-GCM + random IV + auth tag ผ่าน `createCipheriv` ถูกต้องตามมาตรฐาน (`common/encryption.util.ts`)
- Observability ครบ — `prom-client` + `prometheus.yml` + Grafana
- โครงสร้าง monorepo / module แยก concern สะอาด
- Rules scheduler แยก error ราย rule (ตัวเดียวล้มไม่ลามทั้งชุด)
- Realtime ผ่าน `socket.io`

---

## 🔴 P0 — Graph API Version

**ปัญหา:** version hardcode กระจาย 8 จุด และ **ไม่ตรงกัน**

| ตำแหน่ง | version | สถานะ |
|---|---|---|
| `facebook.service.ts`, `sync.service.ts`, `insights.service.ts`, `creatives.service.ts`, `auto-sync.service.ts` | `v20.0` | deprecate **24 ก.ย. 2026** |
| `packages/shared/src/constants/facebook.ts` | `v18.0` | **ตายไปแล้ว** |
| `packages/facebook-sdk-wrapper/src/client.ts` | `v18.0` | **ตายไปแล้ว** |

**Dead abstraction (ติดตั้งแต่ไม่ได้ใช้):**
- `facebook-nodejs-business-sdk@20` — อยู่ใน deps แต่ service เรียก axios ตรง
- `facebook-sdk-wrapper` — package เขียนเองแต่ไม่ถูก import

**ต้องทำ:**
- [ ] ย้าย version ไปเป็น env เดียว เช่น `FB_API_VERSION` แล้ว inject เข้าทุก service
- [ ] อัปเป็น `v24.0` ขึ้นไป
- [ ] ลบ / รวม dead abstraction (เลือกใช้ official SDK **หรือ** wrapper อย่างใดอย่างหนึ่ง)
- [ ] เช็คของที่เลย deadline แล้ว: webhooks mTLS → Meta CA (31 มี.ค. 2026), Advantage+ Shopping/App ผ่าน MAPI (19 พ.ค. 2026)

---

## 🔴 P0 — Redis & BullMQ ติดตั้งแต่ไม่ได้ใช้

**ปัญหา:**
- docker-compose รัน Redis + ตั้ง `REDIS_URL` + มี `bullmq` ใน deps
- แต่ **ไม่มี import redis/bullmq/cache แม้แต่บรรทัดเดียว** ใน `apps/api/src`
- → "Cache: Redis" ยังไม่เกิดจริง และ cron 7 ตัวรันบน `@nestjs/schedule` ล้วน **ไม่มี distributed lock**

**ความเสี่ยง:** พอ scale API เป็น 2+ instance → cron ยิงซ้อน → **ปรับงบซ้ำ / pause ซ้ำ = เสียเงินจริง**

Cron ที่กระทบ: `schedules` (ทุกนาที), `rules` + `alerts` (5 นาที), `sync` (15 นาที), `budget` + `insights` (รายชั่วโมง), `warmup` (รายวัน)

**ต้องทำ:**
- [ ] ย้าย cron ทั้งหมดไป BullMQ repeatable jobs (เครื่องมืออยู่ใน package.json แล้ว)
- [ ] ได้ distributed lock + retry + backoff + rate-limit ของ FB ในที่เดียว
- [ ] เริ่มจากตัวที่กระทบเงินก่อน: `budget` → `rules` → `schedules`

---

## 🟠 P1 — ไม่มี Test เลย

**ปัญหา:** 0 ไฟล์ `.spec` / `.test` ทั้ง repo สำหรับระบบที่สั่งจ่ายเงินอัตโนมัติ

**ต้องทำ (เริ่มจากจุดที่พังแล้วเสียเงินทันที):**
- [ ] Unit test ครอบ rules engine — เงื่อนไข trigger (CTR/CPC/SPEND/IMPRESSIONS)
- [ ] Unit test ครอบ budget logic — การคำนวณ ADJUST_PERCENT / SET_BUDGET
- [ ] (ตามมา) e2e ของ flow OAuth → sync → campaign CRUD

---

## 🟠 P1 — Budget Two-Stage ยังไม่มี Consistency Guarantee

**ปัญหา:** `budget.service.ts` เรียก FB ก่อน แล้วค่อย Prisma — ถ้าขั้นใดขั้นหนึ่งล้ม ข้อมูลจะ drift

**ต้องทำ:**
- [ ] ทำ operation ให้ idempotent
- [ ] เพิ่ม reconciliation job โดยถือ **FB = source of truth**

---

## 🟡 P2 — Hardening เพิ่มเติม

- [ ] Rate-limit handling: อ่าน header `X-Business-Use-Case-Usage` + exponential backoff
- [ ] Insights รายงานใหญ่: ใช้ **Async Insights API** แทน sync call
- [ ] Creatives upload: ย้ายจาก Multer (เก็บบน API server) → Cloudflare R2
- [ ] Custom Audience CSV: ยืนยันว่า hash PII (SHA-256) ก่อนส่ง + เก็บ consent ตาม PDPA
- [ ] MCP/Hermes Agent ที่คุมงบได้: เพิ่ม guardrail (เพดานต่อครั้ง, approval flow, audit log)
- [ ] `.env.example`: เปลี่ยน default `GRAFANA_PASSWORD=admin` ก่อนขึ้น prod

---

## 📋 ลำดับลงมือแนะนำ

1. **รวม API version + ลบ dead abstraction** (~1–2 ชม. · กันพัง ก.ย. 2026)
2. **ย้าย cron → BullMQ + lock** (กันเสียเงินตอน scale)
3. **เขียน test ครอบ rules + budget**
4. ที่เหลือ (P1 budget consistency → P2 hardening)