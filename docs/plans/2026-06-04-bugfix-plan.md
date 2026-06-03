# Bugfix Plan — 2026-06-04

## Phase 1 — Critical (blocking usage) ✅

| ID | Fix | Files | Status |
|----|-----|-------|--------|
| P1-1 | Graph targeting search URL (`/search`) | `facebook.service.ts` | done |
| P1-2 | Campaigns drawer + ad account init (`useEffect`) | `campaigns/page.tsx` | done |
| P1-3 | Schedules load campaigns via `GET /campaigns/accounts` | `schedules/page.tsx` | done |

## Phase 2 — High (wrong data / failed actions) ✅

| ID | Fix | Files | Status |
|----|-----|-------|--------|
| P2-1 | `actPath()` / `fbAdAccountActId` on Graph paths | `facebook.service.ts` | done |
| P2-2 | Align daily budget min (UI 50 = API) | `campaigns/page.tsx` | done |
| P2-3 | Creatives: load pages on mount | `creatives/page.tsx` | done |
| P2-4 | Alerts: history `.catch` | `notifications/page.tsx` | done |
| P2-5 | Dashboard account + days selectors | `page.tsx` | done |
| P2-6 | `forwardRef` Insights in SyncModule | `sync.module.ts` | already present |
| P2-7 | Resolve `pageId` on campaign ad create | `campaigns.service.ts` | already present |
| P2-8 | Remove HOURLY label | `schedules/page.tsx` | done |

## Phase 3 — Medium (polish) ✅

| ID | Fix | Files | Status |
|----|-----|-------|--------|
| P3-1 | TargetingBuilder separate debounce timers | `TargetingBuilder.tsx` | done |
| P3-2 | Schedules form validation | `schedules/page.tsx` | done |
| P3-3 | Login network error message | `page.tsx` | done |
| P3-4 | `useSyncInsights` per account | `use-dashboard.ts`, `api-client.ts` | done |
| P3-5 | Creative `linkToCampaign` ownership | `creatives.service.ts` | done |

## Phase 4 — Auth, storage, templates ✅

| ID | Fix | Files | Status |
|----|-----|-------|--------|
| P4-1 | Same-origin API proxy + cookie (unset `NEXT_PUBLIC_API_URL` in dev) | `api.ts`, `next.config.js`, `.env.example` | done |
| P4-2 | Dashboard auth middleware (`fb_ads_token`) | `middleware.ts` | done |
| P4-3 | Login redirect after auth | `page.tsx` | done |
| P4-4 | Local creative image → FB via multipart upload | `creatives.service.ts` | done |
| P4-5 | S3/R2 upload on attach when configured | `creatives.service.ts`, `.env.example` | done |
| P4-6 | Save/load template full payload (targeting + creative) | `campaigns/page.tsx`, `api-client.ts` | done |
| P4-7 | Templates apply → `?new=1&template=` | `templates/page.tsx` | done |
| P4-8 | FB Publish ad account picker | `creatives/page.tsx` | done |
| P4-9 | `actPath` shared export | `facebook-api.config.ts` | done |

## Verification

- `pnpm --filter api test`
- `pnpm --filter api exec tsc --noEmit`
- Manual: login cookie on `:3000`, Campaigns `?new=1&template=`, Creatives FB Publish, middleware redirect when logged out

## Deploy

Push `main` → GitHub Actions → VPS health `/api/health`