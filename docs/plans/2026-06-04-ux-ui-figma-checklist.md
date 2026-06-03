# Figma Checklist — UX/UI Redesign FB Ads Platform

> **วันที่:** 2026-06-04  
> **อ้างอิง:** `docs/plans/2026-06-04-ux-ui-redesign.md`  
> **เป้าหมาย:** ออกแบบใน Figma ให้ครบก่อน PR-1 เพื่อลด rework ตอน implement (โดยเฉพาะ mobile + stepper + Meta-like patterns)

---

## ทำไมควรทำ Figma ก่อน code

| เหตุผล | กับโปรเจกต์นี้ |
|--------|----------------|
| Stepper 4 ขั้น + mobile | ต้องเห็น flow บน 375px ก่อนเขียน React |
| สไตล์ใกล้ Ads Manager | ตาราง, filter, bulk — layout ซับซ้อน ควร lock ก่อน |
| ไทย + ศัพท์ Meta | ความยาว label กระทบปุ่ม/ sidebar |
| หลายทีม/รอบ feedback | Figma = single source ก่อน merge PR |

**Gate:** ไม่เริ่ม PR-4 (create campaign) จนกว่า section **§4 Create flow** ใน checklist นี้จะติ๊กครบ + review 1 รอบ

---

## โครงไฟล์ Figma (แนะนำ)

```
📁 FB Ads Platform — UI Redesign 2026
├── 📄 Cover (version, วันที่, ลิงก์แผน MD)
├── 📄 Foundations
│   ├── Colors / Type / Spacing / Grid
│   └── Icons (Lucide subset)
├── 📄 Components
│   ├── Atoms (Button, Input, Badge, Chip…)
│   ├── Molecules (MetricCard, FilterBar…)
│   └── Organisms (DataTable, Stepper, TargetingPanel…)
├── 📄 Patterns
│   ├── Empty / Loading / Error
│   └── Mobile vs Desktop breakpoints
├── 📄 Screens — Desktop 1440
├── 📄 Screens — Mobile 390
└── 📄 Flows (prototype links)
```

**Breakpoints บังคับ**

| Frame | ขนาด | ใช้กับ |
|-------|------|--------|
| Desktop | 1440 × 900 | Shell, tables, create stepper |
| Mobile | 390 × 844 | Create stepper, campaign cards, nav |

---

## §0 — Setup (ก่อนวาดหน้าจอ)

- [ ] สร้างไฟล์ Figma + invite ผู้เกี่ยวข้อง
- [ ] ตั้ง **Variables** (หรือ styles): `bg`, `surface`, `surface-elevated`, `ink`, `accent`, `success`, `warning`, `danger`, `meta`, `estimate`
- [ ] Text styles: Display, H1, H2, Body, Caption (Geist หรือ Inter ชั่วคราว)
- [ ] Grid desktop 12 col / margin 24; mobile 4 col / margin 16
- [ ] เก็บ **copy deck** หน้าแรก: ไทยหลัก + คำ Meta (Ad Account, Custom Audience, Reach ฯลฯ)

---

## §1 — Foundations & Components (สอดคล้อง PR-1, PR-2)

### Colors & semantic

