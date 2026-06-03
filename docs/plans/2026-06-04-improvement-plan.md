# แผนปรับปรุง FB Ads Platform

> **อัปเดต:** 2026-06-04  
> **ที่มา:** รีวิวโค้ดจริงใน repo + `docs/Fb ads platform fixes.md` + สถานะหลัง migrate BullMQ  
> **เป้าหมาย:** ลดความเสี่ยงเสียเงินจาก automation, ทำให้ scale ได้ปลอดภัย, และมี test ครอบ logic สำคัญ

---

## สรุปสถานะปัจจุบัน

### ทำเสร็จแล้ว (ไม่ต้องทำซ้ำ)

| หัวข้อ | หลักฐาน |
|--------|---------|
| Graph API ใน API หลักใช้ env | `FB_API_VERSION` default `v24.0` ใน `facebook.service.ts`, `sync.service.ts`, `insights.service.ts`, ฯลฯ |
| ย้าย scheduler → BullMQ | `*-scheduler.service.ts` + `*-processor.ts` ใน rules, budget, schedules, warmup, sync, alerts |
| Campaign advisory lock | `campaign-lock/campaign-lock.service.ts` + ใช้ใน budget/rules/schedules บาง action |
| Token encryption | AES-256-GCM ใน `common/encryption.util.ts` |
| Observability | Prometheus + Grafana config |

### ยังต้องทำ (โฟกัสแผนนี้)

| ลำดับ | หัวข้อ | ความเร่งด่วน |
|-------|--------|--------------|
| 1 | BullMQ repeatable ซ้ำตอน restart (ไม่มี `jobId`) | P0 |
| 2 | FB ↔ DB consistency + reconciliation | P0 |
| 3 | Lock ครบทุก action ที่แตะ FB (rules budget actions) | P0 |
| 4 | รวม/ลบ dead FB abstraction (`v18` ใน packages) | P1 |
| 5 | Unit test rules + budget | P1 |
| 6 | Hardening (rate limit, insights async, security, storage) | P2 |

---

## หลักการออกแบบ

1. **Facebook = source of truth** สำหรับสถานะแคมเปญและงบจริงบน Meta  
2. **Idempotent jobs** — รันซ้ำได้โดยไม่เปลี่ยนผลลัพธ์  
3. **One campaign, one writer** — ทุก mutation ผ่าน `CampaignLockService`  
4. **One scheduler registration** — repeatable job ลงทะเบียนครั้งเดียวต่อ environment  
5. **Test ก่อนขยายฟีเจอร์ใหม่** ที่แตะงบ/สถานะโฆษณา

---

## Phase 0 — เตรียม (ครึ่งวัน)

**เป้าหมาย:** วัด baseline และกำหนดเกณฑ์สำเร็จ

- [ ] **0.1** ตรวจ repeatable jobs ใน Redis หลัง restart API 2–3 ครั้ง (`redis-cli KEYS bull:*`)
- [ ] **0.2** บันทึก job ที่กระทบเงิน: `rules`, `budget`, `schedules` (ความถี่ + concurrency)
- [ ] **0.3** กำหนด Definition of Done ต่อ phase (ด้านล่างแต่ละ phase)

**เกณฑ์สำเร็จ Phase 0:** มีรายการ job ซ้ำ (ถ้ามี) และ checklist ก่อน/หลัง deploy

---

## Phase 1 — P0: BullMQ ไม่ซ้ำ + Lock ครบ (1–2 วัน)

**เป้าหมาย:** deploy/restart ไม่ทำให้ automation รันซ้อน

### Task 1.1 — Stable repeatable job IDs

