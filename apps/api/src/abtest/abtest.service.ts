import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookService } from '../facebook/facebook.service';

interface CreateAbtestDto {
  sourceCampaignId: string;
  variants: Array<{ name: string; creativeMessage?: string; dailyBudget?: number }>;
}

@Injectable()
export class AbtestService {
  private readonly logger = new Logger(AbtestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly facebookService: FacebookService,
  ) {}

  async create(userId: string, dto: CreateAbtestDto) {
    if (!dto.variants || dto.variants.length < 2) {
      throw new BadRequestException('Need at least 2 variants');
    }
    if (dto.variants.length > 5) {
      throw new BadRequestException('Max 5 variants');
    }

    const source = await this.prisma.campaign.findFirst({
      where: { id: dto.sourceCampaignId, adAccount: { fbUser: { userId } } },
      include: { adAccount: true },
    });
    if (!source) throw new NotFoundException('Source campaign not found');

    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId } });
    if (!fbUser) throw new NotFoundException('Facebook account not connected');
    const accessToken = await this.facebookService.getDecryptedToken(fbUser.id);
    const fbAccountId = source.adAccount.accountId.replace('act_', '');

    // Create the A/B test group record
    const abtest = await this.prisma.abTest.create({
      data: {
        userId,
        name: `A/B: ${source.name}`,
        sourceCampaignId: source.id,
        variantCount: dto.variants.length,
        status: 'ACTIVE',
      },
    });

    const createdVariants: any[] = [];

    for (const v of dto.variants) {
      try {
        const budget = v.dailyBudget || Number(source.dailyBudget || 100);
        const fbCampaign = await this.facebookService.createCampaign(
          fbAccountId,
          v.name,
          source.objective,
          'ACTIVE',
          budget,
          accessToken,
        );

        const saved = await this.prisma.abTestVariant.create({
          data: {
            abTestId: abtest.id,
            campaignId: fbCampaign.id,
            name: v.name,
            dailyBudget: budget,
            objective: source.objective,
            status: 'ACTIVE',
          },
        });

        createdVariants.push({
          id: saved.id,
          fbCampaignId: fbCampaign.id,
          name: v.name,
          budget,
        });
      } catch (err: any) {
        this.logger.error(`Failed to create variant "${v.name}": ${err.message}`);
      }
    }

    if (createdVariants.length === 0) {
      await this.prisma.abTest.update({ where: { id: abtest.id }, data: { status: 'FAILED' } });
      throw new BadRequestException('All variants failed to create');
    }

    await this.prisma.abTest.update({
      where: { id: abtest.id },
      data: { variantCount: createdVariants.length, status: 'ACTIVE' },
    });

    return {
      id: abtest.id,
      name: abtest.name,
      variants: createdVariants,
    };
  }

  async list(userId: string) {
    const tests = await this.prisma.abTest.findMany({
      where: { userId },
      include: {
        variants: true,
        sourceCampaign: { select: { name: true, campaignId: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return tests.map(t => ({
      id: t.id,
      name: t.name,
      sourceCampaign: t.sourceCampaign.name,
      status: t.status,
      startedAt: t.createdAt,
      variantCount: t.variantCount,
      variants: t.variants.map(v => ({
        id: v.id,
        name: v.name,
        fbCampaignId: v.campaignId,
        status: v.status,
        dailyBudget: Number(v.dailyBudget),
        impressions: 0,
        clicks: 0,
        spend: 0,
        ctr: 0,
        cpc: 0,
        conversions: 0,
      })),
    }));
  }

  async getVariants(userId: string, abTestId: string) {
    const test = await this.prisma.abTest.findFirst({
      where: { id: abTestId, userId },
      include: {
        variants: true,
        sourceCampaign: {
          include: {
            insights: { orderBy: { date: 'desc' }, take: 1 },
          },
        },
      },
    });
    if (!test) throw new NotFoundException('A/B test not found');

    const variantData = await Promise.all(
      test.variants.map(async (v) => {
        const latestInsight = await this.prisma.campaignInsight.findFirst({
          where: { campaign: { campaignId: v.campaignId } },
          orderBy: { date: 'desc' },
        });

        return {
          id: v.id,
          name: v.name,
          status: v.status,
          campaignId: v.campaignId,
          dailyBudget: Number(v.dailyBudget),
          impressions: latestInsight?.impressions || 0,
          clicks: latestInsight?.clicks || 0,
          spend: Number(latestInsight?.spend || 0),
          ctr: latestInsight ? Number(latestInsight.ctr) * 100 : 0,
          cpc: Number(latestInsight?.cpc || 0),
          conversions: latestInsight?.conversions || 0,
        };
      }),
    );

    return {
      id: test.id,
      name: test.name,
      sourceCampaign: test.sourceCampaign.name,
      status: test.status,
      variants: variantData,
    };
  }

  async stop(userId: string, abTestId: string) {
    const test = await this.prisma.abTest.findFirst({
      where: { id: abTestId, userId },
      include: { variants: true },
    });
    if (!test) throw new NotFoundException('A/B test not found');

    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId } });
    if (fbUser) {
      const accessToken = await this.facebookService.getDecryptedToken(fbUser.id);
      for (const v of test.variants) {
        try {
          await this.facebookService.updateCampaignStatus('', v.campaignId, 'PAUSED', accessToken);
        } catch { /* ignore individual failures */ }
      }
    }

    await this.prisma.abTest.update({
      where: { id: abTestId },
      data: { status: 'COMPLETED' },
    });

    await this.prisma.abTestVariant.updateMany({
      where: { abTestId },
      data: { status: 'PAUSED' },
    });

    return { message: 'A/B test stopped' };
  }

  async pauseAll(userId: string, abTestId: string) {
    const test = await this.prisma.abTest.findFirst({
      where: { id: abTestId, userId },
      include: { variants: true },
    });
    if (!test) throw new NotFoundException('A/B test not found');
    if (test.status !== 'ACTIVE') throw new BadRequestException('Test is not active');

    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId } });
    if (fbUser) {
      const accessToken = await this.facebookService.getDecryptedToken(fbUser.id);
      for (const v of test.variants) {
        if (v.status === 'ACTIVE') {
          try {
            await this.facebookService.updateCampaignStatus('', v.campaignId, 'PAUSED', accessToken);
          } catch { /* ignore */ }
        }
      }
    }

    await this.prisma.abTestVariant.updateMany({
      where: { abTestId, status: 'ACTIVE' },
      data: { status: 'PAUSED' },
    });

    return { message: 'All variants paused' };
  }

  async resumeAll(userId: string, abTestId: string) {
    const test = await this.prisma.abTest.findFirst({
      where: { id: abTestId, userId },
      include: { variants: true },
    });
    if (!test) throw new NotFoundException('A/B test not found');
    if (test.status !== 'ACTIVE') throw new BadRequestException('Test is not active');

    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId } });
    if (fbUser) {
      const accessToken = await this.facebookService.getDecryptedToken(fbUser.id);
      for (const v of test.variants) {
        if (v.status === 'PAUSED') {
          try {
            await this.facebookService.updateCampaignStatus('', v.campaignId, 'ACTIVE', accessToken);
          } catch { /* ignore */ }
        }
      }
    }

    await this.prisma.abTestVariant.updateMany({
      where: { abTestId, status: 'PAUSED' },
      data: { status: 'ACTIVE' },
    });

    return { message: 'All variants resumed' };
  }

  async toggleVariant(userId: string, variantId: string) {
    const variant = await this.prisma.abTestVariant.findFirst({
      where: { id: variantId, abTest: { userId } },
      include: { abTest: true },
    });
    if (!variant) throw new NotFoundException('Variant not found');
    if (variant.abTest.status !== 'ACTIVE') throw new BadRequestException('A/B test is not active');

    const newStatus = variant.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    const fbStatus = variant.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';

    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId } });
    if (fbUser) {
      const accessToken = await this.facebookService.getDecryptedToken(fbUser.id);
      try {
        await this.facebookService.updateCampaignStatus('', variant.campaignId, fbStatus, accessToken);
      } catch (err: any) {
        this.logger.warn(`Failed to update campaign status: ${err.message}`);
      }
    }

    await this.prisma.abTestVariant.update({
      where: { id: variantId },
      data: { status: newStatus },
    });

    return { id: variantId, status: newStatus, message: `Variant ${newStatus === 'ACTIVE' ? 'resumed' : 'paused'}` };
  }

  async editVariant(userId: string, variantId: string, body: { name?: string; dailyBudget?: number }) {
    const variant = await this.prisma.abTestVariant.findFirst({
      where: { id: variantId, abTest: { userId } },
      include: { abTest: true },
    });
    if (!variant) throw new NotFoundException('Variant not found');

    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId } });
    if (fbUser) {
      const accessToken = await this.facebookService.getDecryptedToken(fbUser.id);
      if (body.name && body.name !== variant.name) {
        try {
          await this.facebookService.updateCampaignName(variant.campaignId, body.name, accessToken);
        } catch (err: any) {
          this.logger.warn(`Failed to update campaign name: ${err.message}`);
        }
      }
      if (body.dailyBudget && Number(body.dailyBudget) !== Number(variant.dailyBudget)) {
        try {
          await this.facebookService.updateCampaignBudget(variant.campaignId, body.dailyBudget, accessToken);
        } catch (err: any) {
          this.logger.warn(`Failed to update campaign budget: ${err.message}`);
        }
      }
    }

    const updateData: any = {};
    if (body.name) updateData.name = body.name;
    if (body.dailyBudget) updateData.dailyBudget = body.dailyBudget;

    if (Object.keys(updateData).length > 0) {
      await this.prisma.abTestVariant.update({
        where: { id: variantId },
        data: updateData,
      });
    }

    return {
      id: variantId,
      name: body.name || variant.name,
      dailyBudget: body.dailyBudget || Number(variant.dailyBudget),
      message: 'Variant updated',
    };
  }

  async delete(userId: string, abTestId: string) {
    const test = await this.prisma.abTest.findFirst({
      where: { id: abTestId, userId },
      include: { variants: true },
    });
    if (!test) throw new NotFoundException('A/B test not found');

    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId } });
    if (fbUser) {
      const accessToken = await this.facebookService.getDecryptedToken(fbUser.id);
      for (const v of test.variants) {
        try {
          await this.facebookService.deleteCampaign(v.campaignId, accessToken);
        } catch (err: any) {
          this.logger.warn(`Failed to delete variant campaign ${v.campaignId}: ${err.message}`);
        }
      }
    }

    await this.prisma.abTest.delete({ where: { id: abTestId } });
    this.logger.log(`Deleted A/B test ${test.name} with ${test.variants.length} variants`);
    return { message: 'A/B test deleted' };
  }

  async deleteVariant(userId: string, variantId: string) {
    const variant = await this.prisma.abTestVariant.findFirst({
      where: { id: variantId, abTest: { userId } },
      include: { abTest: true },
    });
    if (!variant) throw new NotFoundException('Variant not found');

    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId } });
    if (fbUser) {
      const accessToken = await this.facebookService.getDecryptedToken(fbUser.id);
      try {
        await this.facebookService.deleteCampaign(variant.campaignId, accessToken);
      } catch (err: any) {
        this.logger.warn(`Failed to delete variant campaign: ${err.message}`);
      }
    }

    await this.prisma.abTestVariant.delete({ where: { id: variantId } });
    return { message: 'Variant deleted' };
  }
}
