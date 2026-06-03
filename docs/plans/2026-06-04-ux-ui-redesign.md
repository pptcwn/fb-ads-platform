# แผนออกแบบ UX/UI ใหม่ — FB Ads Platform

> **วันที่:** 2026-06-04  
> **สถานะ:** implement ครบ PR-1–13 ใน repo (2026-06-04) — รัน `pnpm --filter web type-check` บนเครื่อง Windows หลัง `pnpm install`  
> **ขอบเขต:** Web app ทั้งหมด (`apps/web`) — ไม่รวม Marketing site / Mobile app แยก  
> **ผู้ใช้หลัก:** ผู้ดูแลหลาย Ad Account, ภาษาไทย/อังกฤษ, ทำงานบน Desktop เป็นหลัก

---

## 1. เป้าหมาย

| เป้าหมาย | วัดความสำเร็จ |
|----------|----------------|
| เข้าใจ flow สร้างแคมเปญได้ภายใน 5 นาที (ผู้ใช้ใหม่) | Usability test 3 คน ผ่าน checklist |
| ลดความสับสน Targeting / Audience estimate | ผู้ใช้หา Location + เห็น Est. Audience โดยไม่ต้องถาม |
| ลดความซ้ำซ้อนระหว่าง 11 หน้า | โครงสร้าง IA ชัด, pattern เดียวกันทุก Automation |
| รักษา Dark minimal ที่มีอยู่ แต่ทำให้ “เป็น product” มากขึ้น | Design tokens + component library ครบชุด |
| พร้อม scale ฟีเจอร์ (Approvals, A/B, Rules) | Layout + data table pattern มาตรฐาน |

---

## 2. ปัญหาปัจจุบัน (จากโค้ด + feedback)

### 2.1 โครงสร้างและนำทาง

- Sidebar แบ่งกลุ่มแล้ว (ดี) แต่ **ไม่มีบริบทบัญชี** — ไม่รู้ว่ากำลังทำงานกับ Ad Account ไหน
- Dashboard, Analytics, Campaigns แยก insights หลายที่
- หน้า Automation 4+ หน้า (Rules, Schedules, Budget, Approvals, A/B) ใช้ layout/form คนละแบบ

### 2.2 New Campaign (จุดเจ็บหลัก)

- Drawer **480px** แคบเกินสำหรับ Wizard 3 ขั้น + TargetingBuilder + Creative + รูป
- Wizard ขั้น 2 ชื่อ **“Budget”** แต่มี **Targeting** ซ่อนใต้ checkbox → ผู้ใช้คิดว่า estimate อยู่ขั้นอื่น
- โหมด **Quick vs Wizard** ไม่ชัดว่าเมื่อไหร่ใช้อะไร
- **Est. Audience** (Meta) ปนกับ **Budget Preview** (สูตรใน UI) — ชื่อคล้ายกัน

### 2.3 TargetingBuilder

- ส่วนใหญ่ **พับอยู่** — เห็นแค่ Custom Audiences ที่โหลดทันที
- Interest/Location ต้องค้นหา 2+ ตัวอักษร ไม่มี hint
- ไม่มี default ประเทศ (TH) ตอน estimate ใน UI (ต่างจาก API ตอนสร้างจริง)
- ไม่มี empty state เมื่อ estimate = 0

### 2.4 ความสม่ำเสมอ

- บางหน้าใช้ `api-client` + hooks, บางหน้ายัง pattern เก่า (emoji ในหัวข้อ, msg แบบ `✅/❌`)
- Modal / Drawer / inline form ปนกัน
- ตาราง campaign หนาแน่น แต่ mobile ไม่ได้ออกแบบ

---

## 3. หลักการออกแบบ (Design principles)

1. **Account-first** — เลือก Ad Account (หรือ “ทุกบัญชี”) ที่ top bar ก่อนทำ action ที่แตะเงิน
2. **Progressive disclosure** — แสดงเฉพาะสิ่งที่จำเป็นต่อขั้น; ไม่พับทุกอย่างใน accordion
3. **One primary action ต่อหน้า** — ปุ่มหลักเด่นชัด (สร้าง / sync / บันทึก)
4. **Meta-aware copy** — แยกชัด “Reach จากงบ (ประมาณ)” vs “Audience จาก Meta”
5. **Thai-ready** — copy สั้น เป็นประโยค; รองรับ i18n ใน Phase สุดท้าย
6. **Reuse shadcn** — ลด `.card` / `.btn-primary` แบบกำหนดเอง ค่อยๆ ไปที่ `Button`, `Dialog`, `Sheet`