**ไฟล์ที่แก้:**

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `apps/api/src/rules/rules-scheduler.service.ts` | เพิ่ม `jobId: 'rules-evaluate-repeat'` |
| `apps/api/src/budget/budget-scheduler.service.ts` | `jobId: 'budget-run-repeat'` |
| `apps/api/src/schedules/schedules-scheduler.service.ts` | `jobId: 'schedules-run-repeat'` |
| `apps/api/src/warmup/warmup-scheduler.service.ts` | `jobId: 'warmup-advance-repeat'` |
| `apps/api/src/sync/sync-scheduler.service.ts` | `jobId` แยกต่อ job (`sync-campaigns`, `sync-insights`) |
| `apps/api/src/alerts/alerts-scheduler.service.ts` | `jobId: 'alerts-check-repeat'` |
| `apps/api/src/common/bullmq-scheduler.util.ts` | **สร้างใหม่** — helper `registerRepeatable(queue, name, opts)` |

**ขั้นตอน:**

- [x] **1.1.1** สร้าง util ลงทะเบียน repeatable: ลบ jobId เดิม (ถ้ามี) แล้ว `add` ใหม่
- [x] **1.1.2** ใส่ `jobId` คงที่ทุก scheduler
- [x] **1.1.3** ตั้ง `removeOnComplete` / `removeOnFail` ตามนโยบาย (เก็บ log 7 วัน)
- [ ] **1.1.4** Manual test: restart API 3 ครั้ง → จำนวน repeatable job ไม่เพิ่ม

**เกณฑ์สำเร็จ:** หลัง restart N ครั้ง มี repeatable job ชุดเดียวต่อ queue

---

### Task 1.2 — Lock ครบทุก FB mutation ใน Rules

**ไฟล์:** `apps/api/src/rules/rules-engine.service.ts`

**ปัญหา:** `INCREASE_BUDGET_*`, `DECREASE_BUDGET_*`, `DUPLICATE_CAMPAIGN` ไม่ใช้ `withCampaignLock`

- [x] **1.2.1** ห่อทุก case ใน `executeAction()` ด้วย `campaignLock.withCampaignLock`
- [x] **1.2.2** `PAUSE_ADSET` — อัปเดต Prisma ให้สอดคล้อง (ตอนนี้ pause FB แต่ไม่ update DB ในบาง path)
- [x] **1.2.3** เมื่อ lock ไม่ได้ → log + skip (ไม่ throw ทั้ง batch)

**เกณฑ์สำเร็จ:** ไม่มี action ใน rules engine ที่เรียก FB โดยไม่ผ่าน lock

---

### Task 1.3 — Lock + partial failure ใน Budget

**ไฟล์:** `apps/api/src/budget/budget.service.ts`

- [x] **1.3.1** ใช้ lock ใน `SET_BUDGET` / `ADJUST_PERCENT` (ตอนนี้มีแค่ PAUSE/RESUME บางส่วน)
- [x] **1.3.2** Account-wide loop: สำเร็จถ้ามี ≥1 campaign; ล้มรายตัวไม่ mark ทั้ง schedule
- [x] **1.3.3** อัปเดต `lastRunAt` เฉพาะเมื่อ execute สำเร็จ ≥ 1 campaign

**เกณฑ์สำเร็จ:** schedule หนึ่งรอบไม่ mark success ทั้งก้อนเมื่อแค่บาง campaign ล้ม

---

## Phase 2 — P0: Data consistency FB ↔ DB (2–3 วัน)

**เป้าหมาย:** FB สำเร็จแต่ DB ล้ม (หรือกลับกัน) ไม่ทิ้งระบบในสถานะผิด

### Task 2.1 — Idempotent action pattern

**สร้าง:** `apps/api/src/common/fb-mutation.service.ts` (หรือขยาย `FacebookService`)

รูปแบบมาตรฐาน:

```
1. อ่าน state จาก FB (หรือ cache สั้นๆ)
2. ถ้า target state แล้ว → skip (no-op)
3. เรียก FB mutation
4. อัปเดต Prisma ใน transaction เดียว
5. บันทึก ActivityLog / RuleLog พร้อม correlationId
```

- [x] **2.1.1** สร้าง `FbMutationService` + `getCampaignState` (idempotent check ก่อนยิง FB)
- [x] **2.1.2** ใช้ pattern เดียวใน `rules-engine`, `budget`, `schedules`

