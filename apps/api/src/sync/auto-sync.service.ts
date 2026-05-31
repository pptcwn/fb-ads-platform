import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookService } from '../facebook/facebook.service';
import { SyncService } from './sync.service';

@Injectable()
export class AutoSyncService {
  private readonly logger = new Logger(AutoSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly facebookService: FacebookService,
    private readonly syncService: SyncService,
  ) {}

  /** Sync campaigns every 15 minutes */
  @Cron('*/15 * * * *', { name: 'auto-sync-campaigns' })
  async autoSyncCampaigns() {
    const users = await this.prisma.user.findMany({
      include: { fbUsers: { include: { adAccounts: true } } },
    });

    let totalSynced = 0;
    for (const user of users) {
      for (const fbUser of user.fbUsers) {
        for (const account of fbUser.adAccounts) {
          try {
            const accessToken = await this.facebookService.getDecryptedToken(fbUser.id);
            const fbCampaigns = await this.facebookService.getFbCampaigns(
              account.accountId.replace('act_', ''),
              accessToken,
            );
            for (const camp of fbCampaigns) {
              await this.prisma.campaign.upsert({
                where: { campaignId: camp.id },
                create: {
                  campaignId: camp.id,
                  name: camp.name || '',
                  objective: (camp.objective || 'OUTCOME_TRAFFIC').replace(/-/g, '_').toUpperCase() as any,
                  status: (camp.status || 'PAUSED') as any,
                  dailyBudget: camp.daily_budget ? parseFloat(camp.daily_budget) / 100 : null,
                  adAccountId: account.id,
                },
                update: {
                  name: camp.name || '',
                  status: (camp.status || 'PAUSED') as any,
                  dailyBudget: camp.daily_budget ? parseFloat(camp.daily_budget) / 100 : null,
                  lastSyncedAt: new Date(),
                },
              });
              totalSynced++;
            }
          } catch (err: any) {
            this.logger.warn(`Auto-sync failed for ${account.name}: ${err.message}`);
          }
        }
      }
    }
    if (totalSynced > 0) {
      this.logger.log(`Auto-sync completed: ${totalSynced} campaigns synced`);
    }
  }

  /** Sync insights every hour */
  @Cron('0 * * * *', { name: 'auto-sync-insights' })
  async autoSyncInsights() {
    const users = await this.prisma.user.findMany({
      include: { fbUsers: { include: { adAccounts: true } } },
    });

    let total = 0;
    for (const user of users) {
      for (const fbUser of user.fbUsers) {
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
    }
    if (total > 0) {
      this.logger.log(`Auto-insight sync completed for ${total} accounts`);
    }
  }

  private async syncInsightsForAccount(accountId: string, fbAccountId: string, accessToken: string) {
    const baseUrl = 'https://graph.facebook.com/v20.0';
    const { default: axios } = await import('axios');
    const aid = fbAccountId.replace('act_', '');

    // Account-level
    try {
      const { data } = await axios.get(`${baseUrl}/act_${aid}/insights`, {
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
      const { data } = await axios.get(`${baseUrl}/act_${aid}/insights`, {
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
