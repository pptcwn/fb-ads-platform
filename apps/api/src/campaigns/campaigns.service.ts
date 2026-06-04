import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { fbAdAccountActId } from '../common/facebook-api.config';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookService } from '../facebook/facebook.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { validateTargeting } from './dto/targeting.schema';

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly facebookService: FacebookService,
  ) {}

  async uploadAdImage(
    userId: string,
    adAccountId: string,
    file: { path: string; originalname: string; mimetype: string },
  ): Promise<{ imageHash: string }> {
    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId } });
    if (!fbUser) throw new NotFoundException('Facebook account not connected');

    const adAccount = await this.prisma.adAccount.findFirst({
      where: { id: adAccountId, fbUser: { userId } },
    });
    if (!adAccount) throw new NotFoundException('Ad account not found');

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (file.mimetype && !allowed.includes(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG, WebP, or GIF images are allowed');
    }

    const accessToken = await this.facebookService.getDecryptedToken(fbUser.id);
    const imageHash = await this.facebookService.uploadAdImage(
      fbAdAccountActId(adAccount.accountId),
      accessToken,
      { path: file.path, originalname: file.originalname, mimetype: file.mimetype },
    );

    return { imageHash };
  }

  async create(userId: string, dto: CreateCampaignDto) {
    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId } });
    if (!fbUser) throw new NotFoundException('Facebook account not connected');
    const accessToken = await this.facebookService.getDecryptedToken(fbUser.id);

    // Find the ad account by local id
    const adAccount = await this.prisma.adAccount.findFirst({
      where: { id: dto.adAccountId, fbUser: { userId } },
    });
    if (!adAccount) throw new NotFoundException('Ad account not found');
    const fbAccountId = adAccount.accountId.replace('act_', '');

    let fbCampaignId: string | null = null;
    let localCampaignId: string | null = null;

    try {
      // 1. Create campaign on FB
      const campaign = await this.facebookService.createCampaign(
        fbAccountId,
        dto.name,
        dto.objective,
        dto.status || 'PAUSED',
        dto.dailyBudget,
        accessToken,
      );
      fbCampaignId = campaign.id;

      // Save to local DB
      const objectiveEnum = dto.objective.replace(/-/g, '_').toUpperCase();
      const savedCampaign = await this.prisma.campaign.create({
        data: {
          campaignId: campaign.id,
          name: dto.name,
          objective: objectiveEnum as any,
          status: (dto.status || 'PAUSED') as any,
          dailyBudget: dto.dailyBudget,
          adAccountId: adAccount.id,
        },
      });
      localCampaignId = savedCampaign.id;

      let adSetId: string | null = null;
      let adId: string | null = null;

      const targeting = dto.targeting
        ? validateTargeting(dto.targeting)
        : { geo_locations: { countries: ['TH'] } };

      // 2. Create AdSet (optional)
      if (dto.adSetName) {
        const adSet = await this.facebookService.createAdSet(
          fbAccountId,
          campaign.id,
          dto.adSetName,
          dto.dailyBudget * 0.8, // 80% of campaign budget
          dto.optimizationGoal || 'REACH',
          dto.billingEvent || 'IMPRESSIONS',
          null, // bidAmount — let FB use lowest cost
          targeting,
          'ACTIVE',
          accessToken,
          'LOWEST_COST_NO_BID', // explicitly set bid strategy without bid cap
        );

        const savedAdSet = await this.prisma.adSet.create({
          data: {
            adsetId: adSet.id,
            campaignId: savedCampaign.id,
            name: dto.adSetName,
            status: 'ACTIVE',
            targeting: targeting as any,
            dailyBudget: dto.dailyBudget * 0.8,
            optimizationGoal: dto.optimizationGoal || 'REACH',
          },
        });
        adSetId = savedAdSet.id;
      }

      // 3. Create Ad + Creative (optional)
      if (dto.adName && adSetId) {
        const savedAdSet = await this.prisma.adSet.findUnique({ where: { id: adSetId } });
        if (savedAdSet) {
          let pageId = dto.pageId || null;
          if (!pageId) {
            const pages = await this.facebookService.getStoredPages(fbUser.id);
            if (pages.length > 0) pageId = pages[0].pageId;
          }

          const creative = await this.facebookService.createCreative(
            fbAccountId,
            pageId,
            dto.creativeImageHash || null,
            dto.creativeLink || 'https://example.com',
            dto.creativeMessage || '',
            `${dto.adName} Creative`,
            accessToken,
          );

          const ad = await this.facebookService.createAd(
            fbAccountId,
            savedAdSet.adsetId,
            creative.id,
            dto.adName,
            'ACTIVE',
            accessToken,
          );

          await this.prisma.ad.create({
            data: {
              adId: ad.id,
              adsetId: savedAdSet.id,
              name: dto.adName,
              status: 'ACTIVE',
              creativeId: creative.id,
            },
          });
          adId = ad.id;
        }
      }

      // Sync to get latest data (non-blocking for success response)
      await this.syncAfterCreate(userId, adAccount);

      return {
        campaignId: campaign.id,
        adSetId,
        adId,
        status: dto.status || 'PAUSED',
      };
    } catch (err: any) {
      await this.rollbackFailedCreate(accessToken, fbCampaignId, localCampaignId);
      throw this.toUserFacingCreateError(err);
    }
  }

  /** Remove partial local + FB resources when create fails mid-flight */
  private async rollbackFailedCreate(
    accessToken: string,
    fbCampaignId: string | null,
    localCampaignId: string | null,
  ): Promise<void> {
    if (localCampaignId) {
      try {
        const camp = await this.prisma.campaign.findUnique({
          where: { id: localCampaignId },
          select: { id: true, campaignId: true },
        });
        if (camp) {
          await this.deleteCampaignFromDb(camp.id, camp.campaignId);
        }
      } catch (e: any) {
        this.logger.warn(`Rollback local campaign failed: ${e.message}`);
      }
    } else if (fbCampaignId) {
      try {
        await this.facebookService.deleteCampaign(fbCampaignId, accessToken);
      } catch (e: any) {
        this.logger.warn(`Rollback FB campaign ${fbCampaignId} failed: ${e.message}`);
      }
    }
  }

  private toUserFacingCreateError(err: any): never {
    if (err instanceof NotFoundException || err instanceof BadRequestException) {
      throw err;
    }
    const fbMsg = err?.response?.data?.error?.message;
    const message =
      fbMsg ||
      (typeof err?.message === 'string' ? err.message : null) ||
      'สร้างแคมเปญไม่สำเร็จ — ลองอีกครั้งหรือตรวจการตั้งค่า targeting/โฆษณา';
    throw new BadRequestException(message);
  }

  /** Delete related rows so prisma.campaign.delete succeeds */
  private async deleteCampaignFromDb(localCampaignId: string, fbCampaignId?: string): Promise<void> {
    await this.prisma.creativeCampaign.deleteMany({ where: { campaignId: localCampaignId } });
    await this.prisma.campaignInsight.deleteMany({ where: { campaignId: localCampaignId } });
    await this.prisma.abTest.deleteMany({ where: { sourceCampaignId: localCampaignId } });
    if (fbCampaignId) {
      await this.prisma.abTestVariant.deleteMany({ where: { campaignId: fbCampaignId } });
    }
    await this.prisma.campaignSchedule.deleteMany({ where: { campaignId: localCampaignId } });

    const adsets = await this.prisma.adSet.findMany({
      where: { campaignId: localCampaignId },
      select: { id: true },
    });
    for (const adset of adsets) {
      await this.prisma.ad.deleteMany({ where: { adsetId: adset.id } });
    }
    await this.prisma.adSet.deleteMany({ where: { campaignId: localCampaignId } });

    const rules = await this.prisma.rule.findMany({
      where: { campaignId: localCampaignId },
      select: { id: true },
    });
    if (rules.length > 0) {
      await this.prisma.ruleLog.deleteMany({
        where: { ruleId: { in: rules.map((r) => r.id) } },
      });
    }
    await this.prisma.rule.deleteMany({ where: { campaignId: localCampaignId } });

    await this.prisma.campaign.delete({ where: { id: localCampaignId } });
  }

  private async syncAfterCreate(userId: string, adAccount: any) {
    try {
      const fbUser = await this.prisma.fbUser.findFirst({ where: { userId } });
      if (!fbUser) return;
      const accessToken = await this.facebookService.getDecryptedToken(fbUser.id);
      const fbAccountId = adAccount.accountId.replace('act_', '');
      const fbCampaigns = await this.facebookService.getFbCampaigns(fbAccountId, accessToken);

      const account = await this.prisma.adAccount.findFirst({
        where: { id: adAccount.id, fbUser: { userId } },
      });
      if (!account) return;

      for (const camp of fbCampaigns) {
        await this.prisma.campaign.upsert({
          where: { campaignId: camp.id },
          create: {
            campaignId: camp.id,
            name: camp.name || '',
            objective: (camp.objective || 'OUTCOME_TRAFFIC').replace(/-/g, '_').toUpperCase() as any,
            status: (camp.status || 'PAUSED') as any,
            dailyBudget: camp.daily_budget ? parseFloat(camp.daily_budget) / 100 : null,
            lifetimeBudget: camp.lifetime_budget ? parseFloat(camp.lifetime_budget) / 100 : null,
            adAccountId: account.id,
          },
          update: {
            name: camp.name || '',
            status: (camp.status || 'PAUSED') as any,
            dailyBudget: camp.daily_budget ? parseFloat(camp.daily_budget) / 100 : null,
          },
        });
      }
    } catch (err: any) {
      this.logger.warn('Post-create sync failed (non-critical)', err.message);
    }
  }

  async getAdAccounts(userId: string) {
    const accounts = await this.prisma.adAccount.findMany({
      where: { fbUser: { userId } },
      include: {
        _count: { select: { campaigns: true } },
        campaigns: {
          select: {
            id: true, name: true, campaignId: true, objective: true, dailyBudget: true,
            status: true, spent: true, impressions: true, clicks: true, conversions: true, ctr: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 200,
        },
      },
    });
    return accounts;
  }

  async getCampaigns(adAccountId: string, userId: string) {
    const account = await this.prisma.adAccount.findFirst({
      where: { id: adAccountId, fbUser: { userId } },
    });
    if (!account) throw new NotFoundException('Ad account not found');
    return this.prisma.campaign.findMany({
      where: { adAccountId: account.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, userId: string, dto: UpdateCampaignDto) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, adAccount: { fbUser: { userId } } },
      include: { adAccount: true },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId } });
    if (!fbUser) throw new NotFoundException('Facebook account not connected');
    const accessToken = await this.facebookService.getDecryptedToken(fbUser.id);

    // Update on Facebook
    if (dto.status) {
      await this.facebookService.updateCampaignStatus(
        campaign.adAccount.accountId.replace('act_', ''),
        campaign.campaignId,
        dto.status,
        accessToken,
      );
    }
    if (dto.name) {
      await this.facebookService.updateCampaignName(
        campaign.campaignId,
        dto.name,
        accessToken,
      );
    }
    if (dto.dailyBudget) {
      await this.facebookService.updateCampaignBudget(
        campaign.campaignId,
        dto.dailyBudget,
        accessToken,
      );
    }

    // Update local DB
    const updateData: any = {};
    if (dto.name) updateData.name = dto.name;
    if (dto.status) updateData.status = dto.status;
    if (dto.dailyBudget) updateData.dailyBudget = dto.dailyBudget;

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: updateData,
    });

    return updated;
  }

  async remove(id: string, userId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, adAccount: { fbUser: { userId } } },
      include: { adAccount: true },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId } });
    if (!fbUser) throw new NotFoundException('Facebook account not connected');
    const accessToken = await this.facebookService.getDecryptedToken(fbUser.id);

    // Try to delete from Facebook, but allow local deletion even if FB fails
    try {
      await this.facebookService.deleteCampaign(campaign.campaignId, accessToken);
    } catch (err: any) {
      this.logger.warn(`Failed to delete campaign ${campaign.campaignId} from Facebook (proceeding with local delete): ${err.message}`);
    }

    // Always delete from local DB (cascade children first — FK constraints)
    await this.deleteCampaignFromDb(campaign.id, campaign.campaignId);

    return { message: 'Campaign deleted successfully' };
  }

  // ─── Bulk Operations ───

  async bulkUpdateStatus(ids: string[], userId: string, newStatus: string) {
    const campaigns = await this.prisma.campaign.findMany({
      where: { id: { in: ids }, adAccount: { fbUser: { userId } } },
      include: { adAccount: true },
    });

    if (campaigns.length === 0) throw new NotFoundException('No campaigns found');

    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId } });
    if (!fbUser) throw new NotFoundException('Facebook account not connected');
    const accessToken = await this.facebookService.getDecryptedToken(fbUser.id);

    const results: { id: string; name: string; status: string; success: boolean; error?: string }[] = [];

    for (const campaign of campaigns) {
      try {
        await this.facebookService.updateCampaignStatus(
          campaign.adAccount.accountId.replace('act_', ''),
          campaign.campaignId,
          newStatus,
          accessToken,
        );
        await this.prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: newStatus as any },
        });
        results.push({ id: campaign.id, name: campaign.name, status: newStatus, success: true });
      } catch (err: any) {
        this.logger.warn(`Bulk ${newStatus} failed for campaign ${campaign.name} (${campaign.campaignId}): ${err.message}`);
        results.push({ id: campaign.id, name: campaign.name, status: campaign.status, success: false, error: err.message });
      }
    }

    const updated = results.filter(r => r.success).length;
    return {
      message: `${updated} of ${campaigns.length} campaigns ${newStatus === 'PAUSED' ? 'paused' : newStatus === 'ACTIVE' ? 'resumed' : 'updated'}`,
      results,
    };
  }

  async bulkRemove(ids: string[], userId: string) {
    const campaigns = await this.prisma.campaign.findMany({
      where: { id: { in: ids }, adAccount: { fbUser: { userId } } },
      include: { adAccount: true },
    });

    if (campaigns.length === 0) throw new NotFoundException('No campaigns found');

    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId } });
    if (!fbUser) throw new NotFoundException('Facebook account not connected');
    const accessToken = await this.facebookService.getDecryptedToken(fbUser.id);

    const results: { id: string; name: string; success: boolean; error?: string }[] = [];

    for (const campaign of campaigns) {
      try {
        try {
          await this.facebookService.deleteCampaign(campaign.campaignId, accessToken);
        } catch (fbErr: any) {
          this.logger.warn(
            `Bulk delete FB failed for ${campaign.name} (${campaign.campaignId}): ${fbErr.message}`,
          );
        }
        await this.deleteCampaignFromDb(campaign.id, campaign.campaignId);
        results.push({ id: campaign.id, name: campaign.name, success: true });
      } catch (err: any) {
        this.logger.warn(`Bulk delete failed for campaign ${campaign.name} (${campaign.campaignId}): ${err.message}`);
        results.push({ id: campaign.id, name: campaign.name, success: false, error: err.message });
      }
    }

    const deleted = results.filter(r => r.success).length;
    return {
      message: `${deleted} of ${campaigns.length} campaigns deleted`,
      results,
    };
  }

  // ─── Clone ───

  async clone(id: string, userId: string, newName?: string) {
    // Fetch source campaign with full detail
    const source = await this.prisma.campaign.findFirst({
      where: { id, adAccount: { fbUser: { userId } } },
      include: {
        adAccount: { select: { id: true, accountId: true, currency: true } },
        adsets: true,
        creativeCampaigns: { include: { creative: true } },
      },
    });
    if (!source) throw new NotFoundException('Campaign not found');

    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId } });
    if (!fbUser) throw new NotFoundException('Facebook account not connected');
    const accessToken = await this.facebookService.getDecryptedToken(fbUser.id);
    const fbAccountId = source.adAccount.accountId.replace('act_', '');

    const cloneName = newName || `Copy of ${source.name}`;

    // 1. Create campaign on Facebook
    const fbCampaign = await this.facebookService.createCampaign(
      fbAccountId,
      cloneName,
      source.objective,
      'PAUSED',
      Number(source.dailyBudget || 0),
      accessToken,
    );

    // 2. Save to local DB
    const savedCampaign = await this.prisma.campaign.create({
      data: {
        campaignId: fbCampaign.id,
        name: cloneName,
        objective: source.objective,
        status: 'PAUSED',
        dailyBudget: source.dailyBudget,
        adAccountId: source.adAccount.id,
      },
    });

    // 3. Clone ad sets
    const clonedAdSets: any[] = [];
    for (const adset of source.adsets) {
      try {
        const newAdSet = await this.facebookService.createAdSet(
          fbAccountId,
          fbCampaign.id,
          `Copy of ${adset.name}`,
          Number(adset.dailyBudget || 0),
          adset.optimizationGoal || 'REACH',
          'IMPRESSIONS',
          Number(adset.bidAmount) || null,
          adset.targeting || { geo_locations: { countries: ['TH'] } },
          'PAUSED',
          accessToken,
          adset.bidStrategy || 'LOWEST_COST_NO_BID',
        );

        const savedAdSet = await this.prisma.adSet.create({
          data: {
            adsetId: newAdSet.id,
            campaignId: savedCampaign.id,
            name: `Copy of ${adset.name}`,
            status: 'PAUSED',
            targeting: adset.targeting || { geo_locations: { countries: ['TH'] } },
            dailyBudget: adset.dailyBudget,
            optimizationGoal: adset.optimizationGoal,
            bidStrategy: adset.bidStrategy,
          },
        });
        clonedAdSets.push(savedAdSet);
      } catch (err: any) {
        this.logger.warn(`Failed to clone ad set ${adset.name}: ${err.message}`);
      }
    }

    // 4. Link creatives (if any)
    for (const cc of source.creativeCampaigns) {
      try {
        await this.prisma.creativeCampaign.create({
          data: {
            creativeId: cc.creativeId,
            campaignId: savedCampaign.id,
          },
        });
      } catch { /* ignore duplicates */ }
    }

    return {
      id: savedCampaign.id,
      campaignId: savedCampaign.campaignId,
      name: cloneName,
      status: 'PAUSED',
      objective: source.objective,
      dailyBudget: Number(source.dailyBudget || 0),
      clonedAdSets: clonedAdSets.length,
      message: `Campaign cloned successfully as "${cloneName}"`,
    };
  }
}
