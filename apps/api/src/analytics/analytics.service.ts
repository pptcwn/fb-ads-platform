import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Overview: top-level aggregate metrics ───

  async getOverview(userId: string, from?: string, to?: string) {
    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId } });
    if (!fbUser) return { connected: false };

    const dateFilter = this.dateFilter(from, to);

    const [accountAgg, campaignAgg, activeCampaigns, campaignInsights] = await Promise.all([
      this.prisma.accountInsight.aggregate({
        where: { adAccount: { fbUserId: fbUser.id }, ...dateFilter },
        _sum: { impressions: true, clicks: true, spend: true, conversions: true },
      }),
      this.prisma.campaign.aggregate({
        where: { adAccount: { fbUserId: fbUser.id } },
        _sum: { spend: true, impressions: true, clicks: true, conversions: true },
        _count: true,
      }),
      this.prisma.campaign.count({
        where: { adAccount: { fbUserId: fbUser.id }, status: 'ACTIVE' },
      }),
      this.prisma.campaignInsight.aggregate({
        where: { campaign: { adAccount: { fbUserId: fbUser.id } }, ...dateFilter },
        _sum: { impressions: true, clicks: true, spend: true, conversions: true, reach: true },
        _avg: { ctr: true, cpc: true, cpm: true, roas: true, frequency: true },
      }),
    ]);

    const ci = campaignInsights;
    const totalImpressions = (ci._sum.impressions || 0);
    const totalClicks = (ci._sum.clicks || 0);
    const totalSpend = Number(ci._sum.spend || 0);
    const totalConversions = (ci._sum.conversions || 0);
    const totalReach = (ci._sum.reach || 0);
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const avgCpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
    const avgRoas = Number(ci._avg.roas || 0);
    const avgCpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
    const frequency = totalReach > 0 ? totalImpressions / totalReach : 0;

    // Count campaigns by objective
    const objectiveCounts = await this.prisma.campaign.groupBy({
      by: ['objective'],
      where: { adAccount: { fbUserId: fbUser.id } },
      _count: true,
    });

    // Budget remaining for active campaigns
    const activeCampData = await this.prisma.campaign.findMany({
      where: { adAccount: { fbUserId: fbUser.id }, status: 'ACTIVE' },
      select: { dailyBudget: true, spend: true, name: true },
    });
    const totalBudget = activeCampData.reduce((s, c) => s + Number(c.dailyBudget || 0), 0);
    const totalSpent = activeCampData.reduce((s, c) => s + Number(c.spend || 0), 0);
    const budgetUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    return {
      connected: true,
      summary: {
        totalSpend,
        totalImpressions,
        totalClicks,
        totalConversions,
        totalReach,
        totalCampaigns: campaignAgg._count,
        activeCampaigns,
      },
      rates: {
        ctr: Math.round(avgCtr * 100) / 100,
        cpc: Math.round(avgCpc * 100) / 100,
        cpm: Math.round(avgCpm * 100) / 100,
        cpa: Math.round(avgCpa * 100) / 100,
        roas: Math.round(avgRoas * 100) / 100,
        frequency: Math.round(frequency * 100) / 100,
      },
      budget: {
        totalMonthly: totalBudget,
        spent: totalSpent,
        usagePercent: Math.round(budgetUsed * 100) / 100,
      },
      objectives: objectiveCounts.map(o => ({ objective: o.objective, count: o._count })),
    };
  }

  // ─── Trends: time-series data ───

  async getTrends(userId: string, from: string, to: string, granularity?: string, accountId?: string) {
    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId } });
    if (!fbUser) throw new Error('Facebook account not connected');

    const gran = granularity || 'day';
    const dateFrom = from || this.daysAgo(30);
    const dateTo = to || new Date().toISOString().slice(0, 10);

    const whereAccount = accountId
      ? { adAccountId: accountId, adAccount: { fbUserId: fbUser.id } }
      : { campaign: { adAccount: { fbUserId: fbUser.id } } };

    const insights = await this.prisma.campaignInsight.findMany({
      where: {
        ...whereAccount,
        date: { gte: new Date(dateFrom), lte: new Date(dateTo + 'T23:59:59Z') },
      },
      orderBy: { date: 'asc' },
    });

    // Group by granularity
    const grouped = this.groupByGranularity(insights, gran);

    // Build trend series
    const dates = Object.keys(grouped).sort();
    const series = dates.map(d => {
      const items = grouped[d];
      const totalImpressions = items.reduce((s, i) => s + i.impressions, 0);
      const totalClicks = items.reduce((s, i) => s + i.clicks, 0);
      const totalSpend = items.reduce((s, i) => s + Number(i.spend), 0);
      const totalConversions = items.reduce((s, i) => s + i.conversions, 0);
      const totalReach = items.reduce((s, i) => s + i.reach, 0);
      return {
        date: d,
        impressions: totalImpressions,
        clicks: totalClicks,
        spend: Math.round(totalSpend * 100) / 100,
        conversions: totalConversions,
        reach: totalReach,
        ctr: totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0,
        cpc: totalClicks > 0 ? Math.round((totalSpend / totalClicks) * 100) / 100 : 0,
        cpm: totalImpressions > 0 ? Math.round((totalSpend / totalImpressions) * 100000) / 100 : 0,
      };
    });

    return { from: dateFrom, to: dateTo, granularity: gran, series };
  }

  // ─── Campaign ranking ───

  async getCampaignRanking(userId: string, from?: string, to?: string, sort?: string, limit = 20) {
    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId } });
    if (!fbUser) return [];

    const dateFilter = this.dateFilter(from, to);

    const campaigns = await this.prisma.campaign.findMany({
      where: { adAccount: { fbUserId: fbUser.id } },
      include: {
        adAccount: { select: { id: true, accountId: true, name: true, currency: true } },
        insights: {
          where: dateFilter,
          select: {
            impressions: true, clicks: true, spend: true, conversions: true,
            reach: true, ctr: true, cpc: true, cpm: true, roas: true,
          },
        },
      },
    });

    const ranked = campaigns.map(c => {
      const ins = c.insights;
      const totalImpressions = ins.reduce((s, i) => s + i.impressions, 0);
      const totalClicks = ins.reduce((s, i) => s + i.clicks, 0);
      const totalSpend = ins.reduce((s, i) => s + Number(i.spend), 0);
      const totalConversions = ins.reduce((s, i) => s + i.conversions, 0);
      const totalReach = ins.reduce((s, i) => s + i.reach, 0);
      return {
        id: c.id,
        campaignId: c.campaignId,
        name: c.name,
        objective: c.objective,
        status: c.status,
        accountName: c.adAccount.name,
        currency: c.adAccount.currency,
        dailyBudget: Number(c.dailyBudget || 0),
        totalSpend: Math.round(totalSpend * 100) / 100,
        impressions: totalImpressions,
        clicks: totalClicks,
        conversions: totalConversions,
        reach: totalReach,
        ctr: totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0,
        cpc: totalClicks > 0 ? Math.round((totalSpend / totalClicks) * 100) / 100 : 0,
        cpm: totalImpressions > 0 ? Math.round((totalSpend / totalImpressions) * 100000) / 100 : 0,
        roas: ins.reduce((s, i) => s + Number(i.roas || 0), 0) / (ins.length || 1),
      };
    });

    // Sort
    const sortKey = sort || 'spend';
    const sortMap: Record<string, string> = {
      spend: 'totalSpend', impressions: 'impressions', clicks: 'clicks',
      ctr: 'ctr', cpc: 'cpc', conversions: 'conversions', roas: 'roas',
    };
    const key = sortMap[sortKey] || 'totalSpend';
    ranked.sort((a: any, b: any) => Number(b[key]) - Number(a[key]));

    return ranked.slice(0, limit);
  }

  // ─── Period comparison ───

  async getPeriodComparison(userId: string, period?: string) {
    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId } });
    if (!fbUser) throw new Error('Facebook account not connected');

    const p = period || '30d';
    const days = parseInt(p.replace('d', ''));
    const now = new Date();
    const currentStart = this.daysAgo(days);
    const previousStart = this.daysAgo(days * 2);
    const previousEnd = this.daysAgo(1);

    const [current, previous] = await Promise.all([
      this.prisma.campaignInsight.aggregate({
        where: { campaign: { adAccount: { fbUserId: fbUser.id } }, date: { gte: new Date(currentStart), lte: now } },
        _sum: { impressions: true, clicks: true, spend: true, conversions: true },
      }),
      this.prisma.campaignInsight.aggregate({
        where: { campaign: { adAccount: { fbUserId: fbUser.id } }, date: { gte: new Date(previousStart), lte: new Date(previousEnd) } },
        _sum: { impressions: true, clicks: true, spend: true, conversions: true },
      }),
    ]);

    const calc = (agg: typeof current) => ({
      impressions: agg._sum.impressions || 0,
      clicks: agg._sum.clicks || 0,
      spend: Number(agg._sum.spend || 0),
      conversions: agg._sum.conversions || 0,
    });

    const cur = calc(current);
    const prev = calc(previous);

    const pctChange = (curField: number, prevField: number) => {
      if (prevField === 0) return curField > 0 ? 100 : 0;
      return Math.round(((curField - prevField) / prevField) * 10000) / 100;
    };

    return {
      period: p,
      current: cur,
      previous: prev,
      changes: {
        impressions: pctChange(cur.impressions, prev.impressions),
        clicks: pctChange(cur.clicks, prev.clicks),
        spend: pctChange(cur.spend, prev.spend),
        conversions: pctChange(cur.conversions, prev.conversions),
      },
    };
  }

  // ─── Account summary ───

  async getAccountSummary(userId: string) {
    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId } });
    if (!fbUser) return [];

    const accounts = await this.prisma.adAccount.findMany({
      where: { fbUserId: fbUser.id },
      select: {
        id: true, accountId: true, name: true, currency: true, status: true,
        balance: true, spentToday: true, spendCap: true,
        _count: { select: { campaigns: true } },
      },
    });

    // Get latest insight for each account
    const accountsWithStats = await Promise.all(
      accounts.map(async (acc) => {
        const latestInsight = await this.prisma.accountInsight.findFirst({
          where: { adAccountId: acc.id },
          orderBy: { date: 'desc' },
        });
        return {
          id: acc.id,
          accountId: acc.accountId,
          name: acc.name,
          currency: acc.currency,
          status: acc.status,
          balance: Number(acc.balance),
          spentToday: Number(acc.spentToday),
          spendCap: Number(acc.spendCap || 0),
          campaignCount: acc._count.campaigns,
          latestInsight: latestInsight ? {
            impressions: latestInsight.impressions,
            clicks: latestInsight.clicks,
            spend: Number(latestInsight.spend),
            conversions: latestInsight.conversions,
            ctr: Number(latestInsight.ctr),
            cpc: Number(latestInsight.cpc),
          } : null,
        };
      }),
    );

    return accountsWithStats;
  }

  // ─── Helpers ───

  private daysAgo(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  }

  private dateFilter(from?: string, to?: string): any {
    const filter: any = {};
    if (from || to) {
      filter.date = {};
      if (from) filter.date.gte = new Date(from);
      if (to) filter.date.lte = new Date(to + 'T23:59:59Z');
    }
    return filter;
  }

  private groupByGranularity(insights: any[], granularity: string): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};
    for (const ins of insights) {
      const d = new Date(ins.date);
      let key: string;
      if (granularity === 'week') {
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        key = weekStart.toISOString().slice(0, 10);
      } else if (granularity === 'month') {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      } else {
        key = d.toISOString().slice(0, 10);
      }
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(ins);
    }
    return grouped;
  }
}