---

### Task 2.2 — Reconciliation job

**สร้าง:**

| ไฟล์ | หน้าที่ |
|------|--------|
| `apps/api/src/reconcile/reconcile.module.ts` | Module |
| `apps/api/src/reconcile/reconcile.service.ts` | เปรียบเทียบ FB vs Prisma |
| `apps/api/src/reconcile/reconcile.processor.ts` | BullMQ ราย 6 ชม. |
| `apps/api/src/reconcile/reconcile-scheduler.service.ts` | `jobId: 'reconcile-repeat'` |

**Logic:**

- [x] **2.2.1** เลือก campaigns ที่ `statusOverriddenAt` ภายใน 24 ชม. หรือ `RuleLog` ล้มเมื่อไม่นาน
- [x] **2.2.2** ดึงสถานะ/งบจาก FB → ถ้าไม่ตรง DB → แก้ DB + log `RECONCILED`
- [x] **2.2.3** แจ้ง Telegram เมื่อ reconcile พบ drift (ยกเว้น `RECONCILE_TELEGRAM_NOTIFY=false`)

**เกณฑ์สำเร็จ:** จำลอง Prisma fail หลัง FB success แล้ว reconcile แก้ได้ภายใน 1 cycle

---

## Phase 3 — P1: รวม Facebook client + ลบ dead code (1 วัน)

**เป้าหมาย:** ไม่มี path ที่เรียก Graph API `v18` โดยไม่ตั้งใจ

### Task 3.1 — Shared constants

- [x] **3.1.1** แก้ `packages/shared` → `DEFAULT_FB_API_VERSION = v24.0`
- [x] **3.1.2** ลบ `facebook-sdk-wrapper` package ทั้งก้อน

### Task 3.2 — ตัดสินใจ SDK strategy (เลือก 1 ทาง)

| ทางเลือก | ข้อดี | ข้อเสีย |
|----------|-------|--------|
| A) axios + `FacebookService` (ปัจจุบัน) | ควบคุมได้, ใช้อยู่แล้ว | ต้องดูแล้ version เอง |
| B) official `facebook-nodejs-business-sdk` | Meta maintain | refactor ใหญ่ |
| C) `@fb-ads/facebook-sdk` wrapper | แยก layer | ยังไม่ได้ใช้ |

**แนะนำ:** ทาง A + ลบ B/C ที่ไม่ใช้

- [x] **3.2.1** ลบ dep `facebook-nodejs-business-sdk` จาก `apps/api`
- [x] **3.2.2** ลบ `packages/facebook-sdk-wrapper`
- [x] **3.2.3** อัปเดต `docs/Fb ads platform fixes.md` + รวม URL ที่ `facebook-api.config.ts`

---

## Phase 4 — P1: Tests สำหรับ logic ที่แตะเงิน (2–3 วัน)

**เป้าหมาย:** CI รัน test ก่อน deploy; regression จับได้ก่อนขึ้น prod

### Task 4.1 — Rules engine unit tests

**ไฟล์:** `apps/api/src/rules/rules-engine.service.spec.ts`

ครอบ:

- [x] cooldown — ไม่ trigger ซ้ำภายใน window
- [x] เงื่อนไข GT/LT/GTE/LTE/EQ ต่อ metric
- [x] action INCREASE cap 5000
- [ ] lock skip — เมื่อ `pg_try_advisory_lock` false (integration)

Mock: `PrismaService`, `FacebookService`, `CampaignLockService`

---

### Task 4.2 — Budget unit tests

**ไฟล์:** `apps/api/src/budget/budget.service.spec.ts`

ครอบ:

- [x] `shouldRunNow()` + timezone UTC
- [x] `ADJUST_PERCENT` คำนวณถูก (+10%)
- [x] `SET_BUDGET` validation
- [x] partial failure ไม่อัปเดต `lastRunAt`

---

### Task 4.3 — CI

