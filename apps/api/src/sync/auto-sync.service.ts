import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookService } from '../facebook/facebook.service';
import { SyncService } from './sync.service';
import { InsightsService } from '../insights/insights.service';
import { InsightsAsyncService } from '../insights/insights-async.service';

@Injectable()
export class AutoSyncService {
  private readonly logger = new Logger(AutoSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => FacebookService))
    private readonly facebookService: FacebookService,
    @Inject(forwardRef(() => SyncService))
    private readonly syncService: SyncService,
    @Inject(forwardRef(() => InsightsService))
    private readonly insightsService: InsightsService,
    private readonly insightsAsync: InsightsAsyncService,
  ) {}

  /** Full ad account + campaign sync for every connected FB user (BullMQ every 15m). */
  async autoSyncCampaigns() {
    const fbUsers = await this.prisma.fbUser.findMany({ select: { id: true, userId: true } });

    let usersSynced = 0;
    for (const fbUser of fbUsers) {
      try {
        await this.syncService.syncAll(fbUser.userId, { source: 'auto' });
        usersSynced++;
      } catch (err: any) {
        this.logger.warn(`Auto campaign sync failed for user ${fbUser.userId}: ${err.message}`);
      }
    }

    if (usersSynced > 0) {
      this.logger.log(`Auto campaign sync completed for ${usersSynced} user(s)`);
    }
  }

  /** Sync yesterday insights hourly (lightweight GET, not manual 30d queue). */
  async autoSyncInsights() {
    const fbUsers = await this.prisma.fbUser.findMany({
      include: { adAccounts: true },
    });

    let total = 0;
    for (const fbUser of fbUsers) {
      for (const account of fbUser.adAccounts) {
        try {
          const accessToken = await this.facebookService.getDecryptedToken(fbUser.id);
          await this.insightsService.syncSingleAccountInsights(
            account.id,
            account.accountId,
            accessToken,
            'yesterday',
          );
          total++;
        } catch (err: any) {
          this.logger.warn(`Auto-insight sync failed for ${account.name}: ${err.message}`);
        }
      }
    }
    if (total > 0) {
      this.logger.log(`Auto-insight sync (yesterday) completed for ${total} account(s)`);
    }
  }

  /**
   * Queue last_30d + daily breakdown via async report runs (BullMQ insights-async poll).
   * Default schedule: every 6 hours — configurable via SYNC_INSIGHTS_30D_INTERVAL_MS.
   */
  async autoSyncInsights30d() {
    const fbUsers = await this.prisma.fbUser.findMany({
      include: { adAccounts: true },
    });

    let accountsQueued = 0;
    for (const fbUser of fbUsers) {
      const accessToken = await this.facebookService.getDecryptedToken(fbUser.id);
      for (const account of fbUser.adAccounts) {
        try {
          await this.insightsAsync.enqueueInsightsFetch(
            account.id,
            account.accountId,
            accessToken,
            fbUser.userId,
            { level: 'account', datePreset: 'last_30d', timeIncrement: 1 },
          );
          await this.insightsAsync.enqueueInsightsFetch(
            account.id,
            account.accountId,
            accessToken,
            fbUser.userId,
            { level: 'campaign', datePreset: 'last_30d', timeIncrement: 1 },
          );
          accountsQueued++;
        } catch (err: any) {
          this.logger.warn(
            `Auto 30d insights queue failed for ${account.name}: ${err.message}`,
          );
        }
      }

      if (fbUser.adAccounts.length > 0) {
        await this.prisma.activityLog.create({
          data: {
            userId: fbUser.userId,
            fbUserId: fbUser.id,
            action: 'INSIGHTS_AUTO_QUEUED',
            entityType: 'insights',
            entityId: 'all',
            metadata: {
              accountsQueued: fbUser.adAccounts.length,
              datePreset: 'last_30d',
              mode: 'async-bullmq',
            },
          },
        });
      }
    }

    if (accountsQueued > 0) {
      this.logger.log(
        `Auto 30d insights queued for ${accountsQueued} ad account(s) (poll jobs run in background)`,
      );
    }
  }
}