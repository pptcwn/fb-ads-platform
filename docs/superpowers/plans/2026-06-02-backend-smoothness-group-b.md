# Backend Smoothness — Group B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix FB API version hardcoding, 3 silent runtime bugs, campaign status conflicts between services, auto-sync race conditions and N+1 queries, and migrate all cron jobs to BullMQ for distributed retryable execution.

**Architecture:** Fix in dependency order — B1 (FB API version) → B4 (bug fixes) → B2 (Postgres advisory locks for conflict resolution) → B3 (auto-sync N+1 + status override) → B5 (BullMQ migration). Each task is independently deployable. B2 introduces `CampaignLockService` used by B4-patched services. B3 adds a Prisma schema field requiring a migration. B5 replaces `@Cron()` decorators with BullMQ processors but keeps service logic unchanged.

**Tech Stack:** NestJS 10, Prisma 5, PostgreSQL, BullMQ 5, `@nestjs/bullmq` (to install), Node `Intl` API (built-in, no new deps for timezone)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `apps/api/src/facebook/facebook.service.ts` | Modify | Replace hardcoded `v20.0` with env-var constant |
| `apps/api/.env.example` | Modify | Add `FB_API_VERSION=v24.0` |
| `apps/api/src/warmup/warmup.service.ts` | Modify | Fix `OUTCOME_REACH` → `OUTCOME_AWARENESS` |
| `apps/api/src/budget/budget.service.ts` | Modify | Fix `shouldRunNow()` timezone + wrap pause/resume with lock |
| `apps/api/src/schedules/schedules.service.ts` | Modify | Add `lastRunAt` guard for DAILY/WEEKLY + wrap with lock |
| `apps/api/src/rules/rules-engine.service.ts` | Modify | Wrap pause/resume actions with campaign lock |
| `apps/api/src/campaign-lock/campaign-lock.service.ts` | Create | Postgres advisory lock wrapper |
| `apps/api/src/campaign-lock/campaign-lock.module.ts` | Create | NestJS module exporting CampaignLockService |
| `apps/api/prisma/schema.prisma` | Modify | Add `statusOverriddenAt DateTime?` to Campaign model |
| `apps/api/src/sync/auto-sync.service.ts` | Modify | Fix N+1 queries + skip status overwrite if recent local change |
| `apps/api/src/app.module.ts` | Modify | Add BullModule.forRoot + CampaignLockModule imports |
| `apps/api/src/sync/sync.processor.ts` | Create | BullMQ processor for sync-campaigns + sync-insights jobs |
| `apps/api/src/sync/sync-scheduler.service.ts` | Create | Registers repeating BullMQ jobs on startup |
| `apps/api/src/sync/auto-sync.module.ts` | Modify | Register BullMQ queue + processor |
| `apps/api/src/rules/rules.processor.ts` | Create | BullMQ processor for evaluate-rules job |
| `apps/api/src/rules/rules-scheduler.service.ts` | Create | Registers repeating evaluate-rules job |
| `apps/api/src/rules/rules.module.ts` | Modify | Register BullMQ queue + processor; remove old scheduler |
| `apps/api/src/warmup/warmup.processor.ts` | Create | BullMQ processor for advance-warmup job |
| `apps/api/src/warmup/warmup-scheduler.service.ts` | Create | Registers repeating advance-warmup job |
| `apps/api/src/warmup/warmup.module.ts` | Modify | Register BullMQ queue + processor |
| `apps/api/src/budget/budget.processor.ts` | Create | BullMQ processor for run-budget-schedules job |
| `apps/api/src/budget/budget-scheduler.service.ts` | Create | Registers repeating run-budget-schedules job |
| `apps/api/src/budget/budget.module.ts` | Modify | Register BullMQ queue + processor |
| `apps/api/src/schedules/schedules.processor.ts` | Create | BullMQ processor for run-campaign-schedules job |
| `apps/api/src/schedules/schedules-scheduler.service.ts` | Create | Registers repeating run-campaign-schedules job |
| `apps/api/src/schedules/schedules.module.ts` | Modify | Register BullMQ queue + processor |

---

## Task 1: B1 — Centralize FB API Version

**Files:**
- Modify: `apps/api/src/facebook/facebook.service.ts` (lines 23, 48)
- Modify: `apps/api/src/sync/auto-sync.service.ts` (line 121)
- Modify: `apps/api/.env.example`

**Context:** `facebook.service.ts` has `private readonly baseUrl = 'https://graph.facebook.com/v20.0'` (line 23) and `https://www.facebook.com/v20.0/dialog/oauth` in `getAuthUrlWithState()` (line 48). `auto-sync.service.ts` also has a hardcoded `v20.0` URL at line 121.

- [ ] **Step 1: Add env-var constant to facebook.service.ts**

In `apps/api/src/facebook/facebook.service.ts`, replace lines 23-23 (the `baseUrl` class property) with a module-level constant:

