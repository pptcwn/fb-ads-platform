# Backend Smoothness — Group B

**Date:** 2026-06-02  
**Scope:** FB API version centralization, bug fixes, conflict resolution, auto-sync optimization, BullMQ migration  
**Approach:** Fix in dependency order: B1 → B4 → B2 → B3 → B5

---

## Goals

1. **B1** — Centralize Facebook Graph API version via env var (v20.0 → v24.0)
2. **B4** — Fix 3 silent bugs: OUTCOME_REACH enum, timezone ignored, DAILY schedule double-fires
3. **B2** — Prevent 3 services from concurrently pausing/resuming the same campaign
4. **B3** — Fix auto-sync N+1 queries and status overwrite race condition
5. **B5** — Migrate cron jobs to BullMQ for distributed, retryable job execution

---

## B1: FB API Version Centralization

### Files
- `apps/api/src/facebook/facebook.service.ts`
- `apps/api/.env.example`

### Change

Replace hardcoded `v20.0` with a constant derived from env:

```ts
// facebook.service.ts top of file
const FB_API_VERSION = process.env.FB_API_VERSION ?? 'v24.0';
const FB_BASE_URL = `https://graph.facebook.com/${FB_API_VERSION}`;
const FB_OAUTH_URL = `https://www.facebook.com/${FB_API_VERSION}/dialog/oauth`;
```

Replace all occurrences of `https://graph.facebook.com/v20.0` and `https://www.facebook.com/v20.0` with the constants.

Add to `.env.example`:
```
FB_API_VERSION=v24.0
```

### Success Criteria
- No hardcoded `v20.0` anywhere in codebase
- Changing `FB_API_VERSION` env var changes all API calls

---

## B4: Bug Fixes

### B4a — OUTCOME_REACH Enum Bug

**File:** `apps/api/src/warmup/warmup.service.ts`

**Problem:** Warmup creates a campaign with objective `'OUTCOME_REACH'` which does not exist in the Prisma `CampaignObjective` enum → Prisma throws at runtime when saving warmup campaign.

**Fix:** Change `'OUTCOME_REACH'` to `'OUTCOME_AWARENESS'` (valid enum value).

```ts
// Before
objective: 'OUTCOME_REACH',
// After
objective: 'OUTCOME_AWARENESS',
```

### B4b — Timezone Ignored in BudgetService

**File:** `apps/api/src/budget/budget.service.ts`

**Problem:** `shouldRunNow()` accepts a `timezone` parameter but evaluates cron expressions in UTC only. User schedules set to `Asia/Bangkok` fire at wrong time.

**Fix:** Convert current UTC time to the schedule's timezone before evaluating hour/minute match using Node's `Intl.DateTimeFormat`:

```ts
function getNowInTimezone(tz: string): { hour: number; minute: number; dayOfWeek: number } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric', minute: 'numeric', weekday: 'short', hour12: false,
  }).formatToParts(now);
  return {
    hour: parseInt(parts.find(p => p.type === 'hour')!.value),
    minute: parseInt(parts.find(p => p.type === 'minute')!.value),
    dayOfWeek: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(parts.find(p => p.type === 'weekday')!.value),
  };
}
```

Pass `schedule.timezone ?? 'UTC'` into `shouldRunNow()` and use `getNowInTimezone()` instead of `new Date()` for hour/minute extraction.

### B4c — DAILY Schedule Double-Fire

**File:** `apps/api/src/schedules/schedules.service.ts`

**Problem:** The every-minute cron checks `HH:MM` match for DAILY/WEEKLY schedules but has no `lastRunAt` guard. A DAILY schedule set for `09:00` fires once per minute from `09:00:00` to `09:00:59` — up to 60 executions per day.

