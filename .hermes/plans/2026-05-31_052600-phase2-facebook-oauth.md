# Phase 2: Facebook OAuth Integration

## Goal
เชื่อมต่อระบบกับ Facebook Login API เพื่อให้ผู้ใช้สามารถ authorize Facebook account
และรับ access token สำหรับดึงข้อมูล ad accounts / campaigns

## Components
1. **Facebook Module** (`apps/api/src/facebook/`)
2. **Web Login Button** (`apps/web/src/app/`) — existing page.tsx

## Step-by-step

### 1. Facebook Module
- `facebook.module.ts` — configures HttpModule for FB API calls
- `facebook.controller.ts`
  - `GET /facebook/auth` → redirect user to FB OAuth dialog
  - `GET /facebook/callback?code=...` → exchange code → long-lived token → store FbUser
  - `GET /facebook/me` → return current FB user info (protected)
- `facebook.service.ts`
  - `getAuthUrl()` — build FB OAuth URL with scopes
  - `exchangeCode(code)` — POST to FB Graph API /oauth/access_token
  - `getUserInfo(accessToken)` — GET /me?fields=id,name,email
  - `storeOrUpdateFbUser(userId, fbData)` — upsert FbUser in DB

### 2. Encryption
- Use `crypto` (built-in Node.js) with AES-256-GCM to encrypt/decrypt FB access tokens
- Key from `TOKEN_ENCRYPTION_KEY` env var

### 3. Frontend
- Update `apps/web/src/app/page.tsx` — add "Connect Facebook" button
- `apps/web/src/app/dashboard/page.tsx` — show connected FB accounts

### 4. Registration
- Register `FacebookModule` in `app.module.ts`
- Update `.env` FB_APP_ID / FB_APP_SECRET / FB_REDIRECT_URI
- Run `prisma migrate dev` for any new schema

## Files to create
- `apps/api/src/facebook/facebook.module.ts`
- `apps/api/src/facebook/facebook.controller.ts`
- `apps/api/src/facebook/facebook.service.ts`
- `apps/api/src/facebook/dto/facebook.dto.ts`

## Files to modify
- `apps/api/src/app.module.ts` — add FacebookModule import
- `apps/web/src/app/page.tsx` — add FB login button
- `apps/web/src/app/dashboard/page.tsx` — show FB accounts

## Risks
- FB API rate limits
- Token expiration (60 days for long-lived, need refresh)
- Redirect URI must match exactly in FB App settings