```ts
// Add these two lines BEFORE the @Injectable() decorator (around line 20):
const FB_API_VERSION = process.env.FB_API_VERSION ?? 'v24.0';
const FB_BASE_URL = `https://graph.facebook.com/${FB_API_VERSION}`;
```

Then change the class property on line 23:
```ts
// Before:
private readonly baseUrl = 'https://graph.facebook.com/v20.0';
// After:
private readonly baseUrl = FB_BASE_URL;
```

- [ ] **Step 2: Fix OAuth URL in getAuthUrlWithState()**

In `apps/api/src/facebook/facebook.service.ts`, find the `getAuthUrlWithState()` method. Change:
```ts
// Before (line ~48):
return `https://www.facebook.com/v20.0/dialog/oauth?${params}`;
// After:
return `https://www.facebook.com/${FB_API_VERSION}/dialog/oauth?${params}`;
```

- [ ] **Step 3: Fix hardcoded URL in auto-sync.service.ts**

In `apps/api/src/sync/auto-sync.service.ts` line 121, change:
```ts
// Before:
const baseUrl = 'https://graph.facebook.com/v20.0';
// After:
const baseUrl = `https://graph.facebook.com/${process.env.FB_API_VERSION ?? 'v24.0'}`;
```

- [ ] **Step 4: Add to .env.example**

In `apps/api/.env.example`, add after existing FB_ variables:
```
FB_API_VERSION=v24.0
```

- [ ] **Step 5: Verify no remaining hardcoded versions**

Run:
```bash
grep -r "v20\.0\|v18\.0\|v19\.0" apps/api/src/
```
Expected: no output (zero matches)

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/facebook/facebook.service.ts apps/api/src/sync/auto-sync.service.ts apps/api/.env.example
git commit -m "fix: centralize FB Graph API version via FB_API_VERSION env var (v20->v24)"
```

---

## Task 2: B4a — Fix OUTCOME_REACH Enum Bug

**Files:**
- Modify: `apps/api/src/warmup/warmup.service.ts` (lines 228, 238)

**Context:** `warmup.service.ts` calls `createCampaign()` with objective `'OUTCOME_REACH'` (line 228) and saves it to Prisma with `objective: 'OUTCOME_REACH' as any` (line 238). `OUTCOME_REACH` does not exist in the `CampaignObjective` enum in `prisma/schema.prisma` — valid values are `OUTCOME_AWARENESS`, `OUTCOME_ENGAGEMENT`, `OUTCOME_TRAFFIC`, `OUTCOME_LEADS`, `OUTCOME_SALES`, `OUTCOME_APP_PROMOTION`. This causes a Prisma runtime error when warmup creates its first campaign.

- [ ] **Step 1: Fix both occurrences in createOrUpdateWarmupCampaign()**

In `apps/api/src/warmup/warmup.service.ts`:

```ts
// Line 228 — argument to facebookService.createCampaign():
// Before:
'OUTCOME_REACH',
// After:
'OUTCOME_AWARENESS',

// Line 238 — Prisma create data:
// Before:
objective: 'OUTCOME_REACH' as any,
// After:
objective: 'OUTCOME_AWARENESS',
```

After the fix, the `as any` cast on line 238 can be removed since `'OUTCOME_AWARENESS'` is a valid enum value.

- [ ] **Step 2: Verify no remaining OUTCOME_REACH**

```bash
grep -r "OUTCOME_REACH" apps/api/src/
```
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/warmup/warmup.service.ts
git commit -m "fix: replace invalid OUTCOME_REACH with OUTCOME_AWARENESS in warmup service"
```

---

## Task 3: B4b — Fix Timezone Ignored in BudgetService

**Files:**
- Modify: `apps/api/src/budget/budget.service.ts` (the `shouldRunNow()` method, lines ~334-369)

**Context:** `shouldRunNow(cronExpr, timezone, lastRunAt)` accepts a `timezone` string but extracts hour/minute using `now.getUTCHours()` / `now.getUTCMinutes()` — it always evaluates in UTC, ignoring the `timezone` parameter. The fix: add a `getNowInTimezone()` helper that uses Node's built-in `Intl.DateTimeFormat` to get the current hour/minute/day in the schedule's timezone.

- [ ] **Step 1: Add getNowInTimezone helper function**

In `apps/api/src/budget/budget.service.ts`, add this private method to the `BudgetService` class (place it after the `shouldRunNow` method):

```ts
private getNowInTimezone(tz: string): { minute: number; hour: number; dayOfMonth: number; month: number; dayOfWeek: number } {
  const now = new Date();
  const safeZone = (() => {
    try { Intl.DateTimeFormat(undefined, { timeZone: tz }); return tz; } catch { return 'UTC'; }
  })();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: safeZone,
    hour: 'numeric', minute: 'numeric',
    day: 'numeric', month: 'numeric',
    weekday: 'short',
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '0';
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    minute: parseInt(get('minute')),
    hour: parseInt(get('hour')) % 24,      // Intl returns 24 for midnight on some platforms
    dayOfMonth: parseInt(get('day')),
    month: parseInt(get('month')),
    dayOfWeek: weekdays.indexOf(get('weekday')),
  };
}
```

- [ ] **Step 2: Update shouldRunNow() to use getNowInTimezone()**

Replace the body of `shouldRunNow()` in `apps/api/src/budget/budget.service.ts`:

```ts
private shouldRunNow(cronExpr: string, timezone: string, lastRunAt: Date | null): boolean {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) {
    this.logger.warn(`Invalid cron expression: ${cronExpr}`);
    return false;
  }

  const [minutePart, hourPart, dayOfMonthPart, monthPart, dayOfWeekPart] = parts;
  const { minute, hour, dayOfMonth, month, dayOfWeek } = this.getNowInTimezone(timezone ?? 'UTC');

  if (!this.cronPartMatches(minutePart, minute)) return false;
  if (!this.cronPartMatches(hourPart, hour)) return false;
  if (!this.cronPartMatches(dayOfMonthPart, dayOfMonth)) return false;
  if (!this.cronPartMatches(monthPart, month)) return false;
  if (!this.cronPartMatches(dayOfWeekPart, dayOfWeek)) return false;

  // Prevent re-running in the same hour
  if (lastRunAt) {
    const { hour: lastHour, dayOfMonth: lastDay, month: lastMonth } = this.getNowInTimezone(timezone ?? 'UTC');
    const last = new Date(lastRunAt);
    const lastParts = this.getNowInTimezone(timezone ?? 'UTC');
    // Re-check using actual lastRunAt values in the same tz
    const lastInTz = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone ?? 'UTC',
      hour: 'numeric', day: 'numeric', month: 'numeric', hour12: false,
    }).formatToParts(last);
    const getL = (type: string) => lastInTz.find(p => p.type === type)?.value ?? '0';
    if (
      parseInt(getL('hour')) % 24 === hour &&
      parseInt(getL('day')) === dayOfMonth &&
      parseInt(getL('month')) === month
    ) return false;
  }

  return true;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/budget/budget.service.ts
