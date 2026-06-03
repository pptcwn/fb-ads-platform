import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getCampaignReportData(campaignId: string, userId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, adAccount: { fbUser: { userId } } },
      include: { adAccount: true, insights: { orderBy: { date: 'desc' }, take: 30 } },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const summary = {
      impressions: campaign.insights.reduce((s, i) => s + i.impressions, 0),
      clicks: campaign.insights.reduce((s, i) => s + i.clicks, 0),
      spend: campaign.insights.reduce((s, i) => s + Number(i.spend), 0),
      conversions: campaign.insights.reduce((s, i) => s + i.conversions, 0),
    };

    return {
      campaign: {
        name: campaign.name,
        campaignId: campaign.campaignId,
        objective: campaign.objective,
        status: campaign.status,
        dailyBudget: Number(campaign.dailyBudget || 0),
        currency: campaign.adAccount.currency,
        accountName: campaign.adAccount.name,
      },
      summary,
      ctr: summary.impressions > 0 ? ((summary.clicks / summary.impressions) * 100).toFixed(2) : '0.00',
      cpc: summary.clicks > 0 ? (summary.spend / summary.clicks).toFixed(2) : '0.00',
      cpm: summary.impressions > 0 ? ((summary.spend / summary.impressions) * 1000).toFixed(2) : '0.00',
      insights: campaign.insights.map(i => ({
        date: i.date,
        impressions: i.impressions,
        clicks: i.clicks,
        ctr: Number(i.ctr) * 100,
        cpc: Number(i.cpc),
        cpm: Number(i.cpm || 0),
        spend: Number(i.spend),
        conversions: i.conversions,
        reach: i.reach,
      })).reverse(),
    };
  }

  async getAccountReportData(adAccountId: string, userId: string) {
    const account = await this.prisma.adAccount.findFirst({
      where: { id: adAccountId, fbUser: { userId } },
    });
    if (!account) throw new NotFoundException('Ad account not found');

    const campaigns = await this.prisma.campaign.findMany({
      where: { adAccountId: account.id },
      include: { insights: { orderBy: { date: 'desc' }, take: 30 } },
    });

    const accountInsights = await this.prisma.accountInsight.findMany({
      where: { adAccountId: account.id },
      orderBy: { date: 'desc' },
      take: 30,
    });

    const totalSpend = campaigns.reduce((s, c) => s + Number(c.spend), 0);

    return {
      account: { name: account.name, accountId: account.accountId, currency: account.currency, status: account.status },
      summary: { campaigns: campaigns.length, totalSpend, activeCampaigns: campaigns.filter(c => c.status === 'ACTIVE').length },
      campaigns: campaigns.map(c => ({
        id: c.id,
        name: c.name,
        status: c.status,
        objective: c.objective,
        dailyBudget: Number(c.dailyBudget || 0),
        spent: Number(c.spend),
        impressions: c.impressions,
        clicks: c.clicks,
        ctr: Number(c.ctr) * 100,
        conversions: c.conversions,
      })),
      daily: accountInsights.map(i => ({
        date: i.date,
        impressions: i.impressions,
        clicks: i.clicks,
        spend: Number(i.spend),
        ctr: Number(i.ctr) * 100,
      })).reverse(),
    };
  }
}
