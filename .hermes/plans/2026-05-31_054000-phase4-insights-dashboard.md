# Phase 4: Insights Dashboard

## Goal
ดึงข้อมูล Insights (impressions, clicks, spend, conversions, etc.) จาก Facebook Graph API
และแสดงผลเป็นกราฟบน Dashboard ด้วย recharts

## Components
1. **Insights Module** (`apps/api/src/insights/`)
2. **Dashboard Charts** — recharts line/bar charts

## Flow
1. `POST /insights/sync/:adAccountId` → fetch last 30d insights from FB → upsert CampaignInsight + AccountInsight
2. `GET /insights/:adAccountId` → aggregated daily insights for account
3. `GET /insights/:adAccountId/campaigns/:campaignId` → daily insights per campaign
4. Dashboard → line chart (spend, impressions over time), stat cards (CTR, CPC, ROAS)

## Files to create
- `apps/api/src/insights/insights.module.ts`
- `apps/api/src/insights/insights.controller.ts`
- `apps/api/src/insights/insights.service.ts`

## Files to modify
- `apps/api/src/app.module.ts` — add InsightsModule
- `apps/web/src/app/dashboard/page.tsx` — add charts

## Graph API calls
- `GET /act_{id}/insights?fields=impressions,clicks,ctr,cpc,spend,conversions,cpa,reach,frequency&date_preset=last_30d&level=campaign&time_increment=1`
- `GET /act_{id}/insights?fields=impressions,clicks,ctr,cpc,spend,conversions,reach,frequency&date_preset=last_30d&level=account&time_increment=1`

## Risks
- Rate limits: insight queries are expensive (count toward API call limit)
- Date range: default last_30d, make configurable
- Large accounts may have many campaigns → pagination
