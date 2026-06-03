import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FBInsightRow } from './insights.types';

@Injectable()
export class InsightsSyncHelper {
  private readonly logger = new Logger(InsightsSyncHelper.name);

  constructor(private readonly prisma: PrismaService) {}

  async persistAccountRows(adAccountDbId: string, rows: FBInsightRow[]): Promise<number> {
    let count = 0;
    for (const row of rows) {
      const date = new Date(row.date_start);
      await this.prisma.accountInsight.upsert({
        where: { adAccountId_date: { adAccountId: adAccountDbId, date } },
        create: {
          adAccountId: adAccountDbId,
          date,
          impressions: parseInt(row.impressions || '0', 10),
          clicks: parseInt(row.clicks || '0', 10),
          spend: parseFloat(row.spend || '0'),
          conversions: parseInt(row.conversions || '0', 10),
          ctr: parseFloat(row.ctr || '0'),
          cpc: parseFloat(row.cpc || '0'),
        },
        update: {
          impressions: parseInt(row.impressions || '0', 10),
          clicks: parseInt(row.clicks || '0', 10),
          spend: parseFloat(row.spend || '0'),
          conversions: parseInt(row.conversions || '0', 10),
          ctr: parseFloat(row.ctr || '0'),
          cpc: parseFloat(row.cpc || '0'),
        },
      });
      count++;
    }
    return count;
  }

  async persistCampaignRows(rows: FBInsightRow[]): Promise<number> {
    let count = 0;
    for (const row of rows) {
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
          impressions: parseInt(row.impressions || '0', 10),
          clicks: parseInt(row.clicks || '0', 10),
          ctr: parseFloat(row.ctr || '0'),
          cpc: parseFloat(row.cpc || '0'),
          cpm: parseFloat(row.cpm || '0'),
          spend: parseFloat(row.spend || '0'),
          conversions: parseInt(row.conversions || '0', 10),
          cpa: row.cpa ? parseFloat(row.cpa) : null,
          reach: parseInt(row.reach || '0', 10),
          frequency: parseFloat(row.frequency || '0'),
          roas: row.roas ? parseFloat(row.roas) : null,
        },
        update: {
          impressions: parseInt(row.impressions || '0', 10),
          clicks: parseInt(row.clicks || '0', 10),
          ctr: parseFloat(row.ctr || '0'),
          cpc: parseFloat(row.cpc || '0'),
          cpm: parseFloat(row.cpm || '0'),
          spend: parseFloat(row.spend || '0'),
          conversions: parseInt(row.conversions || '0', 10),
          cpa: row.cpa ? parseFloat(row.cpa) : null,
          reach: parseInt(row.reach || '0', 10),
          frequency: parseFloat(row.frequency || '0'),
          roas: row.roas ? parseFloat(row.roas) : null,
        },
      });
      count++;
    }
    return count;
  }

}