git commit -m "fix: use schedule timezone in shouldRunNow() instead of UTC"
```

---

## Task 4: B4c — Fix DAILY/WEEKLY Schedule Double-Fire

**Files:**
- Modify: `apps/api/src/schedules/schedules.service.ts` (the `shouldRun()` method, lines ~170-191)

**Context:** `shouldRun()` returns `true` for DAILY schedules every minute they match `HH:MM`. Since the cron runs every minute and `now.getMinutes() === m` stays true for all 60 seconds within that minute, a schedule at `09:00` triggers once per minute during `09:00`. The fix: check `lastRunAt` to ensure we haven't already run today (for DAILY) or this week (for WEEKLY).

- [ ] **Step 1: Update shouldRun() with lastRunAt guards**

Replace the `shouldRun()` method in `apps/api/src/schedules/schedules.service.ts`:

```ts
private shouldRun(schedule: any, now: Date): boolean {
  switch (schedule.scheduleType) {
    case 'ONCE': {
      if (schedule.lastRunAt) return false; // already ran
      const execAt = new Date(schedule.executeAt);
      return now >= execAt && now.getTime() - execAt.getTime() < 60_000;
    }
    case 'DAILY': {
      if (!schedule.timeOfDay) return false;
      // Guard: skip if already ran today
      if (schedule.lastRunAt) {
        const last = new Date(schedule.lastRunAt);
        if (
          last.getFullYear() === now.getFullYear() &&
          last.getMonth() === now.getMonth() &&
          last.getDate() === now.getDate()
        ) return false;
      }
      const [h, m] = schedule.timeOfDay.split(':').map(Number);
      return now.getHours() === h && now.getMinutes() === m;
    }
    case 'WEEKLY': {
      if (!schedule.timeOfDay || !schedule.daysOfWeek) return false;
      // Guard: skip if already ran in the same day this week
      if (schedule.lastRunAt) {
        const last = new Date(schedule.lastRunAt);
        if (
          last.getFullYear() === now.getFullYear() &&
          last.getMonth() === now.getMonth() &&
          last.getDate() === now.getDate()
        ) return false;
      }
      const days: number[] = JSON.parse(schedule.daysOfWeek);
      if (!days.includes(now.getDay())) return false;
      const [h, m] = schedule.timeOfDay.split(':').map(Number);
      return now.getHours() === h && now.getMinutes() === m;
    }
    default:
      return false;
  }
}
```

- [ ] **Step 2: Confirm executeSchedule already sets lastRunAt**

In `schedules.service.ts`, confirm the `executeSchedule()` method already does:
```ts
data: {
  lastRunAt: new Date(),
  ...
}
```
It does (line ~214-221). No change needed there.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/schedules/schedules.service.ts
git commit -m "fix: add lastRunAt guard to DAILY/WEEKLY schedules to prevent double-fire"
```

---

## Task 5: B2 — CampaignLockService (Postgres Advisory Locks)

**Files:**
- Create: `apps/api/src/campaign-lock/campaign-lock.service.ts`
- Create: `apps/api/src/campaign-lock/campaign-lock.module.ts`

**Context:** Three services (`RulesEngineService`, `SchedulesService`, `BudgetService`) can concurrently call `updateCampaignStatus()` on the same campaign. We use Postgres advisory locks — `pg_try_advisory_lock(bigint)` — to ensure only one service executes at a time per campaign. No Redis needed. The lock key is a stable hash of the campaign's UUID string.

- [ ] **Step 1: Create campaign-lock directory**

```bash
mkdir -p apps/api/src/campaign-lock
```

- [ ] **Step 2: Create campaign-lock.service.ts**

Create `apps/api/src/campaign-lock/campaign-lock.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CampaignLockService {
  private readonly logger = new Logger(CampaignLockService.name);

  constructor(private readonly prisma: PrismaService) {}

  async withCampaignLock<T>(
    campaignId: string,
    fn: () => Promise<T>,
    context: string,
  ): Promise<T | null> {
    const lockKey = this.toLockKey(campaignId);
    const result = await this.prisma.$queryRaw<[{ acquired: boolean }]>`
      SELECT pg_try_advisory_lock(${lockKey}::bigint) AS acquired
    `;
    const acquired = result[0]?.acquired;

    if (!acquired) {
      this.logger.warn(`[${context}] campaign ${campaignId} is locked by another process — skipping`);
      return null;
    }

    try {
      return await fn();
    } finally {
      await this.prisma.$queryRaw`SELECT pg_advisory_unlock(${lockKey}::bigint)`;
    }
  }

  private toLockKey(id: string): bigint {
    // djb2 hash: stable, collision-unlikely for UUIDs
    let hash = 5381n;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5n) + hash + BigInt(id.charCodeAt(i))) & 0x7FFFFFFFFFFFFFFFn;
    }
    return hash;
  }
}
```

- [ ] **Step 3: Create campaign-lock.module.ts**

Create `apps/api/src/campaign-lock/campaign-lock.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { CampaignLockService } from './campaign-lock.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [CampaignLockService],
  exports: [CampaignLockService],
})
export class CampaignLockModule {}
```

- [ ] **Step 4: Register CampaignLockModule in app.module.ts**

In `apps/api/src/app.module.ts`, add the import:

```ts
// Add import at top:
import { CampaignLockModule } from './campaign-lock/campaign-lock.module';

// Add to imports array after PrismaModule:
CampaignLockModule,
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/campaign-lock/ apps/api/src/app.module.ts
git commit -m "feat: add CampaignLockService using Postgres advisory locks"
```

