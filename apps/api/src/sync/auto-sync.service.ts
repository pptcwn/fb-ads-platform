import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookService } from '../facebook/facebook.service';
import { SyncService } from './sync.service';
import { CampaignObjective } from '@prisma/client';
import { InsightsService } from '../insights/insights.service';
const STATUS_OVERRIDE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

@Injectable()
export class AutoSyncService {
  private readonly logger = new Logger(AutoSyncService.name);

  private mapCampaignObjective(obj: string | null | undefined): CampaignObjective {
    const map: Record<string, CampaignObjective> = {
      OUTCOME_AWARENESS: 'OUTCOME_AWARENESS',
      OUTCOME_ENGAGEMENT: 'OUTCOME_ENGAGEMENT',
      OUTCOME_TRAFFIC: 'OUTCOME_TRAFFIC',
      OUTCOME_LEADS: 'OUTCOME_LEADS',
      OUTCOME_SALES: 'OUTCOME_SALES',
      OUTCOME_APP_PROMOTION: 'OUTCOME_APP_PROMOTION',
      BRAND_AWARENESS: 'OUTCOME_AWARENESS',
      REACH: 'OUTCOME_AWARENESS',
      PAGE_LIKES: 'OUTCOME_ENGAGEMENT',
      POST_ENGAGEMENT: 'OUTCOME_ENGAGEMENT',
      VIDEO_VIEWS: 'OUTCOME_ENGAGEMENT',
      EVENT_RESPONSES: 'OUTCOME_ENGAGEMENT',
      MESSAGES: 'OUTCOME_ENGAGEMENT',
      LINK_CLICKS: 'OUTCOME_TRAFFIC',
      TRAFFIC: 'OUTCOME_TRAFFIC',
      STORE_VISITS: 'OUTCOME_TRAFFIC',
      LEAD_GENERATION: 'OUTCOME_LEADS',
      CONVERSIONS: 'OUTCOME_SALES',
      VALUE: 'OUTCOME_SALES',
      PRODUCT_CATALOG_SALES: 'OUTCOME_SALES',
      APP_INSTALLS: 'OUTCOME_APP_PROMOTION',
    };
    const key = (obj || '').replace(/-/g, '_').toUpperCase();
    return map[key] || 'OUTCOME_TRAFFIC';
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly facebookService: FacebookService,
    private readonly syncService: SyncService,
    private readonly insightsService: InsightsService,
  ) {}

  /** Sync campaigns every 15 minutes */
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
      existing?.statusOverriddenAt != null &&
      Date.now() - existing.statusOverriddenAt.getTime() < STATUS_OVERRIDE_WINDOW_MS;

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

  /** Sync insights every hour */
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
      this.logger.log(`Auto-insight sync completed for ${total} accounts`);
    }
  }

}
