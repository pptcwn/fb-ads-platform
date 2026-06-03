# Phase 3: Ad Account Sync & Campaign Import

## Goal
นำเข้าข้อมูล Facebook Ad Accounts, Campaigns, Ad Sets, Ads จาก Graph API
และแสดงผลบน Dashboard

## Components
1. **Sync Module** (`apps/api/src/sync/`)
2. **BullMQ Queue** — background job processor
3. **Ad Account Module** (`apps/api/src/adaccount/`)
4. **Dashboard Web** — แสดงข้อมูลจริง

## API Endpoints
- `POST /sync/trigger` — เริ่ม sync (background)
- `GET /sync/status` — ดูสถานะ sync ล่าสุด
- `GET /adaccounts` — รายการ ad accounts
- `GET /adaccounts/:id/campaigns` — campaigns ใน account นั้น
- `GET /adaccounts/:id/insights` — insights ของ account

## Graph API Calls
- `GET /me/adaccounts?fields=id,name,account_status,currency,timezone_name,balance,amount_spent`
- `GET /act_{account_id}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget`
- `GET /act_{account_id}/insights?fields=impressions,clicks,ctr,cpc,spend,conversions,cpa,reach,frequency`

## Flow
1. User connects Facebook → FbUser saved
2. POST /sync/trigger → queues BullMQ job
3. BullMQ processor: fetch ad accounts → upsert → fetch campaigns → upsert
4. Dashboard GET /adaccounts → show synced data

## Files to create
- `apps/api/src/sync/sync.module.ts`
- `apps/api/src/sync/sync.controller.ts`
- `apps/api/src/sync/sync.service.ts`
- `apps/api/src/adaccount/adaccount.controller.ts`
- `apps/api/src/adaccount/adaccount.module.ts`

## Files to modify
- `apps/api/src/app.module.ts` — register new modules
- `apps/web/src/app/dashboard/page.tsx` — show real data

## Risks
- FB API rate limits (200 calls/hour per user)
- Token expiration — need to check before syncing
- Large accounts may have 1000+ campaigns — need pagination