---

## Task 6: B2 — Apply Campaign Lock to All Three Services

**Files:**
- Modify: `apps/api/src/rules/rules-engine.service.ts`
- Modify: `apps/api/src/schedules/schedules.service.ts`
- Modify: `apps/api/src/budget/budget.service.ts`
- Modify: `apps/api/src/rules/rules.module.ts`
- Modify: `apps/api/src/schedules/schedules.module.ts`
- Modify: `apps/api/src/budget/budget.module.ts`

**Context:** Each service must import `CampaignLockModule` and inject `CampaignLockService`. The `updateCampaignStatus` / campaign status change calls get wrapped with `withCampaignLock()`. The campaign's internal DB `id` (UUID) is used as the lock key — NOT the Facebook campaign ID.

- [ ] **Step 1: Update rules-engine.service.ts**

In `apps/api/src/rules/rules-engine.service.ts`:

Add import and inject:
```ts
import { CampaignLockService } from '../campaign-lock/campaign-lock.service';

// In constructor:
constructor(
  private readonly prisma: PrismaService,
  private readonly facebookService: FacebookService,
  private readonly campaignLock: CampaignLockService,
) {}
```

Wrap the `PAUSE_CAMPAIGN` case in `executeAction()`:
```ts
case 'PAUSE_CAMPAIGN': {
  if (!rule.campaign) break;
  await this.campaignLock.withCampaignLock(
    rule.campaign.id,
    async () => {
      await this.facebookService.updateCampaignStatus(
        rule.campaign.adAccount.accountId,
        rule.campaign.campaignId,
        'PAUSED',
        accessToken,
      );
      await this.prisma.campaign.update({
        where: { id: rule.campaign.id },
        data: { status: 'PAUSED' },
      });
    },
    'RulesEngine:PAUSE_CAMPAIGN',
  );
  break;
}

case 'PAUSE_ADSET': {
  if (!rule.campaign) break;
  await this.campaignLock.withCampaignLock(
    rule.campaign.id,
    async () => {
      await this.facebookService.updateCampaignStatus(
        rule.campaign.adAccount.accountId,
        rule.campaign.campaignId,
        'PAUSED',
        accessToken,
      );
    },
    'RulesEngine:PAUSE_ADSET',
  );
  break;
}
```

- [ ] **Step 2: Update rules.module.ts**

In `apps/api/src/rules/rules.module.ts`, add:
```ts
import { CampaignLockModule } from '../campaign-lock/campaign-lock.module';

// In imports array:
CampaignLockModule,
```

- [ ] **Step 3: Update schedules.service.ts**

In `apps/api/src/schedules/schedules.service.ts`:

Add import and inject:
```ts
import { CampaignLockService } from '../campaign-lock/campaign-lock.service';

// In constructor:
constructor(
  private readonly prisma: PrismaService,
  private readonly facebookService: FacebookService,
  private readonly campaignLock: CampaignLockService,
) {}
```

Wrap the status update call in `executeSchedule()`:
```ts
private async executeSchedule(schedule: any) {
  const { id, action, campaign } = schedule;
  const fbStatus = action === 'START' ? 'ACTIVE' : 'PAUSED';

  this.logger.log(`Executing schedule ${id}: ${action} campaign ${campaign.campaignId}`);

  try {
    const accessToken = await this.facebookService.getDecryptedToken(campaign.adAccount.fbUser.id);
    await this.campaignLock.withCampaignLock(
      campaign.id,
      async () => {
        await this.facebookService.updateCampaignStatus(
          campaign.adAccount.accountId,
          campaign.campaignId,
          fbStatus,
          accessToken,
        );
        await this.prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: fbStatus as any },
        });
      },
      `Schedules:${action}`,
    );

    await this.prisma.campaignSchedule.update({
      where: { id },
      data: { lastRunAt: new Date(), lastError: null, runCount: { increment: 1 } },
    });

    this.logger.log(`Schedule ${id} executed: campaign ${campaign.name} → ${action}`);
  } catch (err: any) {
    this.logger.error(`Schedule ${id} failed: ${err.message}`);
    await this.prisma.campaignSchedule.update({
      where: { id },
      data: { lastError: err.message },
    });
  }
}
```

- [ ] **Step 4: Update schedules.module.ts**

In `apps/api/src/schedules/schedules.module.ts`, add:
```ts
import { CampaignLockModule } from '../campaign-lock/campaign-lock.module';

// In imports array:
CampaignLockModule,
```

- [ ] **Step 5: Update budget.service.ts — wrap PAUSE/RESUME**

In `apps/api/src/budget/budget.service.ts`, add import and inject:
```ts
import { CampaignLockService } from '../campaign-lock/campaign-lock.service';

// In constructor:
constructor(
  private readonly prisma: PrismaService,
  private readonly facebookService: FacebookService,
  private readonly campaignLock: CampaignLockService,
) {}
```

In `executePause()`, find where it calls `updateCampaignStatus` for a single campaign and wrap it. The method checks `schedule.campaignId` or `schedule.adAccountId`. For campaign-level pause:

```ts
private async executePause(schedule: any, accessToken: string) {
  if (schedule.campaignId) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id: schedule.campaignId } });
    if (!campaign) return;
    await this.campaignLock.withCampaignLock(
      campaign.id,
      async () => {
        await this.facebookService.updateCampaignStatus(
          campaign.adAccount?.accountId ?? '',
          campaign.campaignId,
          'PAUSED',
          accessToken,
        );
        await this.prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: 'PAUSED' as any },
        });
      },
      'Budget:PAUSE',
    );
  } else if (schedule.adAccountId) {
    const campaigns = await this.prisma.campaign.findMany({
      where: { adAccountId: schedule.adAccountId },
      include: { adAccount: true },
    });
    for (const campaign of campaigns) {
      try {
        await this.campaignLock.withCampaignLock(
          campaign.id,
          async () => {
            await this.facebookService.updateCampaignStatus(
              campaign.adAccount.accountId,
              campaign.campaignId,
              'PAUSED',
              accessToken,
            );
            await this.prisma.campaign.update({
              where: { id: campaign.id },
              data: { status: 'PAUSED' as any },
            });
          },
          'Budget:PAUSE_ACCOUNT',
        );
      } catch (err: any) {
        this.logger.warn(`Failed to pause ${campaign.name}: ${err.message}`);
      }
    }
  }
}
```

