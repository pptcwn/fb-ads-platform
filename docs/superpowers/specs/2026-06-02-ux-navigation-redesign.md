# UX Navigation Redesign — Group A

**Date:** 2026-06-02  
**Scope:** Sidebar restructure, Dashboard cleanup, Campaigns page consolidation  
**Approach:** Minimal Restructure (A) — reuse existing components, minimal new code

---

## Goals

1. Sidebar: 12 flat items → grouped with section labels
2. Dashboard: overview/metrics only, no campaign list
3. Campaigns page: single page combining All Campaigns table + New Campaign drawer

---

## 1. Sidebar Restructure

### File
`apps/web/src/components/Sidebar.tsx`

### Change
Replace flat `NAV_ITEMS` array with `NAV_GROUPS` grouped structure.

### New Menu Structure

```
OVERVIEW
  Dashboard             /dashboard

CAMPAIGNS
  Campaigns             /dashboard/campaigns
  Audiences             /dashboard/audiences
  Creatives             /dashboard/creatives
  Templates             /dashboard/templates

AUTOMATION
  Rules                 /dashboard/rules
  Schedules             /dashboard/schedules
  Budget                /dashboard/budget
  A/B Test              /dashboard/abtest

INSIGHTS
  Analytics             /dashboard/analytics
  Alerts                /dashboard/notifications
```

### Group Label Style
`text-[10px] font-semibold uppercase tracking-widest text-ink-300 px-3 mb-1 mt-4`

### Removed Items
- "All Campaigns" (`/dashboard/all-campaigns`) → replaced by "Campaigns"
- "New Campaign" (`/dashboard/campaigns/new`) → accessed via drawer in Campaigns page

### Active State Logic
- `/dashboard/campaigns` matches both `/dashboard/campaigns` and `/dashboard/campaigns/*`
- `/dashboard` matches exactly (not startsWith, to avoid matching all dashboard routes)

---

## 2. Dashboard Cleanup

### File
`apps/web/src/app/dashboard/page.tsx`

### Removed
- `campaigns` state and all related state (`editCamp`, `deleteCamp`, `editForm`, `editSaving`, `deleteSaving`, `editError`)
- `loadCampaigns()` function
- `openEdit()`, `saveEdit()`, `confirmDelete()` functions
- Ad Accounts accordion section with campaign sub-list
- Edit Campaign modal
- Delete Campaign modal

### Kept
- FB Connection card
- Summary Stats (4 cards: Accounts, Campaigns, Active, Total Spend)
- Sync Status (Ad Sets, Ads, Last Sync)
- Performance Charts (LineChart + BarChart)
- Account Warmup section
- Auto-refresh (30s countdown)
- Sync Now + Get Insights buttons

### Added: Quick Action Row
Placed below Summary Stats, above Sync Status:

```
[ ✨ New Campaign ]  [ 📋 View Campaigns ]  [ 🔄 Sync Now ]
```

- "New Campaign" → links to `/dashboard/campaigns?new=1` (triggers drawer open on load)
- "View Campaigns" → links to `/dashboard/campaigns`
- "Sync Now" → calls `triggerSync()` inline (same as existing button)

---

## 3. Campaigns Page (New)

### File
`apps/web/src/app/dashboard/campaigns/page.tsx` — **new file**

### Content
All existing logic from `all-campaigns/page.tsx` moved here, plus New Campaign drawer.

### Page Layout

```
Header: "📋 Campaigns" | subtitle: "N campaigns across M accounts"
Actions: [🔄 Refresh] [+ New Campaign]

[Bulk Action Bar — visible when items checked]
  N selected | [⏸ Pause] [▶️ Resume] [🗑 Delete] [📥 CSV]

[Campaign Table]
  Columns: checkbox | Name | Account | Objective | Status | Budget | Spent | Actions
  Row actions: Ad Sets | Clone | Pause/Resume | Save Template | Delete

[Footer: count + Export CSV]
```

### New Campaign Drawer

**Trigger:** "+ New Campaign" button in page header  
**Open via URL:** `?new=1` query param (for deep-link from Dashboard quick action)

**Drawer specs:**
- Position: fixed right-0, full height, `w-[480px]`
- Backdrop: `bg-black/40`, click to close
- Close: X button, Escape key, backdrop click, successful campaign creation
- Content: reuse all form logic from `campaigns/new/page.tsx` (Wizard + Quick mode toggle, all form fields, budget preview, validation)
- On success: close drawer + call `fetchAll()` to refresh table — no page redirect

**State additions to page:**
```ts
const [drawerOpen, setDrawerOpen] = useState(false);
```

On mount, check `searchParams.get('new') === '1'` → `setDrawerOpen(true)`.

### Redirects

`apps/web/src/app/dashboard/all-campaigns/page.tsx`:
```tsx
import { redirect } from 'next/navigation';
export default function () { redirect('/dashboard/campaigns'); }
```

`apps/web/src/app/dashboard/campaigns/new/page.tsx`:
```tsx
import { redirect } from 'next/navigation';
export default function () { redirect('/dashboard/campaigns?new=1'); }
```

---

## 4. Files Changed

| File | Change |
|---|---|
| `apps/web/src/components/Sidebar.tsx` | Grouped nav structure |
| `apps/web/src/app/dashboard/page.tsx` | Remove campaign list, add quick actions |
| `apps/web/src/app/dashboard/campaigns/page.tsx` | New — merged Campaigns + Drawer |
| `apps/web/src/app/dashboard/all-campaigns/page.tsx` | Replace with redirect |
| `apps/web/src/app/dashboard/campaigns/new/page.tsx` | Replace with redirect |

---

## 5. Out of Scope

- Backend changes (no API changes required)
- Other pages (analytics, rules, budget, etc.)
- Group B: auto-sync smoothness, conflict resolution
- Component splitting / custom hooks (deferred to future refactor)
- Tests (deferred — 0 tests exist currently)

---

## 6. Success Criteria

- Sidebar shows 4 groups with labels, 11 total nav items
- Dashboard has no campaign list or campaign modals
- `/dashboard/all-campaigns` redirects to `/dashboard/campaigns`
- `/dashboard/campaigns/new` redirects to `/dashboard/campaigns?new=1` and opens drawer
- New Campaign drawer opens/closes smoothly, refreshes table on success
- No existing campaign functionality lost (bulk actions, clone, ad sets, template, CSV)