**Fix:** After successful execution, set `lastRunAt = new Date()`. Before executing DAILY schedules, check that `lastRunAt` is not from today (in the schedule's timezone). Before executing WEEKLY, check `lastRunAt` is not from this week.

```ts
// In checkAndRunSchedules(), for DAILY type:
if (schedule.lastRunAt) {
  const lastRun = new Date(schedule.lastRunAt);
  const today = new Date();
  if (lastRun.toDateString() === today.toDateString()) continue; // already ran today
}
// Execute...
await prisma.campaignSchedule.update({ where: { id: schedule.id }, data: { lastRunAt: new Date() } });
```

---

## B2: Conflict Resolution — Campaign Status Lock

### Files
- `apps/api/src/campaign-lock/campaign-lock.service.ts` (new)
- `apps/api/src/campaign-lock/campaign-lock.module.ts` (new)
- `apps/api/src/rules/rules-engine.service.ts` (modify)
- `apps/api/src/schedules/schedules.service.ts` (modify)
- `apps/api/src/budget/budget.service.ts` (modify)
- `apps/api/src/app.module.ts` (modify — import CampaignLockModule)

### Design

Use **Postgres advisory locks** via `pg_try_advisory_lock(bigint)`. No Redis required.

```ts
// campaign-lock.service.ts
@Injectable()
export class CampaignLockService {
  constructor(private prisma: PrismaService) {}

  async withCampaignLock<T>(
    campaignId: string,
    fn: () => Promise<T>,
    context: string,
  ): Promise<T | null> {
    // Convert campaign ID string to a stable bigint key
    const lockKey = this.toLockKey(campaignId);
    const [{ acquired }] = await this.prisma.$queryRaw<[{ acquired: boolean }]>`
      SELECT pg_try_advisory_lock(${lockKey}::bigint) AS acquired
    `;
    if (!acquired) {
      console.warn(`[CampaignLock] ${context}: campaign ${campaignId} locked by another process, skipping`);
      return null;
    }
    try {
      return await fn();
    } finally {
      await this.prisma.$queryRaw`SELECT pg_advisory_unlock(${lockKey}::bigint)`;
    }
  }

  private toLockKey(campaignId: string): bigint {
    // Hash string ID to a stable bigint using simple djb2
    let hash = 5381n;
    for (const c of campaignId) hash = ((hash << 5n) + hash + BigInt(c.charCodeAt(0))) & 0xFFFFFFFFFFFFFFFFn;
    return hash;
  }
}
```

### Usage in each service

```ts
// Example in rules-engine.service.ts
await this.campaignLock.withCampaignLock(
  campaignId,
  () => this.campaignsSvc.updateCampaignStatus(accountId, campaignId, 'PAUSED', userId),
  'RulesEngine',
);
```

### accountId empty string fix

All three services currently pass `''` as accountId to `updateCampaignStatus()`. Fix each call site to look up and pass the real `campaign.accountId` before calling.

### Success Criteria
- Two services attempting to pause the same campaign simultaneously: one executes, one logs warning and skips
- No empty string accountId passed to updateCampaignStatus()

---

## B3: Auto-Sync Optimization

### Files
- `apps/api/src/auto-sync/auto-sync.service.ts`
- `apps/api/prisma/schema.prisma` (add `statusOverriddenAt` field)
- `apps/api/src/schedules/schedules.service.ts` (set `statusOverriddenAt` on execute)
- `apps/api/src/budget/budget.service.ts` (set `statusOverriddenAt` on execute)
- `apps/api/src/rules/rules-engine.service.ts` (set `statusOverriddenAt` on execute)

### B3a — N+1 Fix

Replace nested loops in `autoSyncCampaigns()` and `autoSyncInsights()`:

```ts
// Before: users → fbUsers → adAccounts (3 queries per user)
// After: single query
const fbUsers = await this.prisma.fbUser.findMany({
  where: { adAccounts: { some: {} } },
  include: { adAccounts: true },
});
```

Batch process all accounts without extra queries per iteration.

### B3b — Sync Status Overwrite Prevention

**Problem:** Auto-sync overwrites a campaign status that was locally set by Rules/Schedules/Budget, because Facebook's API still returns the old status (propagation delay can be 1-5 minutes).

**Schema change:**
```prisma
model Campaign {
  // existing fields...
  statusOverriddenAt DateTime?  // set when a service locally changes status
}
```

**Sync logic:** When upserting campaign status from Facebook, skip the status field if `statusOverriddenAt` is within the last 10 minutes:

```ts
const campaign = await prisma.campaign.findUnique({ where: { fbCampaignId } });
const overrideRecent = campaign?.statusOverriddenAt &&
  (Date.now() - campaign.statusOverriddenAt.getTime()) < 10 * 60 * 1000;

await prisma.campaign.upsert({
  where: { fbCampaignId },
  update: {
    name: fbData.name,
    // Only update status if no recent local override
    ...(overrideRecent ? {} : { status: fbData.status }),
    lastSyncedAt: new Date(),
  },
  // ...
});
```

**Each service sets the override timestamp** when it changes campaign status:
```ts
await prisma.campaign.update({
  where: { id: campaignId },
  data: { status: newStatus, statusOverriddenAt: new Date() },
});
```

---

## B5: BullMQ Migration

### Files
- `apps/api/src/app.module.ts` (add BullModule.forRoot)
- `apps/api/src/sync/sync.module.ts` → `apps/api/src/sync/sync.processor.ts` (new)
- `apps/api/src/rules/rules.module.ts` → `apps/api/src/rules/rules.processor.ts` (new)
- `apps/api/src/warmup/warmup.module.ts` → `apps/api/src/warmup/warmup.processor.ts` (new)
- `apps/api/src/budget/budget.module.ts` → `apps/api/src/budget/budget.processor.ts` (new)
- `apps/api/src/schedules/schedules.module.ts` → `apps/api/src/schedules/schedules.processor.ts` (new)
- `apps/api/src/auto-sync/auto-sync.module.ts` → `apps/api/src/auto-sync/auto-sync.processor.ts` (new)
- Remove `@Cron()` decorators from all service files above

### Queue Names & Repeat Patterns

| Queue | Job name | Repeat |
|---|---|---|
| `sync` | `sync-campaigns` | every 15 min |
| `sync` | `sync-insights` | every 1 hour |
| `rules` | `evaluate-rules` | every 5 min |
| `warmup` | `advance-warmup` | every day at midnight UTC |
| `budget` | `run-budget-schedules` | every 1 hour |
| `schedules` | `run-campaign-schedules` | every 1 min |

### BullMQ Setup

**app.module.ts:**
```ts
BullModule.forRoot({
  connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
}),
```

**Per module (example: sync.module.ts):**
```ts
BullModule.registerQueue({ name: 'sync' }),
```

**Processor pattern (example: sync.processor.ts):**
```ts
@Processor('sync')
export class SyncProcessor extends WorkerHost {
  constructor(private syncService: SyncService) { super(); }

  async process(job: Job): Promise<void> {
    if (job.name === 'sync-campaigns') await this.syncService.syncAllCampaigns();
    if (job.name === 'sync-insights') await this.syncService.syncAllInsights();
  }
}
```

**Scheduler (registers repeating jobs on startup):**
```ts
@Injectable()
export class SyncScheduler implements OnModuleInit {
  constructor(@InjectQueue('sync') private queue: Queue) {}

  async onModuleInit() {
    await this.queue.add('sync-campaigns', {}, { repeat: { every: 15 * 60 * 1000 } });
    await this.queue.add('sync-insights', {}, { repeat: { every: 60 * 60 * 1000 } });
  }
}
```

### Retry Config
All jobs use:
```ts
{ attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
```

### Dependencies to install
`@nestjs/bullmq` is needed (wraps bullmq for NestJS DI). `bullmq` is already installed.
```bash
pnpm add @nestjs/bullmq --filter api
```

---

## 4. Files Changed Summary

| File | Change |
|---|---|
| `apps/api/src/facebook/facebook.service.ts` | Replace hardcoded v20.0 with env-var constant |
| `apps/api/.env.example` | Add `FB_API_VERSION=v24.0` |
| `apps/api/src/warmup/warmup.service.ts` | Fix OUTCOME_REACH → OUTCOME_AWARENESS |
| `apps/api/src/budget/budget.service.ts` | Fix timezone handling in shouldRunNow() |
| `apps/api/src/schedules/schedules.service.ts` | Add lastRunAt guard for DAILY/WEEKLY |
| `apps/api/src/campaign-lock/campaign-lock.service.ts` | New — Postgres advisory lock wrapper |
| `apps/api/src/campaign-lock/campaign-lock.module.ts` | New — module export |
| `apps/api/src/rules/rules-engine.service.ts` | Wrap status updates with campaign lock |
| `apps/api/src/budget/budget.service.ts` | Wrap status updates with campaign lock |
| `apps/api/src/schedules/schedules.service.ts` | Wrap status updates with campaign lock |
| `apps/api/prisma/schema.prisma` | Add `statusOverriddenAt DateTime?` to Campaign |
| `apps/api/src/auto-sync/auto-sync.service.ts` | Fix N+1, skip status if override recent |
| `apps/api/src/app.module.ts` | Add BullModule.forRoot, CampaignLockModule |
| `apps/api/src/sync/sync.processor.ts` | New BullMQ processor |
| `apps/api/src/rules/rules.processor.ts` | New BullMQ processor |
| `apps/api/src/warmup/warmup.processor.ts` | New BullMQ processor |
| `apps/api/src/budget/budget.processor.ts` | New BullMQ processor |
| `apps/api/src/schedules/schedules.processor.ts` | New BullMQ processor |
| `apps/api/src/auto-sync/auto-sync.processor.ts` | New BullMQ processor |

---

## 5. Out of Scope

- Retry logic for Facebook API HTTP calls (separate concern)
- Bull Dashboard UI (monitoring tool, separate setup)
- Tests (0 tests exist currently)
- Frontend changes

---

## 6. Success Criteria

- `FB_API_VERSION` env var controls all Facebook API calls
- Warmup service creates campaigns without Prisma enum error
- Budget schedules fire at correct local time per timezone
- DAILY schedules fire exactly once per day, not 60 times
- Two services cannot simultaneously change the same campaign's status
- Auto-sync uses 1 query instead of N+1
- Auto-sync does not overwrite locally-set status within 10 minutes
- All cron jobs run via BullMQ with retry on failure
- No duplicate job execution when running multiple API instances