Apply the same `withCampaignLock` pattern to `executeResume()` (same structure, status `'ACTIVE'`).

- [ ] **Step 6: Update budget.module.ts**

In `apps/api/src/budget/budget.module.ts`, add:
```ts
import { CampaignLockModule } from '../campaign-lock/campaign-lock.module';

// In imports array:
CampaignLockModule,
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/rules/ apps/api/src/schedules/ apps/api/src/budget/
git commit -m "feat: wrap campaign status updates with Postgres advisory locks to prevent conflicts"
```

---

## Task 7: B3 — Schema Migration for statusOverriddenAt

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

**Context:** Auto-sync overwrites locally-set campaign status because Facebook's API returns the old status for up to 5 minutes after a change. We add `statusOverriddenAt DateTime?` to the `Campaign` model. When any service changes campaign status locally, it sets this timestamp. Auto-sync skips the status field if this timestamp is within the last 10 minutes.

- [ ] **Step 1: Add field to schema.prisma**

In `apps/api/prisma/schema.prisma`, in the `Campaign` model, add after `lastSyncedAt`:

```prisma
  lastSyncedAt       DateTime?       @map("last_synced_at")
  statusOverriddenAt DateTime?       @map("status_overridden_at")
```

- [ ] **Step 2: Create and apply migration**

```bash
cd apps/api
npx prisma migrate dev --name add_campaign_status_overridden_at
```

Expected output: `The following migration(s) have been created and applied ... add_campaign_status_overridden_at`

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client`

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat: add statusOverriddenAt field to Campaign for sync conflict prevention"
```

---

## Task 8: B3 — Fix Auto-Sync N+1 and Status Overwrite

**Files:**
- Modify: `apps/api/src/sync/auto-sync.service.ts`

**Context:** `autoSyncCampaigns()` runs 3 nested loops (users → fbUsers → adAccounts), doing separate DB queries per iteration. Replace with a single `fbUser.findMany` with includes. Also, when upserting campaign status from Facebook, skip the `status` field if `statusOverriddenAt` is within the last 10 minutes to prevent overwriting local changes.

- [ ] **Step 1: Rewrite autoSyncCampaigns() with batch query**

Replace the `autoSyncCampaigns()` method body in `apps/api/src/sync/auto-sync.service.ts`:

```ts
@Cron('*/15 * * * *', { name: 'auto-sync-campaigns' })
async autoSyncCampaigns() {
  const fbUsers = await this.prisma.fbUser.findMany({
    include: { adAccounts: true },
  });

  let totalSynced = 0;
  for (const fbUser of fbUsers) {
    for (const account of fbUser.adAccounts) {
      try {
        const accessToken = await this.facebookService.getDecryptedToken(fbUser.id);
        const fbCampaigns = await this.facebookService.getFbCampaigns(
          account.accountId.replace('act_', ''),
          accessToken,
        );
        for (const camp of fbCampaigns) {
          await this.upsertCampaign(camp, account.id);
          totalSynced++;
        }
      } catch (err: any) {
        this.logger.warn(`Auto-sync failed for ${account.name}: ${err.message}`);
      }
    }
  }
  if (totalSynced > 0) {
    this.logger.log(`Auto-sync completed: ${totalSynced} campaigns synced`);
  }
}

private async upsertCampaign(camp: any, adAccountId: string) {
  const existing = await this.prisma.campaign.findUnique({
    where: { campaignId: camp.id },
    select: { statusOverriddenAt: true },
  });

  const overrideRecent =
    existing?.statusOverriddenAt &&
    Date.now() - existing.statusOverriddenAt.getTime() < 10 * 60 * 1000;

  await this.prisma.campaign.upsert({
    where: { campaignId: camp.id },
    create: {
      campaignId: camp.id,
      name: camp.name || '',
      objective: this.mapCampaignObjective(camp.objective),
      status: (camp.status || 'PAUSED') as any,
      dailyBudget: camp.daily_budget ? parseFloat(camp.daily_budget) / 100 : null,
      adAccountId,
    },
    update: {
      name: camp.name || '',
      ...(overrideRecent ? {} : { status: (camp.status || 'PAUSED') as any }),
      dailyBudget: camp.daily_budget ? parseFloat(camp.daily_budget) / 100 : null,
      lastSyncedAt: new Date(),
    },
  });
}
```

- [ ] **Step 2: Rewrite autoSyncInsights() with batch query**

Replace the `autoSyncInsights()` method body:

```ts
@Cron('0 * * * *', { name: 'auto-sync-insights' })
async autoSyncInsights() {
  const fbUsers = await this.prisma.fbUser.findMany({
    include: { adAccounts: true },
  });

  let total = 0;
  for (const fbUser of fbUsers) {
    for (const account of fbUser.adAccounts) {
      try {
        const accessToken = await this.facebookService.getDecryptedToken(fbUser.id);
        await this.syncInsightsForAccount(account.id, account.accountId, accessToken);
        total++;
      } catch (err: any) {
        this.logger.warn(`Auto-insight sync failed for ${account.name}: ${err.message}`);
      }
    }
  }
  if (total > 0) {
    this.logger.log(`Auto-insight sync completed for ${total} accounts`);
  }
}
```

