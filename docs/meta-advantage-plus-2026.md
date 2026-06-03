# Meta Advantage+ & Marketing API (May 2026)

## Platform version

This project uses **`FB_API_VERSION`** (default `v24.0`) from `apps/api/src/common/facebook-api.config.ts`.

## Advantage+ checklist

| Area | Status in this repo | Notes |
|------|---------------------|-------|
| Campaign create via Graph | axios `FacebookService` | Review objective / `smart_promotion_type` when cloning |
| Advantage+ shopping campaigns | Manual in Ads Manager | Not automated here yet |
| Creative dynamic media | Creatives module | Uses `object_story_spec` link ads |
| Reporting | Async Insights + sync GET | Large ranges use BullMQ poll queue |

## Recommended actions before May 2026

1. Confirm app has **Advanced Access** for `ads_management`, `ads_read`.
2. Run regression on **campaign duplicate** and **budget update** against a test ad account.
3. Watch Meta changelog for deprecated fields on `Campaign` and `AdSet` nodes.
4. Enable webhooks (mTLS) for real-time status instead of polling-only sync.

## Constants

See `packages/shared/src/constants/meta-marketing.ts` for feature flags and deprecated field list used in code comments.