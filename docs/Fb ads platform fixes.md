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

---

## ยังต้องทำ

### P1 — Tests
- [x] Unit test `rules-engine.service.spec.ts`
- [x] Unit test `budget.service.spec.ts` (`shouldRunNow`, ADJUST_PERCENT)
- [x] CI รัน `pnpm test` ก่อน deploy (`.github/workflows/ci.yml`)

### P2 — Hardening
- [x] Rate-limit header + backoff (`facebook-rate-limit.ts`)
- [x] Async Insights API (`facebook-async-insights.client.ts`)
- [ ] Creatives → object storage (R2/S3)
- [ ] Custom Audience PII hash + PDPA consent
- [x] Telegram เมื่อ reconcile แก้ drift (`RECONCILE_TELEGRAM_NOTIFY`)
- [x] `GRAFANA_PASSWORD` placeholder ใน `.env.example`
- [x] Meta deadlines: webhooks mTLS (`docs/meta-webhooks-mtls.md`), Advantage+ notes (`docs/meta-advantage-plus-2026.md`)

### Meta platform (ตรวจเป็นระยะ)
- [ ] Webhooks mTLS → Meta CA (มี.ค. 2026)
- [ ] Advantage+ Shopping/App ผ่าน MAPI (พ.ค. 2026)

---

## ลำดับถัดไป

1. **Phase 4** — unit tests + CI  
2. **Phase 5** — hardening ตาม traffic