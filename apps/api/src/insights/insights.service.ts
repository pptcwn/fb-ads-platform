import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookService } from '../facebook/facebook.service';

interface FBInsightRow {
  campaign_id?: string;
  campaign_name?: string;
  date_start: string;
  date_stop: string;
  impressions: string;
  clicks: string;
  ctr: string;
  cpc: string;
  cpm: string;
  spend: string;
  conversions?: string;
  cpa?: string;
  reach?: string;
  frequency?: string;
  roas?: string;
  actions?: Array<{ action_type: string; value: string; '1d_click'?: string }>;
}

interface FBPage<T> {
  data: T[];
  paging?: { cursors: { before: string; after: string }; next?: string };
}

const FB_API_VERSION = (process.env.FB_API_VERSION?.trim() || 'v24.0');
const FB_BASE_URL = `https://graph.facebook.com/${FB_API_VERSION}`;

@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name);
  private readonly baseUrl = FB_BASE_URL;

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly facebookService: FacebookService,
  ) {}

  async syncInsights(userId: string, adAccountId?: string) {
    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId } });
    if (!fbUser) throw new NotFoundException('Facebook account not connected');

    const accessToken = await this.facebookService.getDecryptedToken(fbUser.id);

    // Get accounts to sync
    const where = { fbUser: { userId } } as any;
    if (adAccountId) where.id = adAccountId;
    const accounts = await this.prisma.adAccount.findMany({ where });

    if (accounts.length === 0) throw new NotFoundException('No ad accounts found');

    let campaignsUpdated = 0;
    let accountRows = 0;

    for (const account of accounts) {
      // --- Account-level insights ---
      const acctInsights = await this.fetchInsights(account.accountId, accessToken, 'account');
      for (const row of acctInsights) {
        const date = new Date(row.date_start);
        await this.prisma.accountInsight.upsert({
          where: { adAccountId_date: { adAccountId: account.id, date } },
          create: {
            adAccountId: account.id,
            date,
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
        accountRows++;
      }

      // --- Campaign-level insights ---
      const campInsights = await this.fetchInsights(account.accountId, accessToken, 'campaign');
      for (const row of campInsights) {
        if (!row.campaign_id) continue;
        const campaign = await this.prisma.campaign.findUnique({
          where: { campaignId: row.campaign_id },
        });
        if (!campaign) continue;

        const date = new Date(row.date_start);
        await this.prisma.campaignInsight.upsert({
          where: { campaignId_date: { campaignId: campaign.id, date } },
          create: {
            campaignId: campaign.id,
            date,
            impressions: parseInt(row.impressions || '0'),
            clicks: parseInt(row.clicks || '0'),
            ctr: parseFloat(row.ctr || '0'),
            cpc: parseFloat(row.cpc || '0'),
            cpm: parseFloat(row.cpm || '0'),
            spend: parseFloat(row.spend || '0'),
            conversions: parseInt(row.conversions || '0'),
            cpa: row.cpa ? parseFloat(row.cpa) : null,
            reach: parseInt(row.reach || '0'),
            frequency: parseFloat(row.frequency || '0'),
            roas: row.roas ? parseFloat(row.roas) : null,
          },
          update: {
            impressions: parseInt(row.impressions || '0'),
            clicks: parseInt(row.clicks || '0'),
            ctr: parseFloat(row.ctr || '0'),
            cpc: parseFloat(row.cpc || '0'),
            cpm: parseFloat(row.cpm || '0'),
            spend: parseFloat(row.spend || '0'),
            conversions: parseInt(row.conversions || '0'),
            cpa: row.cpa ? parseFloat(row.cpa) : null,
            reach: parseInt(row.reach || '0'),
            frequency: parseFloat(row.frequency || '0'),
            roas: row.roas ? parseFloat(row.roas) : null,
          },
        });
        campaignsUpdated++;
      }
    }

    await this.prisma.activityLog.create({
      data: {
        userId,
        action: 'INSIGHTS_SYNC_COMPLETE',
        entityType: 'insights',
        entityId: 'all',
        metadata: { campaignsUpdated, accountRows, accountsCount: accounts.length },
      },
    });

    return { accountsSynced: accounts.length, campaignDays: campaignsUpdated, accountInsightDays: accountRows };
  }

  private async fetchInsights(accountId: string, accessToken: string, level: 'account' | 'campaign'): Promise<FBInsightRow[]> {
    const fields = level === 'account'
      ? 'impressions,clicks,ctr,cpc,cpm,spend,conversions,reach,frequency'
      : 'campaign_id,campaign_name,impressions,clicks,ctr,cpc,cpm,spend,conversions,reach,frequency';

    const allRows: FBInsightRow[] = [];
    let url = `${this.baseUrl}/act_${accountId}/insights?fields=${fields}&level=${level}&date_preset=last_30d&time_increment=1&limit=100&access_token=${accessToken}`;

    while (url) {
      try {
        const { data } = await firstValueFrom(this.http.get<FBPage<FBInsightRow>>(url));
        allRows.push(...data.data);
        url = data.paging?.next || '';
      } catch (err: any) {
        this.logger.error(`Failed to fetch ${level} insights for account ${accountId}`,
          err?.response?.data || err.message);
        throw err;
      }
    }
    return allRows;
  }

  async getAccountInsights(adAccountId: string, userId: string, days = 30) {
    const account = await this.prisma.adAccount.findFirst({
      where: { id: adAccountId, fbUser: { userId } },
    });
    if (!account) throw new NotFoundException('Ad account not found');

    const since = new Date(Date.now() - days * 86400000);
    return this.prisma.accountInsight.findMany({
      where: { adAccountId: account.id, date: { gte: since } },
      orderBy: { date: 'asc' },
    });
  }

  async getCampaignInsights(adAccountId: string, campaignId: string, userId: string, days = 30) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { campaignId, adAccount: { id: adAccountId, fbUser: { userId } } },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const since = new Date(Date.now() - days * 86400000);
    return this.prisma.campaignInsight.findMany({
      where: { campaignId: campaign.id, date: { gte: since } },
      orderBy: { date: 'asc' },
    });
  }

  async getDashboardSummary(userId: string) {
    const accounts = await this.prisma.adAccount.findMany({
      where: { fbUser: { userId } },
      include: {
        insights: { orderBy: { date: 'desc' }, take: 1 },
        campaigns: {
          include: { insights: { orderBy: { date: 'desc' }, take: 1 } },
        },
      },
    });

    const totalSpend = accounts.reduce((sum, a) => sum + Number(a.spentToday), 0);
    const totalCampaigns = accounts.reduce((sum, a) => sum + a.campaigns.length, 0);
    const activeCampaigns = accounts.reduce(
      (sum, a) => sum + a.campaigns.filter((c) => c.status === 'ACTIVE').length, 0,
    );

    return {
      accounts: accounts.length,
      totalCampaigns,
      activeCampaigns,
      totalSpend,
      lastSync: accounts[0]?.updatedAt || null,
    };
  }
}