- [x] เพิ่ม `.github/workflows/ci.yml` + test job ใน `deploy.yml`
- [x] deploy รอ `needs: test` ก่อนขึ้น VPS

---

## Phase 5 — P2: Hardening & Product safety (ต่อเนื่อง)

### 5.1 Graph API resilience

- [x] Interceptor อ่าน `X-Business-Use-Case-Usage` + exponential backoff (`facebook-rate-limit.ts`)
- [x] Queue rate limiter Redis ต่อ ad account (`fb-account-rate-limiter.service.ts`)

### 5.2 Insights

- [x] ย้าย insights ใหญ่ไป Async Insights API (`facebook-async-insights.client.ts`)
- [x] BullMQ queue `insights-async` สำหรับ poll report status

### 5.3 Security & compliance

- [x] JWT ใน httpOnly cookie `fb_ads_token` (+ Bearer backward compat)
- [x] Custom Audience: SHA-256 hash PII + consent log (PDPA) — `audience-pii.util.ts`
- [x] เปลี่ยน default `GRAFANA_PASSWORD` ใน `.env.example`

### 5.4 Storage & ops

- [x] Creatives upload → R2/S3 เมื่อตั้ง `S3_*` env (fallback local Multer)
- [x] Guardrail + approval queue (`automation-guard`, `AutomationApproval`, `/api/approvals`)

### 5.5 Meta platform deadlines

- [x] Webhooks mTLS + verify (`/api/webhooks/meta`, `docs/meta-webhooks-mtls.md`)
- [x] Advantage+ checklist (`docs/meta-advantage-plus-2026.md`, `meta-marketing.ts`)

---

## แผนเวลา (แนะนำ)

| สัปดาห์ | Phase | ผลลัพธ์ |
|---------|-------|---------|
| 1 | Phase 0 + 1 | ไม่มี job ซ้ำ, lock ครบ |
| 2 | Phase 2 | consistency + reconcile |
| 3 | Phase 3 + 4 | ลบ dead code + test ใน CI |
| 4+ | Phase 5 | hardening ตาม priority ธุรกิจ |

---

## ลำดับ PR แนะนำ (แยก deploy ได้)

```
PR-1  fix/bullmq-stable-job-ids
PR-2  fix/rules-budget-full-campaign-lock
PR-3  feat/fb-mutation-idempotent-pattern
PR-4  feat/reconcile-job
PR-5  chore/remove-dead-fb-sdk
PR-6  test/rules-and-budget-unit
PR-7+ hardening (แยกตามหัวข้อ P2)
```

---

## Checklist ก่อนขึ้น Production ทุกครั้ง

- [ ] Restart API แล้ว repeatable jobs ไม่เพิ่ม
- [ ] `FB_API_VERSION=v24.0` (หรือใหม่กว่า) ใน `.env` prod
- [ ] Redis + Postgres healthy
- [ ] `pnpm test` ผ่าน
- [ ] ทดสอบ rule จำลองบน ad account ทดสอบ (ไม่ใช่บัญชีจริงที่ใช้เงินเยอะ)
- [ ] มี alert เมื่อ RuleLog `success: false` สูงผิดปกติ

---

## เอกสารที่เกี่ยวข้อง

- `docs/Fb ads platform fixes.md` — รายการเดิม (บางข้อ outdated หลัง BullMQ)
- `docs/superpowers/plans/2026-06-02-backend-smoothness-group-b.md` — แผน implement Group B (ทำไปแล้วส่วนใหญ่)
- `.env.example` — ตัวแปรที่ต้องตั้ง

---

## หมายเหตุสำหรับ agent / developer

เมื่อ implement แต่ละ task ให้:

1. อ่านไฟล์รอบๆ ก่อนแก้ — อย่า refactor นอก scope
2. อัปเดต checkbox ในไฟล์นี้เมื่อ PR merge
3. ถ้าเปลี่ยน schema → `prisma migrate dev` + บันทึกใน PR description