- [ ] Dark base ใกล้ prod ปัจจุบัน (#000 / #0f0f0f)
- [ ] สีสถานะ: ACTIVE, PAUSED, ERROR, DRAFT
- [ ] แยกสี **Meta estimate** กับ **Budget preview** (ไม่ใช้สีเดียวกัน)

### Atoms

- [ ] Button: primary / secondary / ghost / danger — default, hover, disabled, loading
- [ ] Input, Select, Textarea — default, focus, error
- [ ] Badge / StatusBadge (แคมเปญ, sync)
- [ ] Chip / Tag (filter, location TH)
- [ ] Checkbox, Toggle, Radio
- [ ] Icon button + tooltip label

### Molecules

- [ ] MetricCard (ตัวเลข + label + delta optional)
- [ ] FilterBar (chips + search + account filter)
- [ ] BulkActionBar (N selected + actions)
- [ ] ConnectionBanner (FB ไม่เชื่อม / token หมดอายุ)
- [ ] Toast / inline alert (success, error)

### Organisms

- [ ] **AppShell** — Sidebar + TopBar + AccountSwitcher slot
- [ ] **PageHeader** — title, subtitle, primary CTA
- [ ] **DataTable** — header, row, row actions `⋯`, empty row
- [ ] **Stepper** — 4 steps, current / complete / upcoming
- [ ] **TargetingPanel** — sections ไม่พับหมด: Location (open), Demographics, Interests, Custom audiences
- [ ] **EstimateStickyBar** — Meta DAU/MAU + loading + zero state copy
- [ ] Sheet / Drawer 720px (Ad Sets) — ไม่ใช้สำหรับ create หลัก

### Patterns

- [ ] Empty state template (icon + headline + CTA)
- [ ] Skeleton table / skeleton cards
- [ ] Error state (retry button)

**Gate PR-2:** Components ครบ atoms + organisms ที่ใช้ซ้ำ ≥ 80%

---

## §2 — App Shell (PR-1)

### Desktop 1440

- [ ] Sidebar: กลุ่ม HOME / ADS / AUTOMATION / EXPERIMENTS / INSIGHTS (ไม่มี Templates แยก)
- [ ] TopBar: `[ Ad Account ▼ ]` `[ Sync ]` `[ การแจ้งเตือน ]` `[ ออกจากระบบ ]`
- [ ] Account dropdown: รายการบัญชี + currency + “ทุกบัญชี” (ถ้ารองรับ)
- [ ] Nav active / hover states
- [ ] หน้าเมื่อ **ยังไม่เชื่อม Facebook** — banner เต็มความกว้าง

### Mobile 390

- [ ] Bottom nav หรือ hamburger → drawer nav (เลือก 1 แบบแล้ว prototype)
- [ ] Account switcher เข้าถึงได้จาก top
- [ ] ไม่มี sidebar แคบ 224px บน mobile

- [ ] Prototype: เปลี่ยน account → ข้อความบริบทเปลี่ยน (annotation)

---

## §3 — Overview `/dashboard` (PR-10)

### Desktop

- [ ] Connection card + ปุ่มเชื่อมต่อ Meta
- [ ] KPI 4 ใบ (บัญชี, แคมเปญ, active, spend)
- [ ] **Quick start checklist** 3 ขั้น (เชื่อม FB → sync → สร้างแคมเปญ)
- [ ] กราฟย่อ + ลิงก์ไป Analytics
- [ ] Warmup section (ถ้ายังใช้)

### Mobile

- [ ] KPI เป็น stack 2×2
- [ ] Checklist อ่านงานบนมือถือ

### States

- [ ] ไม่มีบัญชี / ไม่มีแคมเปญ
- [ ] กำลัง sync

---

## §4 — Campaigns Hub (PR-3) — สำคัญ

### Tab: แคมเปญทั้งหมด

**Desktop**

- [ ] Filter: บัญชี, สถานะ, objective, ค้นหา
- [ ] ตาราง: checkbox, ชื่อ, บัญชี, objective, status, งบ, ใช้จ่าย, `⋯`
- [ ] Bulk bar เมื่อเลือกหลายแถว
- [ ] Primary CTA: **+ สร้างแคมเปญ**
- [ ] แถวเปิด Ad Sets → Sheet (wireframe แยก frame)

**Mobile**

- [ ] ตาราง → **การ์ดแคมเปญ** (ชื่อ, status, งบ, ใช้จ่าย, actions)
- [ ] Filter เป็น bottom sheet หรือ horizontal chips
- [ ] FAB หรือ sticky bottom **สร้างแคมเปญ**

### Tab: เทมเพลต

- [ ] การ์ด template + ปุ่ม นำไปใช้ / แก้ไข / ลบ
- [ ] Empty: ยังไม่มีเทมเพลต

### States

- [ ] Loading skeleton
- [ ] Empty campaigns
- [ ] Error โหลดไม่สำเร็จ

---

## §5 — Create Campaign Stepper (PR-4–6) — Gate หลัก

> หน้าเต็ม `/dashboard/campaigns/create` — **ไม่ใช้ drawer 480px**

### ทุกขั้น (desktop + mobile)

- [ ] Stepper แสดง 4 ขั้น + ชื่อไทย
- [ ] ปุ่ม **ย้อนกลับ** / **ถัดไป** (mobile: sticky footer เต็มความกว้าง)
- [ ] แสดง Ad Account ที่เลือก (read-only ถ้า lock จาก global)

### ขั้น ① ตั้งค่า

- [ ] ชื่อแคมเปญ, Objective grid (ใกล้ Meta)
- [ ] Validation error ตัวอย่าง

### ขั้น ② งบประมาณ

- [ ] งบรายวัน (THB), สถานะ PAUSED/ACTIVE
- [ ] การ์ด **งบประมาณโดยประมาณ** (ไม่เขียนว่า Meta) — CPC/CPM/Reach สูตร UI
- [ ] ไม่มี Targeting ในขั้นนี้

### ขั้น ③ กลุ่มเป้าหมาย — แก้ pain เดิม

- [ ] Location **เปิดเสมอ** + chip **ประเทศไทย** default
- [ ] อายุ / เพศ
- [ ] ค้นหา Interests (placeholder ไทย)
- [ ] Custom Audience include/exclude list
- [ ] **Sticky Meta estimate:** `Reach รายวัน` / `รายเดือน` + loading
- [ ] Zero estimate: ข้อความ “เพิ่มประเทศหรือปรับกลุ่มเป้าหมาย”
- [ ] ไม่ใช้ accordion พับทุกส่วน

### ขั้น ④ โฆษณา (optional)

- [ ] Toggle สร้างโฆษณาตอนนี้
- [ ] ชื่อโฆษณา, ข้อความ, ลิงก์, อัปโหลดรูป
- [ ] คำเตือนลิงก์ไม่ใช่ permalink FB

### ขั้น สรุป

- [ ] สรุปทุกฟิลด์ก่อน Launch
- [ ] ปุ่ม **เผยแพร่ / สร้างแคมเปญ** + สถานะ paused default

### Mobile เฉพาะ

- [ ] Stepper แนวนอน scroll หรือแสดง “ขั้น 2/4”
- [ ] Targeting sections stack เต็มความกว้าง
- [ ] Estimate bar ไม่บังปุ่มถัดไป (safe area)

### Prototype (บังคับ)

- [ ] Flow: เปิด create → ครบ 4 ขั้น → สรุป (happy path)
- [ ] Flow: ขั้น ③ ไม่ใส่ประเทศ → เห็น zero estimate
- [ ] Flow: กลับจากขั้น ③ → ② คงค่า

**Gate PR-4:** §5 ติ๊กครบ desktop + mobile + 2 prototypes

---

## §6 — Audiences & Creatives (PR-9)

### Audiences

- [ ] Master-detail desktop / list-only → detail mobile
- [ ] สร้าง Custom + Lookalike flows
- [ ] อัปโหลด CSV + **ยืนยัน PDPA** (checkbox + copy)

### Creatives

- [ ] Grid การ์ด + สถานะ On Meta / ยังไม่ publish
- [ ] FB Publish: modal เลือกบัญชีโฆษณา
- [ ] Import จาก Page

---

## §7 — Automation (PR-8)

ใช้ **layout เดียวกัน** ทั้ง 3 หน้า (Rules, Schedules, Budget):

- [ ] ซ้าย: รายการ + toggle enabled
- [ ] ขวา: form แก้ไข / empty state
- [ ] Mobile: list full screen → tap → form full screen

- [ ] Rules: wizard สร้างใหม่ (scope → เงื่อนไข → action) — อย่างน้อย desktop wireframe

---

## §8 — Notifications & Analytics (PR-11)

### Notifications

- [ ] Tabs: ตั้งค่า | ประวัติ | Telegram
- [ ] Inbox unread

### Analytics

- [ ] Date range + account
- [ ] กราฟ + ตาราง rank แคมเปญ

---

## §9 — Auth (นอก dashboard)

- [ ] Login + Register (ไทย)
- [ ] Error network / invalid credentials

---

## §10 — Review gates (ก่อนส่งมอบ dev)

### Design review รอบ 1 (ภายใน)

- [ ] ทุกหน้าใน sidebar มี frame desktop **อย่างน้อย 1**
- [ ] Create flow มี mobile + prototype
- [ ] ไม่มีขั้นตอนที่ชื่อ “Budget” แต่มี targeting ซ่อนอยู่
- [ ] Copy แยก “งบประมาณโดยประมาณ” vs “Reach จาก Meta”

### Design review รอบ 2 (กับผู้ใช้/เจ้าของผลิตภัณฑ์)

- [ ] สร้างแคมเปญทำได้โดยไม่ถาม “estimate อยู่ไหน”
- [ ] บนมือถือกดถัดไปได้ไม่ติด estimate bar
- [ ] เทมเพลตหาได้จากแท็บแคมเปญ

### Handoff to code

- [ ] Export **spacing / color** spec (หรือ Dev Mode link)
- [ ] แนบ component mapping: Figma → `components/ui/*`
- [ ] รายการ **open questions** ปิดหมดหรือย้ายไป backlog
- [ ] อัปเดต `2026-06-04-ux-ui-redesign.md` ถ้ามีการเปลี่ยนระหว่าง Figma

---

## §11 — Mapping Figma → PR (สรุป)

| ติ๊กครบใน Figma | เริ่ม PR |
|-----------------|----------|
| §0–§1 | PR-1, PR-2 |
| §2 | PR-1 |
| §3 | PR-10 |
| §4 | PR-3 |
| §5 | PR-4, PR-5, PR-6, PR-12 |
| §6 | PR-9 |
| §7 | PR-8 |
| §8 | PR-11 |
| §10 handoff | ทุก PR ต่อจากนั้น |

---

## §12 — เวลาโดยประมาณ (แนะนำ)

| ช่วง | งาน | วัน (โฟกัส) |
|------|-----|-------------|
| 1 | Foundations + Components | 1–2 |
| 2 | Shell + Campaigns hub | 1 |
| 3 | Create stepper D+M + prototype | 2–3 |
| 4 | หน้าที่เหลือ + review | 1–2 |
| **รวม** | | **~5–8 วัน** |

---

## หมายเหตุ

- ไม่จำเป็นต้อง pixel-perfect ทุกหน้า — **§4–§5 ต้องละเอียด** ที่เหลือใช้ pattern ซ้ำได้
- ถ้าไม่มี Figma: ใช้ checklist นี้กับ FigJam หรือ wireframe ใน MD ก็ได้ แต่ควรมี prototype ขั้น create อย่างน้อย 1 แพลตฟอร์ม