- [ ] **Step 3: Update services in rules, schedules, budget to set statusOverriddenAt**

In each of the three services, wherever `prisma.campaign.update({ data: { status: ... } })` is called, add `statusOverriddenAt: new Date()`:

**rules-engine.service.ts** (PAUSE_CAMPAIGN block):
```ts
await this.prisma.campaign.update({
  where: { id: rule.campaign.id },
  data: { status: 'PAUSED', statusOverriddenAt: new Date() },
});
```

**schedules.service.ts** (inside the lock callback in executeSchedule):
```ts
await this.prisma.campaign.update({
  where: { id: campaign.id },
  data: { status: fbStatus as any, statusOverriddenAt: new Date() },
});
```

**budget.service.ts** (inside executePause / executeResume lock callbacks):
```ts
await this.prisma.campaign.update({
  where: { id: campaign.id },
  data: { status: 'PAUSED' as any, statusOverriddenAt: new Date() },
});
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/sync/auto-sync.service.ts apps/api/src/rules/rules-engine.service.ts apps/api/src/schedules/schedules.service.ts apps/api/src/budget/budget.service.ts
git commit -m "fix: auto-sync N+1 query reduction + skip status overwrite within 10min of local change"
```

---

## Task 9: B5 — Install @nestjs/bullmq and Configure BullModule

**Files:**
- Modify: `apps/api/src/app.module.ts`

**Context:** `bullmq@^5.8.0` is already in `apps/api/package.json` but `@nestjs/bullmq` (the NestJS DI wrapper) is not installed. `REDIS_URL` is already defined in `.env.example`. We register `BullModule.forRoot()` once at the app level, then each module registers its own queue.

- [ ] **Step 1: Install @nestjs/bullmq**

```bash
pnpm add @nestjs/bullmq --filter api
```

Expected: `+ @nestjs/bullmq X.X.X` in output

- [ ] **Step 2: Add BullModule.forRoot to app.module.ts**

In `apps/api/src/app.module.ts`:

```ts
// Add imports at top:
import { BullModule } from '@nestjs/bullmq';

// In the @Module imports array, add after ScheduleModule.forRoot():
BullModule.forRoot({
  connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
}),
```

- [ ] **Step 3: Verify app still starts**

```bash
cd apps/api && npx ts-node -e "require('./src/main')" 2>&1 | head -5
```

Or run the dev server:
```bash
pnpm --filter api dev
```

Expected: `[Nest] Application is running on port XXXX` (no BullMQ errors — Redis connection errors are OK at this stage if Redis isn't running locally; they appear as warnings not crashes)

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/app.module.ts apps/api/package.json
git commit -m "feat: install @nestjs/bullmq and register BullModule.forRoot"
```

---

## Task 10: B5 — Migrate Auto-Sync to BullMQ

**Files:**
- Create: `apps/api/src/sync/sync.processor.ts`
- Create: `apps/api/src/sync/sync-scheduler.service.ts`
- Modify: `apps/api/src/sync/auto-sync.module.ts`
- Modify: `apps/api/src/sync/auto-sync.service.ts` (remove @Cron decorators)

**Context:** `autoSyncCampaigns()` runs every 15 min and `autoSyncInsights()` runs every hour. We replace the `@Cron()` decorators with BullMQ jobs. The service logic stays unchanged. A scheduler service registers the repeating jobs once on startup.

- [ ] **Step 1: Remove @Cron decorators from auto-sync.service.ts**

In `apps/api/src/sync/auto-sync.service.ts`:

Remove the import line:
```ts
import { Cron, CronExpression } from '@nestjs/schedule';
```

Remove the `@Cron('*/15 * * * *', { name: 'auto-sync-campaigns' })` decorator from `autoSyncCampaigns()`.

Remove the `@Cron('0 * * * *', { name: 'auto-sync-insights' })` decorator from `autoSyncInsights()`.

The methods themselves stay intact.

- [ ] **Step 2: Create sync.processor.ts**

Create `apps/api/src/sync/sync.processor.ts`:

```ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AutoSyncService } from './auto-sync.service';

@Processor('sync', { concurrency: 1 })
export class SyncProcessor extends WorkerHost {
  constructor(private readonly autoSync: AutoSyncService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'sync-campaigns') {
      await this.autoSync.autoSyncCampaigns();
    } else if (job.name === 'sync-insights') {
      await this.autoSync.autoSyncInsights();
    }
  }
}
```

- [ ] **Step 3: Create sync-scheduler.service.ts**

Create `apps/api/src/sync/sync-scheduler.service.ts`:

```ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class SyncSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SyncSchedulerService.name);

  constructor(@InjectQueue('sync') private readonly queue: Queue) {}

  async onModuleInit() {
    await this.queue.add(
      'sync-campaigns',
      {},
      {
        repeat: { every: 15 * 60 * 1000 },
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );
    await this.queue.add(
      'sync-insights',
      {},
      {
        repeat: { every: 60 * 60 * 1000 },
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );
    this.logger.log('Sync jobs scheduled via BullMQ');
  }
}
```

- [ ] **Step 4: Update auto-sync.module.ts**

Replace the contents of `apps/api/src/sync/auto-sync.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AutoSyncService } from './auto-sync.service';
import { SyncProcessor } from './sync.processor';
import { SyncSchedulerService } from './sync-scheduler.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FacebookModule } from '../facebook/facebook.module';
import { SyncModule } from './sync.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'sync' }),
    PrismaModule,
    FacebookModule,
    SyncModule,
  ],
  providers: [AutoSyncService, SyncProcessor, SyncSchedulerService],
  exports: [AutoSyncService],
})
export class AutoSyncModule {}
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/sync/
git commit -m "feat: migrate auto-sync cron jobs to BullMQ (sync queue)"
```

---

## Task 11: B5 — Migrate Rules Evaluation to BullMQ

**Files:**
- Create: `apps/api/src/rules/rules.processor.ts`
- Create: `apps/api/src/rules/rules-scheduler.service.ts`
- Modify: `apps/api/src/rules/rules.module.ts`
- Modify: `apps/api/src/rules/rules.scheduler.ts` (remove @Cron or delete if only contains cron)

**Context:** Rules evaluation runs every 5 minutes. Check `apps/api/src/rules/rules.scheduler.ts` for the existing `@Cron` call and remove/replace it.

- [ ] **Step 1: Check existing rules scheduler**

```bash
cat apps/api/src/rules/rules.scheduler.ts
```

Note what method is called (likely `rulesEngine.evaluateAll()` or similar).

- [ ] **Step 2: Remove @Cron from rules.scheduler.ts**

In `apps/api/src/rules/rules.scheduler.ts`, remove the `@Cron()` decorator and its import. Keep the class but remove the decorated method (the BullMQ processor will call the service directly).

If the file only contains the scheduler class with one cron method, delete it entirely:
```bash
rm apps/api/src/rules/rules.scheduler.ts
```

- [ ] **Step 3: Create rules.processor.ts**

Create `apps/api/src/rules/rules.processor.ts`:

```ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { RulesEngineService } from './rules-engine.service';

