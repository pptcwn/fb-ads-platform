# Phase 3: Campaign Management

> **Goal:** สร้าง/แก้ไข/จัดการ Campaign, AdSet, Ad บน Facebook จากหน้า Dashboard โดยตรง

**Architecture:**
- Facebook Service — เพิ่ม methods สำหรับสร้าง campaign, adset, ad ผ่าน Graph API
- Campaigns Module — NestJS CRUD + Facebook API integration
- Frontend Campaign Creator — Form wizard สำหรับสร้าง campaign

---

### Task 1: FacebookService — Add Campaign/AdSet/Ad API Methods

**Files:**
- Modify: `apps/api/src/facebook/facebook.service.ts`

Methods to add:
- `createCampaign(accountId, name, objective, status, accessToken)`
- `createAdSet(campaignId, params, accessToken)`
- `createCreative(adAccountId, params, accessToken)`
- `createAd(adSetId, creativeId, name, accessToken)`
- `listAdAccounts(accessToken)`
- `getCampaigns(accountId, accessToken)`

### Task 2: Campaigns API Module

**Files:**
- Create: `apps/api/src/campaigns/campaigns.module.ts`
- Create: `apps/api/src/campaigns/campaigns.controller.ts`
- Create: `apps/api/src/campaigns/campaigns.service.ts`
- Create: `apps/api/src/campaigns/dto/create-campaign.dto.ts`
- Modify: `apps/api/src/app.module.ts`

### Task 3: Campaign Creator Frontend

**Files:**
- Create: `apps/web/src/app/dashboard/campaigns/new/page.tsx`
- Create: `apps/web/src/app/dashboard/campaigns/page.tsx`
- Modify: `apps/web/src/app/dashboard/page.tsx` — add nav link
