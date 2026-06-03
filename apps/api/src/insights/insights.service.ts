import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookService } from '../facebook/facebook.service';
import { FacebookAsyncInsightsClient } from './facebook-async-insights.client';
import { InsightsSyncHelper } from './insights-sync.helper';
import { InsightsAsyncService } from './insights-async.service';

@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name);
  private readonly insightsClient = new FacebookAsyncInsightsClient();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => FacebookService))
    private readonly facebookService: FacebookService,
    private readonly syncHelper: InsightsSyncHelper,
    private readonly insightsAsync: InsightsAsyncService,
  ) {}

  /**
   * Sync insights for one ad account (used by auto-sync cron — small sync GET).
   */
  async syncSingleAccountInsights(
    adAccountDbId: string,
    fbAccountId: string,
    accessToken: string,
    datePreset = 'yesterday',
  ): Promise<{ accountRows: number; campaignRows: number }> {
    try {
      const accountInsights = await this.insightsClient.fetchInsights(
        fbAccountId,
        accessToken,
        { level: 'account', datePreset },
      );
      const campaignInsights = await this.insightsClient.fetchInsights(
        fbAccountId,
        accessToken,
        { level: 'campaign', datePreset },
      );

      const accountRows = await this.syncHelper.persistAccountRows(adAccountDbId, accountInsights);
      const campaignRows = await this.syncHelper.persistCampaignRows(campaignInsights);
      return { accountRows, campaignRows };
    } catch (err: any) {
      this.logger.warn(
        `Insight sync failed for ${fbAccountId}: ${err?.message ?? err}`,
      );
      return { accountRows: 0, campaignRows: 0 };
    }
  }

  async syncInsights(userId: string, adAccountId?: string) {
    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId } });
    if (!fbUser) throw new NotFoundException('Facebook account not connected');

    const accessToken = await this.facebookService.getDecryptedToken(fbUser.id);

    const where = { fbUser: { userId } } as { fbUser: { userId: string }; id?: string };
    if (adAccountId) where.id = adAccountId;
    const accounts = await this.prisma.adAccount.findMany({ where });

    if (accounts.length === 0) throw new NotFoundException('No ad accounts found');

    const queuedJobs: Array<{ adAccountId: string; accountName: string; jobs: string[] }> = [];

    for (const account of accounts) {
      this.logger.log(`Queueing async insights for ${account.name}...`);

      const acctJob = await this.insightsAsync.enqueueInsightsFetch(
        account.id,
        account.accountId,
        accessToken,
        userId,
        { level: 'account', datePreset: 'last_30d', timeIncrement: 1 },
      );
      const campJob = await this.insightsAsync.enqueueInsightsFetch(
        account.id,
        account.accountId,
        accessToken,
        userId,
        { level: 'campaign', datePreset: 'last_30d', timeIncrement: 1 },
      );

      queuedJobs.push({
        adAccountId: account.id,
        accountName: account.name,
        jobs: [acctJob.jobId, campJob.jobId].filter(Boolean),
      });
    }

    await this.prisma.activityLog.create({
      data: {
        userId,
        action: 'INSIGHTS_SYNC_QUEUED',
        entityType: 'insights',
        entityId: 'all',
        metadata: {
          accountsCount: accounts.length,
          mode: 'async-bullmq',
          datePreset: 'last_30d',
          queuedJobs,
        },
      },
    });

    return {
      message: `Queued async insights sync for ${accounts.length} account(s). Poll jobs run in background.`,
      accountsSynced: accounts.length,
      queued: true,
      jobs: queuedJobs,
    };
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
      (sum, a) => sum + a.campaigns.filter((c) => c.status === 'ACTIVE').length,
      0,
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