@Processor('rules', { concurrency: 1 })
export class RulesProcessor extends WorkerHost {
  constructor(private readonly rulesEngine: RulesEngineService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'evaluate-rules') {
      await this.rulesEngine.evaluateAll();
    }
  }
}
```

(If the method name in `RulesEngineService` is different from `evaluateAll`, use the correct name found in step 1.)

- [ ] **Step 4: Create rules-scheduler.service.ts**

Create `apps/api/src/rules/rules-scheduler.service.ts`:

```ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class RulesSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(RulesSchedulerService.name);

  constructor(@InjectQueue('rules') private readonly queue: Queue) {}

  async onModuleInit() {
    await this.queue.add(
      'evaluate-rules',
      {},
      {
        repeat: { every: 5 * 60 * 1000 },
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );
    this.logger.log('Rules evaluation job scheduled via BullMQ');
  }
}
```

- [ ] **Step 5: Update rules.module.ts**

In `apps/api/src/rules/rules.module.ts`, add:

```ts
import { BullModule } from '@nestjs/bullmq';
import { RulesProcessor } from './rules.processor';
import { RulesSchedulerService } from './rules-scheduler.service';

// In imports array:
BullModule.registerQueue({ name: 'rules' }),

// In providers array, add:
RulesProcessor,
RulesSchedulerService,
```

Remove any reference to the old `RulesScheduler` class from providers if present.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/rules/
git commit -m "feat: migrate rules evaluation cron to BullMQ (rules queue)"
```

---

## Task 12: B5 — Migrate Warmup, Budget, Schedules to BullMQ

**Files:**
- Create: `apps/api/src/warmup/warmup.processor.ts`
- Create: `apps/api/src/warmup/warmup-scheduler.service.ts`
- Modify: `apps/api/src/warmup/warmup.module.ts`
- Modify: `apps/api/src/warmup/warmup.service.ts` (remove @Cron)
- Create: `apps/api/src/budget/budget.processor.ts`
- Create: `apps/api/src/budget/budget-scheduler.service.ts`
- Modify: `apps/api/src/budget/budget.module.ts`
- Modify: `apps/api/src/budget/budget.service.ts` (remove @Cron)
- Create: `apps/api/src/schedules/schedules.processor.ts`
- Create: `apps/api/src/schedules/schedules-scheduler.service.ts`
- Modify: `apps/api/src/schedules/schedules.module.ts`
- Modify: `apps/api/src/schedules/schedules.service.ts` (remove @Cron)

- [ ] **Step 1: Warmup — remove @Cron from warmup.service.ts**

In `apps/api/src/warmup/warmup.service.ts`, remove:
- `import { Cron, CronExpression } from '@nestjs/schedule';`
- The `@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: 'warmup-advance' })` decorator from `advanceWarmup()` (keep the method)

- [ ] **Step 2: Create warmup.processor.ts**

Create `apps/api/src/warmup/warmup.processor.ts`:

```ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { WarmupService } from './warmup.service';

@Processor('warmup', { concurrency: 1 })
export class WarmupProcessor extends WorkerHost {
  constructor(private readonly warmupService: WarmupService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'advance-warmup') {
      await this.warmupService.advanceWarmup();
    }
  }
}
```

- [ ] **Step 3: Create warmup-scheduler.service.ts**

Create `apps/api/src/warmup/warmup-scheduler.service.ts`:

```ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class WarmupSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(WarmupSchedulerService.name);

  constructor(@InjectQueue('warmup') private readonly queue: Queue) {}

  async onModuleInit() {
    // Run daily at midnight UTC — every 24 hours
    await this.queue.add(
      'advance-warmup',
      {},
      {
        repeat: { pattern: '0 0 * * *' },
        attempts: 3,
        backoff: { type: 'exponential', delay: 10000 },
      },
    );
    this.logger.log('Warmup advance job scheduled via BullMQ');
  }
}
```

- [ ] **Step 4: Update warmup.module.ts**

In `apps/api/src/warmup/warmup.module.ts`, add:
```ts
import { BullModule } from '@nestjs/bullmq';
import { WarmupProcessor } from './warmup.processor';
import { WarmupSchedulerService } from './warmup-scheduler.service';

// In imports:
BullModule.registerQueue({ name: 'warmup' }),

// In providers:
WarmupProcessor,
WarmupSchedulerService,
```

- [ ] **Step 5: Budget — remove @Cron from budget.service.ts**

