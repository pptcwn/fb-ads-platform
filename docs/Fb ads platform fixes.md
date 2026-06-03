# FB Ads Platform — สถานะการปรับปรุง

> อัปเดต: 2026-06-04  
> แผนละเอียด: `docs/plans/2026-06-04-improvement-plan.md`

---

## ทำเสร็จแล้ว

### Graph API version
- [x] API ใช้ `FB_API_VERSION` จาก env (default `v24.0`) ผ่าน `apps/api/src/common/facebook-api.config.ts`
- [x] `packages/shared` อัปเป็น `DEFAULT_FB_API_VERSION = v24.0`
- [x] ลบ `facebook-nodejs-business-sdk` จาก `apps/api`
- [x] ลบ package `facebook-sdk-wrapper` (ไม่ถูก import)

### BullMQ + lock
- [x] Cron → BullMQ processors (rules, budget, schedules, sync, alerts, warmup, reconcile)
- [x] Repeatable jobs มี `jobId` คงที่ (`bullmq-scheduler.util.ts`)
- [x] `CampaignLockService` + lock ครบ mutation ที่แตะ FB

### Consistency
- [x] `FbMutationService` — idempotent ก่อนยิง Graph API
- [x] `ReconcileModule` — sync DB จาก FB ทุก 6 ชม.

### P1 — Tests
- [x] Unit test `rules-engine.service.spec.ts`
- [x] Unit test `budget.service.spec.ts` (`shouldRunNow`, ADJUST_PERCENT)
- [x] CI รัน `pnpm test` ก่อน deploy (`.github/workflows/ci.yml`)

### P2 — Hardening
- [x] Rate-limit header + backoff (`facebook-rate-limit.ts`)
- [x] Async Insights API (`facebook-async-insights.client.ts`)
- [x] Creatives → R2/S3 เมื่อตั้ง `S3_*` + local multipart fallback ไป Meta
- [x] Custom Audience PII hash + PDPA consent (`audience-pii.util.ts`, audiences UI)
- [x] Telegram เมื่อ reconcile แก้ drift (`RECONCILE_TELEGRAM_NOTIFY`)
- [x] `GRAFANA_PASSWORD` placeholder ใน `.env.example`
- [x] Meta webhooks + mTLS guard (`/api/webhooks/meta`, `docs/meta-webhooks-mtls.md`)
- [x] Advantage+ notes (`docs/meta-advantage-plus-2026.md`)

### Web / UX (bugfix waves)
- [x] Bugfix waves 1–2 (`docs/plans/2026-06-04-bugfix-plan.md`)
- [x] Auth middleware, same-origin API proxy, templates ครบ, FB Publish ad account picker
- [x] Wave 3: `templates` + `creatives` ใช้ `api-client` (cookie เดียวกับ hooks อื่น)

---

## ยังต้องทำ (ops / Meta platform)

| หัวข้อ | หมายเหตุ |
|--------|----------|
| Webhooks mTLS production | เปิด block ใน `nginx.conf` + ตั้ง `META_CA_BUNDLE_PATH` บน VPS |
| Advantage+ Shopping/App MAPI | ตรวจตาม `docs/meta-advantage-plus-2026.md` เมื่อ Meta บังคับ |
| Web pages อื่นที่ยังใช้ `axios` ตรง | schedules, rules, budget, notifications, analytics, abtest, TargetingBuilder |

---

## ลำดับถัดไป

1. `git push origin main` — deploy 3 commits ที่ค้างบน local  
2. เปิด mTLS บน VPS เมื่อลงทะเบียน Meta Webhooks  
3. ค่อยๆ ย้ายหน้า dashboard ที่เหลือไป `api-client`