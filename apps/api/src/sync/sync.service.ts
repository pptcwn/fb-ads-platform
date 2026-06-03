import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookService } from '../facebook/facebook.service';
import { FB_GRAPH_BASE_URL } from '../common/facebook-api.config';
import { setupFacebookRateLimitInterceptors } from '../common/facebook-rate-limit';
import { AccountStatus, CampaignObjective, CampaignStatus } from '@prisma/client';

interface FBAdAccount {
  id: string;
  account_id: string;
  name: string;
  account_status: number;
  currency: string;
  timezone_name: string;
  balance: number;
  amount_spent: number;
  min_campaign_group_spend_cap?: string;
  disable_reason?: number;
}

interface FBCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  daily_budget: string | null;
  lifetime_budget: string | null;
  created_time?: string;
  start_time?: string;
  stop_time?: string;
}

interface FBPage<T> {
  data: T[];
  paging?: {
    cursors: { before: string; after: string };
    next?: string;
  };
}

@Injectable()
export class SyncService implements OnModuleInit {
  private readonly logger = new Logger(SyncService.name);
  private readonly baseUrl = FB_GRAPH_BASE_URL;

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly facebookService: FacebookService,
  ) {}

  onModuleInit() {
    setupFacebookRateLimitInterceptors(this.http.axiosRef);
  }

  private mapAccountStatus(code: number): AccountStatus {
    switch (code) {
      case 1: return 'ACTIVE';
      case 2: return 'DISABLED';
      case 3: return 'BANNED';
      case 7: return 'DISABLED'; // pending review → disabled
      case 9: return 'LIMITED';  // temporarily limited
      case 100: return 'BANNED'; // permanently banned
      default: return 'DISABLED';
    }
  }

  private mapCampaignObjective(obj: string | null | undefined): CampaignObjective {
    // Map old Facebook API objective names to Prisma enum
    const map: Record<string, CampaignObjective> = {
      // New names (direct match)
      OUTCOME_AWARENESS: 'OUTCOME_AWARENESS',
      OUTCOME_ENGAGEMENT: 'OUTCOME_ENGAGEMENT',
      OUTCOME_TRAFFIC: 'OUTCOME_TRAFFIC',
      OUTCOME_LEADS: 'OUTCOME_LEADS',
      OUTCOME_SALES: 'OUTCOME_SALES',
      OUTCOME_APP_PROMOTION: 'OUTCOME_APP_PROMOTION',
      // Legacy Facebook objective names → new mapping
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

  private mapCampaignStatus(status: string): CampaignStatus {
    const map: Record<string, CampaignStatus> = {
      ACTIVE: 'ACTIVE',
      PAUSED: 'PAUSED',
      DELETED: 'DELETED',
      ARCHIVED: 'ARCHIVED',
      IN_REVIEW: 'IN_REVIEW',
      REJECTED: 'REJECTED',
      COMPLETED: 'COMPLETED',
    };
    return map[status.toUpperCase()] || 'PAUSED';
  }

  async syncAll(userId: string): Promise<{ accountsSynced: number; campaignsSynced: number }> {
    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId } });
    if (!fbUser) throw new NotFoundException('Facebook account not connected');

    const accessToken = await this.facebookService.getDecryptedToken(fbUser.id);

    // Step 1: Sync Ad Accounts
    const accounts = await this.fetchAdAccounts(accessToken);
    this.logger.log(`Fetched ${accounts.length} ad accounts for user ${userId}`);

    for (const acct of accounts) {
      await this.prisma.adAccount.upsert({
        where: { accountId: acct.account_id },
        create: {
          fbUserId: fbUser.id,
          accountId: acct.account_id,
          name: acct.name,
          currency: acct.currency || 'THB',
          timezone: acct.timezone_name || 'Asia/Bangkok',
          status: this.mapAccountStatus(acct.account_status || 1),
          balance: acct.balance ? Number(acct.balance) / 100 : 0,
          spentToday: acct.amount_spent ? Number(acct.amount_spent) / 100 : 0,
        },
        update: {
          name: acct.name,
          status: this.mapAccountStatus(acct.account_status || 1),
          currency: acct.currency || 'THB',
          timezone: acct.timezone_name || 'Asia/Bangkok',
          balance: acct.balance ? Number(acct.balance) / 100 : 0,
          spentToday: acct.amount_spent ? Number(acct.amount_spent) / 100 : 0,
        },
      });
    }

    // Step 2: Sync Campaigns for each account
    let totalCampaigns = 0;
    for (const acct of accounts) {
      const dbAccount = await this.prisma.adAccount.findUnique({
        where: { accountId: acct.account_id },
      });
      if (!dbAccount) continue;

      const campaigns = await this.fetchCampaigns(acct.account_id, accessToken);
      totalCampaigns += campaigns.length;

      for (const camp of campaigns) {
        await this.prisma.campaign.upsert({
          where: { campaignId: camp.id },
          create: {
            adAccountId: dbAccount.id,
            campaignId: camp.id,
            name: camp.name,
            objective: this.mapCampaignObjective(camp.objective),
            status: this.mapCampaignStatus(camp.status),
            dailyBudget: camp.daily_budget ? Number(camp.daily_budget) / 100 : null,
            lifetimeBudget: camp.lifetime_budget ? Number(camp.lifetime_budget) / 100 : null,
          },
          update: {
            name: camp.name,
            objective: this.mapCampaignObjective(camp.objective),
            status: this.mapCampaignStatus(camp.status),
            dailyBudget: camp.daily_budget ? Number(camp.daily_budget) / 100 : null,
            lifetimeBudget: camp.lifetime_budget ? Number(camp.lifetime_budget) / 100 : null,
          },
        });
      }

      this.logger.log(`Synced ${campaigns.length} campaigns for account ${acct.name}`);
    }

    // Log activity
    await this.prisma.activityLog.create({
      data: {
        userId,
        action: 'SYNC_COMPLETE',
        entityType: 'sync',
        entityId: 'all',
        metadata: {
          accountsSynced: accounts.length,
          campaignsSynced: totalCampaigns,
        },
      },
    });

    return { accountsSynced: accounts.length, campaignsSynced: totalCampaigns };
  }

  private async fetchAdAccounts(accessToken: string): Promise<FBAdAccount[]> {
    const allAccounts: FBAdAccount[] = [];
    let url = `${this.baseUrl}/me/adaccounts?fields=id,account_id,name,account_status,currency,timezone_name,balance,amount_spent&limit=100&access_token=${accessToken}`;

    while (url) {
      try {
        const { data } = await firstValueFrom(this.http.get<FBPage<FBAdAccount>>(url));
        allAccounts.push(...data.data);
        url = data.paging?.next || '';
      } catch (err: any) {
        this.logger.error('Failed to fetch ad accounts', err?.response?.data || err.message);
        throw err;
      }
    }
    return allAccounts;
  }

  private async fetchCampaigns(accountId: string, accessToken: string): Promise<FBCampaign[]> {
    const allCampaigns: FBCampaign[] = [];
    let url = `${this.baseUrl}/act_${accountId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget&limit=100&access_token=${accessToken}`;

    while (url) {
      try {
        const { data } = await firstValueFrom(this.http.get<FBPage<FBCampaign>>(url));
        allCampaigns.push(...data.data);
        url = data.paging?.next || '';
      } catch (err: any) {
        this.logger.error(`Failed to fetch campaigns for account ${accountId}`, err?.response?.data || err.message);
        throw err;
      }
    }
    return allCampaigns;
  }

  async getSyncStats(userId: string) {
    const [accounts, campaigns, adsets, ads] = await Promise.all([
      this.prisma.adAccount.count({
        where: { fbUser: { userId } },
      }),
      this.prisma.campaign.count({
        where: { adAccount: { fbUser: { userId } } },
      }),
      this.prisma.adSet.count({
        where: { campaign: { adAccount: { fbUser: { userId } } } },
      }),
      this.prisma.ad.count({
        where: { adset: { campaign: { adAccount: { fbUser: { userId } } } } },
      }),
    ]);

    const recentSync = await this.prisma.activityLog.findFirst({
      where: { userId, action: 'SYNC_COMPLETE' },
      orderBy: { createdAt: 'desc' },
    });

    return { accounts, campaigns, adsets, ads, lastSync: recentSync?.createdAt || null };
  }
}