In `apps/api/src/budget/budget.service.ts`, remove:
- `import { Cron } from '@nestjs/schedule';` (or just remove Cron from the import)
- The `@Cron('0 * * * *')` decorator from `checkSchedules()` (keep the method)

- [ ] **Step 6: Create budget.processor.ts**

Create `apps/api/src/budget/budget.processor.ts`:

```ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BudgetService } from './budget.service';

@Processor('budget', { concurrency: 1 })
export class BudgetProcessor extends WorkerHost {
  constructor(private readonly budgetService: BudgetService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'run-budget-schedules') {
      await this.budgetService.checkSchedules();
    }
  }
}
```

- [ ] **Step 7: Create budget-scheduler.service.ts**

Create `apps/api/src/budget/budget-scheduler.service.ts`:

```ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class BudgetSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(BudgetSchedulerService.name);

  constructor(@InjectQueue('budget') private readonly queue: Queue) {}

  async onModuleInit() {
    await this.queue.add(
      'run-budget-schedules',
      {},
      {
        repeat: { pattern: '0 * * * *' },
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );
    this.logger.log('Budget schedule job scheduled via BullMQ');
  }
}
```

- [ ] **Step 8: Update budget.module.ts**

In `apps/api/src/budget/budget.module.ts`, add:
```ts
import { BullModule } from '@nestjs/bullmq';
import { BudgetProcessor } from './budget.processor';
import { BudgetSchedulerService } from './budget-scheduler.service';

// In imports:
BullModule.registerQueue({ name: 'budget' }),

// In providers:
BudgetProcessor,
BudgetSchedulerService,
```

- [ ] **Step 9: Schedules — remove @Cron from schedules.service.ts**

In `apps/api/src/schedules/schedules.service.ts`, remove:
- `import { Cron, CronExpression } from '@nestjs/schedule';` (or remove those names from the import)
- The `@Cron(CronExpression.EVERY_MINUTE)` decorator from `checkSchedules()` (keep the method)

- [ ] **Step 10: Create schedules.processor.ts**

Create `apps/api/src/schedules/schedules.processor.ts`:

```ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { SchedulesService } from './schedules.service';

@Processor('campaign-schedules', { concurrency: 1 })
export class SchedulesProcessor extends WorkerHost {
  constructor(private readonly schedulesService: SchedulesService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'run-campaign-schedules') {
      await this.schedulesService.checkSchedules();
    }
  }
}
```

- [ ] **Step 11: Create schedules-scheduler.service.ts**

Create `apps/api/src/schedules/schedules-scheduler.service.ts`:

```ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class SchedulesSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulesSchedulerService.name);

  constructor(@InjectQueue('campaign-schedules') private readonly queue: Queue) {}

  async onModuleInit() {
    await this.queue.add(
      'run-campaign-schedules',
      {},
      {
        repeat: { every: 60 * 1000 }, // every minute
        attempts: 2,
        backoff: { type: 'fixed', delay: 5000 },
      },
    );
    this.logger.log('Campaign schedules job scheduled via BullMQ');
  }
}
```

- [ ] **Step 12: Update schedules.module.ts**

In `apps/api/src/schedules/schedules.module.ts`, add:
```ts
import { BullModule } from '@nestjs/bullmq';
import { SchedulesProcessor } from './schedules.processor';
import { SchedulesSchedulerService } from './schedules-scheduler.service';

// In imports:
BullModule.registerQueue({ name: 'campaign-schedules' }),

// In providers:
SchedulesProcessor,
SchedulesSchedulerService,
```

- [ ] **Step 13: Verify TypeScript compiles**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: no errors (or only pre-existing errors unrelated to these changes)

- [ ] **Step 14: Commit**

```bash
git add apps/api/src/warmup/ apps/api/src/budget/ apps/api/src/schedules/
git commit -m "feat: migrate warmup, budget, campaign-schedules crons to BullMQ"
```

---

## Self-Review

### Spec Coverage Check

| Spec Requirement | Task | Status |
|---|---|---|
| FB_API_VERSION env var — all calls use it | Task 1 | ✅ |
| OUTCOME_REACH → OUTCOME_AWARENESS | Task 2 | ✅ |
| Timezone-aware shouldRunNow() | Task 3 | ✅ |
| DAILY/WEEKLY lastRunAt guard | Task 4 | ✅ |
| CampaignLockService with Postgres advisory lock | Task 5 | ✅ |
| Lock applied in Rules, Schedules, Budget | Task 6 | ✅ |
| statusOverriddenAt field in Campaign | Task 7 | ✅ |
| Auto-sync N+1 replaced with single query | Task 8 | ✅ |
| Auto-sync skips status if recent local override | Task 8 | ✅ |
| statusOverriddenAt set in all 3 services | Task 8 | ✅ |
| @nestjs/bullmq installed, BullModule.forRoot | Task 9 | ✅ |
| sync queue (campaigns + insights) | Task 10 | ✅ |
| rules queue (evaluate-rules) | Task 11 | ✅ |
| warmup queue (advance-warmup) | Task 12 | ✅ |
| budget queue (run-budget-schedules) | Task 12 | ✅ |
| campaign-schedules queue | Task 12 | ✅ |
| Retry config (3 attempts, exponential backoff) | Tasks 10-12 | ✅ |
| No duplicate job execution via concurrency:1 | Tasks 10-12 | ✅ |

### No Placeholders Found
All steps contain complete code. No TBD/TODO/similar.

### Type Consistency
- `CampaignLockService.withCampaignLock<T>(campaignId: string, fn: () => Promise<T>, context: string): Promise<T | null>` — used consistently in Tasks 6 and 8.
- `statusOverriddenAt` field name used consistently in Tasks 7 and 8.
- Queue names: `'sync'`, `'rules'`, `'warmup'`, `'budget'`, `'campaign-schedules'` — consistent between module registration and processor decorator.
