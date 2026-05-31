import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookService } from '../facebook/facebook.service';

@Injectable()
export class AdsetsService {
  private readonly logger = new Logger(AdsetsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly facebookService: FacebookService,
  ) {}

  async getCampaignAdsets(userId: string, campaignId: string) {
    // First get the DB campaign to verify ownership
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, adAccount: { fbUser: { userId } } },
      select: { id: true, name: true, adAccount: { select: { accountId: true, currency: true } } },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const adsets = await this.prisma.adSet.findMany({
      where: { campaignId },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { ads: true } },
      },
    });

    return {
      campaign: { id: campaign.id, name: campaign.name, accountId: campaign.adAccount.accountId, currency: campaign.adAccount.currency },
      adsets: adsets.map(a => ({
        id: a.id,
        adsetId: a.adsetId,
        name: a.name,
        status: a.status,
        dailyBudget: Number(a.dailyBudget || 0),
        lifetimeBudget: Number(a.lifetimeBudget || 0),
        impressions: a.impressions,
        clicks: a.clicks,
        spend: Number(a.spend),
        conversions: a.conversions,
        ctr: Number(a.ctr),
        optimizationGoal: a.optimizationGoal,
        bidStrategy: a.bidStrategy,
        bidAmount: Number(a.bidAmount || 0),
        adCount: a._count.ads,
        targeting: a.targeting,
      })),
    };
  }

  async getAdsetById(userId: string, id: string) {
    const adset = await this.prisma.adSet.findFirst({
      where: { id, campaign: { adAccount: { fbUser: { userId } } } },
      include: {
        campaign: { select: { id: true, name: true, adAccount: { select: { id: true, accountId: true, currency: true } } } },
        _count: { select: { ads: true } },
      },
    });
    if (!adset) throw new NotFoundException('Ad set not found');
    return adset;
  }

  async updateAdsetStatus(userId: string, id: string, status: string) {
    const adset = await this.prisma.adSet.findFirst({
      where: { id, campaign: { adAccount: { fbUser: { userId } } } },
      include: { campaign: { include: { adAccount: { include: { fbUser: true } } } } },
    });
    if (!adset) throw new NotFoundException('Ad set not found');

    const userAccessToken = this.facebookService.getDecryptedToken(adset.campaign.adAccount.fbUser.id);
    const accessToken = await userAccessToken;

    try {
      await this.facebookService.updateAdsetStatus(adset.adsetId, status, accessToken);
    } catch (err: any) {
      throw new BadRequestException(`Failed to ${status} ad set on Facebook: ${err.message}`);
    }

    // Update local DB
    await this.prisma.adSet.update({
      where: { id },
      data: { status: status as any },
    });

    return { id, adsetId: adset.adsetId, name: adset.name, status, message: `Ad set ${status === 'PAUSED' ? 'paused' : 'resumed'} successfully` };
  }

  async updateAdsetBudget(userId: string, id: string, dailyBudget: number) {
    if (!dailyBudget || dailyBudget <= 0) {
      throw new BadRequestException('Daily budget must be greater than 0');
    }

    const adset = await this.prisma.adSet.findFirst({
      where: { id, campaign: { adAccount: { fbUser: { userId } } } },
      include: { campaign: { include: { adAccount: { include: { fbUser: true } } } } },
    });
    if (!adset) throw new NotFoundException('Ad set not found');

    const userAccessToken = this.facebookService.getDecryptedToken(adset.campaign.adAccount.fbUser.id);
    const accessToken = await userAccessToken;

    try {
      await this.facebookService.updateAdsetBudget(adset.adsetId, dailyBudget, accessToken);
    } catch (err: any) {
      throw new BadRequestException(`Failed to update ad set budget on Facebook: ${err.message}`);
    }

    // Update local DB
    await this.prisma.adSet.update({
      where: { id },
      data: { dailyBudget },
    });

    return { id, adsetId: adset.adsetId, name: adset.name, dailyBudget, message: 'Budget updated successfully' };
  }
}