---

## 4. Information Architecture (ใหม่)

### 4.1 โครงเมนูหลัก (Sidebar)

```
[ Logo ]  FB Ads Platform
[ Ad Account ▼ ]  ← global context (required for spend actions)

HOME
  Overview          /dashboard

ADS
  Campaigns         /dashboard/campaigns      ← hub หลัก
  Creatives         /dashboard/creatives
  Audiences         /dashboard/audiences

AUTOMATION
  Rules             /dashboard/rules
  Schedules         /dashboard/schedules
  Budget            /dashboard/budget
  Approvals         /dashboard/approvals

EXPERIMENTS
  A/B Tests         /dashboard/abtest

INSIGHTS & ALERTS
  Analytics         /dashboard/analytics
  Notifications     /dashboard/notifications

─────────────
  Settings (future)
  Sign out
```

**เปลี่ยนจากเดิม:** รวม mental model เป็น **Ads → Automation → Insights**; เอา Templates เป็น sub-flow ใน Campaigns (ไม่ใช่เมนูระดับเดียวกับ Creatives) — *หรือ* เก็บ Templates แต่ย้ายไปใต้ Campaigns เป็น tab

### 4.2 Campaigns Hub (หน้าเดียว หลายแท็บ)

แทน drawer อย่างเดียว + หน้ากระจัด:

| Tab | เนื้อหา |
|-----|---------|
| **All campaigns** | ตาราง + bulk + filter ตาม account/status |
| **Templates** | การ์ด template + Apply → เปิด create flow |
| **Drafts** (optional P2) | แคมเปญที่บันทึกไม่ครบ |

Primary CTA: **+ สร้างแคมเปญ** → ไป full-page flow (ไม่ใช่ drawer แคบ)

---

## 5. Design System (อัปเดต)

### 5.1 Tokens (คง dark base, เพิ่ม semantic)

| Token | ใช้กับ |
|-------|--------|
| `--surface-elevated` | Sheet, modal, sticky header |
| `--success` / `--warning` / `--danger` | สถานะแคมเปญ, rule, alert |
| `--meta` (ม่วงอ่อน) | ข้อมูลจาก Facebook / sync |
| `--estimate` (ฟ้าอ่อน) | Audience estimate banner |
| `--budget-preview` (เทา accent) | สูตร CPC/CPM ใน UI |

Typography: คง Geist; กำหนด scale `display / h1 / h2 / body / caption`

Spacing: grid 4px; page padding `24px` desktop, `16px` tablet

### 5.2 Components มาตรฐาน (สร้าง/ขยาย)

| Component | หน้าที่ |
|-----------|---------|
| `AppShell` | Sidebar + TopBar + AccountSwitcher |
| `PageLayout` | title, breadcrumbs, actions slot |
| `DataTable` | sort, filter chips, bulk bar, empty |
| `StatusBadge` | ACTIVE, PAUSED, DRAFT, ERROR |
| `Stepper` | create campaign 4 ขั้น |
| `TargetingPanel` | แทน TargetingBuilder แบบพับหมด |
| `MetricCard` | dashboard / analytics |
| `ConnectionBanner` | FB ไม่เชื่อม / token หมดอายุ |
| `Sheet` (shadcn) | secondary panels กว้าง `min(720px, 100vw)` |
| `ConfirmDialog` | ลบ / pause ที่แตะเงิน |

---

## 6. Flow หลัก — สร้างแคมเปญ (ใหม่)

### 6.1 เส้นทาง

`Campaigns` → **+ สร้างแคมเปญ** → `/dashboard/campaigns/create` (full page)

Deep link เดิม: `?new=1` → redirect ไป `/create`

Template: `?template=id` → ขั้น 1 โหลดค่า

### 6.2 Stepper (4 ขั้น — แยก Budget กับ Targeting)

```
① Setup          ชื่อ, Ad Account, Objective
② Budget         งบรายวัน, สถานะ, Budget preview (สูตร UI)
③ Audience       Location (default TH), Age, Interests, Custom audiences
                 + Sticky: Meta Audience estimate (DAU/MAU)
④ Ad (optional)  Link ad, รูป, message, CTA
   Review        สรุปก่อน Launch
```

