import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookService } from '../facebook/facebook.service';
import { SyncService } from './sync.service';
import { CampaignObjective } from '@prisma/client';

const FB_API_VERSION = (process.env.FB_API_VERSION?.trim() || 'v24.0');
const FB_BASE_URL = `https://graph.facebook.com/${FB_API_VERSION}`;
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

  private async syncInsightsForAccount(accountId: string, fbAccountId: string, accessToken: string) {
    const { default: axios } = await import('axios');
    const aid = fbAccountId.replace('act_', '');

    // Account-level
    try {
      const { data } = await axios.get(`${FB_BASE_URL}/act_${aid}/insights`, {
        params: {
          fields: 'impressions,clicks,ctr,cpc,cpm,spend,conversions,reach,frequency',
          level: 'account',
          date_preset: 'yesterday',
          access_token: accessToken,
        },
      });
      for (const row of data.data || []) {
        const date = new Date(row.date_start);
        await this.prisma.accountInsight.upsert({
          where: { adAccountId_date: { adAccountId: accountId, date } },
          create: {
            adAccountId: accountId, date,
            impressions: parseInt(row.impressions || '0'),
            clicks: parseInt(row.clicks || '0'),
            spend: parseFloat(row.spend || '0'),
            conversions: parseInt(row.conversions || '0'),
            ctr: parseFloat(row.ctr || '0'),
            cpc: parseFloat(row.cpc || '0'),
          },
          update: {
            impressions: parseInt(row.impressions || '0'),
            clicks: parseInt(row.clicks || '0'),
            spend: parseFloat(row.spend || '0'),
            conversions: parseInt(row.conversions || '0'),
            ctr: parseFloat(row.ctr || '0'),
            cpc: parseFloat(row.cpc || '0'),
          },
        });
      }
    } catch { /* skip if no data yet */ }

    // Campaign-level
    try {
      const { data } = await axios.get(`${FB_BASE_URL}/act_${aid}/insights`, {
        params: {
          fields: 'campaign_id,impressions,clicks,ctr,cpc,cpm,spend,conversions,reach,frequency',
          level: 'campaign',
          date_preset: 'yesterday',
          access_token: accessToken,
        },
      });
      for (const row of data.data || []) {
        if (!row.campaign_id) continue;
        const campaign = await this.prisma.campaign.findUnique({ where: { campaignId: row.campaign_id } });
        if (!campaign) continue;
        const date = new Date(row.date_start);
        await this.prisma.campaignInsight.upsert({
          where: { campaignId_date: { campaignId: campaign.id, date } },
          create: {
            campaignId: campaign.id, date,
            impressions: parseInt(row.impressions || '0'),
            clicks: parseInt(row.clicks || '0'),
            ctr: parseFloat(row.ctr || '0'),
            cpc: parseFloat(row.cpc || '0'),
            cpm: parseFloat(row.cpm || '0'),
            spend: parseFloat(row.spend || '0'),
            conversions: parseInt(row.conversions || '0'),
            reach: parseInt(row.reach || '0'),
            frequency: parseFloat(row.frequency || '0'),
          },
          update: {
            impressions: parseInt(row.impressions || '0'),
            clicks: parseInt(row.clicks || '0'),
            ctr: parseFloat(row.ctr || '0'),
            cpc: parseFloat(row.cpc || '0'),
            cpm: parseFloat(row.cpm || '0'),
            spend: parseFloat(row.spend || '0'),
            conversions: parseInt(row.conversions || '0'),
            reach: parseInt(row.reach || '0'),
            frequency: parseFloat(row.frequency || '0'),
          },
        });
      }
    } catch { /* skip */ }
  }
}
