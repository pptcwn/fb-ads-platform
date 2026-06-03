import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookService } from '../facebook/facebook.service';
import { SyncService } from './sync.service';
import { InsightsService } from '../insights/insights.service';

@Injectable()
export class AutoSyncService {
  private readonly logger = new Logger(AutoSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly facebookService: FacebookService,
    private readonly syncService: SyncService,
    private readonly insightsService: InsightsService,
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
      this.logger.log(`Auto-insight sync completed for ${total} account(s)`);
    }
  }
}