**ไม่มี Quick/Wizard** — ใช้ stepper อย่างเดียว (ตามการตัดสินใจผู้ใช้)

### 6.3 Audience step — UX ชัดเจน

- **Location เปิดอยู่เสมอ** + chip “ประเทศไทย” ตั้งต้น
- แบ่ง 3 คอลัมน์ desktop / stack mobile:
  - Demographics (อายุ, เพศ)
  - Interests (search)
  - Custom audiences (include/exclude)
- แถบ **Meta Audience estimate** ติดล่างจอเมื่อมี account + geo
- ถ้า estimate = 0: แสดง “เพิ่มประเทศหรือปรับ targeting”

### 6.4 หลัง Launch

- Toast success + ลิงก์ “ดูแคมเปญ” / “สร้างอีก”
- กลับตารางพร้อม highlight แถวใหม่

---

## 7. หน้าอื่นๆ (สรุปการเปลี่ยน)

### 7.1 Overview (`/dashboard`)

- ลดความหนาแน่น: แถว 1 = Connection + Sync, แถว 2 = KPI 4 ใบ
- **Quick start checklist** (เชื่อม FB → sync → สร้างแคมเปญแรก)
- กราฟย่อ; ลิงก์ “ดู Analytics เต็ม”

### 7.2 Campaigns table

- Filter bar: Account, Status, Objective, ค้นหาชื่อ
- Row actions ใน `⋯` menu แทนปุ่ม 5 ปุ่ม
- Ad Sets → Sheet กว้าง (ไม่ modal เล็ก)

### 7.3 Audiences / Creatives

- Layout แบบ **master-detail**: ซ้ายรายการ, ขวารายละเอียด + actions
- FB Publish: step ชัด (เลือก account → confirm → สถานะบน Meta)

### 7.4 Automation (Rules, Schedules, Budget)

- **pattern เดียวกัน:**
  - ซ้าย: รายการ (enabled toggle)
  - ขวา: form แก้ไข / empty “เลือกรายการ”
- Wizard สร้าง rule แบบ step: เลือก scope → เงื่อนไข → action → cooldown

### 7.5 Notifications

- แยก tab: Configs | History | Telegram
- History แบบ inbox (unread ชัด)

### 7.6 Analytics

- Date range + account ที่ top
- เปรียบเทียบช่วงเวลาเป็นการ์ดเดียว

---

## 8. Wireframe (ASCII)

### 8.1 App shell

```
┌──────────┬────────────────────────────────────────────────────┐
│ Sidebar  │ TopBar: [Ad Account ▼]  [Sync]  [🔔]  [User]       │
│          ├────────────────────────────────────────────────────┤
│ Home     │ Breadcrumb: Ads / Campaigns                        │
│ Ads      │ Title + Primary CTA                                │
│ ...      │ ┌────────────────────────────────────────────────┐ │
│          │ │ Filters │ Table / Content                      │ │
│          │ └────────────────────────────────────────────────┘ │
└──────────┴────────────────────────────────────────────────────┘
```

### 8.2 Create campaign — step 3 Audience

```
┌─ Stepper: Setup ✓  Budget ✓  Audience ●  Ad ○  Review ○ ─────────┐
│                                                                     │
│  📍 Locations (required)     [ Thailand ✕ ]  [ + Add location ]    │
│  👤 Age 18–65   Gender: All / M / F                                │
│  🎯 Interests   [ search........................ ]                   │
│  👥 Custom      [x] Include list   [ ] Exclude list                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ Meta estimate:  1.2M daily  ·  3.4M monthly        [Refreshing…]   │
└─────────────────────────────────────────────────────────────────────┘
        [ ← Back ]                              [ Next: Ad → ]
```

---

## 9. Visual direction

- **คงธีม Dark** (Vercel-like) — ผู้ใช้คุ้นแล้ว
- เพิ่ม **ความลึก** ด้วย elevation 2 ระดับ (ไม่พึ่ง border อย่างเดียว)
- ลด emoji ในหัวข้อ → ใช้ Lucide + label ไทย/อังกฤษ
- Motion เบา: step transition, sheet slide (มี framer อยู่แล้ว)
- **ไม่ทำ light mode** ใน v1 (ลด scope) — ออกแบบ token ให้เพิ่มทีหลังได้

---

## 10. Accessibility & i18n

- Focus ring ทุก interactive (มีบางส่วนแล้ว)
- `aria-current`, labels ปุ่ม icon-only
- ขั้นตอน stepper: `aria-current="step"`
- Phase สุดท้าย: `next-intl` หรือ JSON copy — **TH เป็นค่าเริ่มต้น** สำหรับ label หลัก

---

## 11. PR Plan (ลำดับ implement)

| PR | ชื่อ | ไฟล์หลัก | ขึ้นกับ |
|----|------|----------|--------|
| PR-1 | Design tokens + AppShell + TopBar + AccountSwitcher | `globals.css`, `AppShell`, `TopBar` | — |
| PR-2 | PageLayout, StatusBadge, DataTable, EmptyState มาตรฐาน | `components/ui/*` | PR-1 |
| PR-3 | Campaigns hub (tabs: campaigns / templates) | `campaigns/page.tsx` | PR-2 |
| PR-4 | Create campaign full-page stepper (setup + budget) | `campaigns/create/*` | PR-3 |
| PR-5 | TargetingPanel + Meta estimate UX | `TargetingPanel.tsx`, API ไม่เปลี่ยน | PR-4 |
| PR-6 | Ad step + review + launch | `campaigns/create/*` | PR-5 |
| PR-7 | Redirects `?new=1`, deprecate narrow drawer | middleware, redirects | PR-6 |
| PR-8 | Automation layout pattern (Rules, Schedules, Budget) | 3 pages | PR-2 |
| PR-9 | Audiences/Creatives master-detail | 2 pages | PR-2 |
| PR-10 | Dashboard checklist + polish | `dashboard/page.tsx` | PR-1 |
| PR-11 | Notifications inbox + Analytics filters | 2 pages | PR-2 |
| PR-12 | Responsive mobile (campaigns table → cards, create stepper) | campaigns + create | PR-6 |
| PR-13 | TH copy pass + a11y audit | ทั้ง web | PR-1–12 |

แต่ละ PR ควร merge ได้อิสระ; demo ได้หลัง PR-6

---

## 12. Key Decisions

| การตัดสินใจ | เหตุผล |
|-------------|--------|
| Full-page create แทน drawer 480px | ลดความอึดอัด + แยกขั้น Audience ชัด |
| 4 ขั้น แยก Budget / Audience | แก้ pain “estimate อยู่ขั้นไหน” |
| Global Ad Account context | ทุก action ที่แตะเงินสอดคล้องบัญชี |
| Templates เป็น tab ใน Campaigns | ลดเมนูซ้าย, ใกล้ flow ใช้งาน |
| คง dark theme | ไม่เพิ่ม scope light mode v1 |
| shadcn Sheet กว้างสำหรับ secondary | Ad Sets, FB Publish — ไม่ใช่ create หลัก |

---

## 13. การตัดสินใจจากผู้ใช้ (2026-06-04)

| หัวข้อ | คำตอบ |
|--------|--------|
| ภาษา UI | **ไทยหลัก + ศัพท์ Meta อังกฤษ** |
| Templates | **แท็บใน Campaigns** (เอาออกจาก sidebar ระดับเดียว) |
| สร้างแคมเปญ | **Stepper 4 ขั้นเต็มหน้าอย่างเดียว** (ไม่มี Quick mode) |
| สไตล์อ้างอิง | **ใกล้ Meta Ads Manager** (โครงตาราง + filter + step ชัด) |
| Mobile | **ต้องสร้าง/แก้แคมเปญบนมือถือได้** → responsive stepper, bottom bar actions, table → card list |

### ผลต่อแผน

- PR-4–6: ออกแบบ mobile-first breakpoints ตั้งแต่ wireframe
- ลบ “Quick create” ออกจาก scope
- Sidebar: ไม่มีรายการ Templates แยก
- Copy deck: เริ่มจากไทย (เช่น “กลุ่มเป้าหมาย”, “งบรายวัน”, “Reach โดยประมาณ (Meta)”)

---

## 14. สิ่งที่ยังไม่รวมใน v1

- Light theme
- Settings / Team / RBAC UI
- In-app onboarding video
- **Figma:** ทำก่อน code — ดู checklist ที่ `docs/plans/2026-06-04-ux-ui-figma-checklist.md`

---

## 15. Success metrics (หลัง launch)

- เวลาเฉลี่ยสร้างแคมเปญแรก (จาก analytics event)
- % ผู้ใช้ที่เห็น audience estimate > 0 ในขั้น Audience
- จำนวน support question เรื่อง “หา targeting ไม่เจอ” ลดลง