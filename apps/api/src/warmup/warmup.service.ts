import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookService } from '../facebook/facebook.service';

// Budget progression: % of target per day
const WARMUP_BUDGET_PCT: Record<number, number> = {
  1: 0.10, 2: 0.20, 3: 0.35, 4: 0.50, 5: 0.65, 6: 0.80, 7: 1.00,
};

const WARMUP_DAYS = 7;

@Injectable()
export class WarmupService {
  private readonly logger = new Logger(WarmupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly facebookService: FacebookService,
  ) {}

  /** Start warmup for an ad account */
  async start(adAccountId: string, userId: string, targetDailyBudget: number) {
    const account = await this.prisma.adAccount.findFirst({
      where: { id: adAccountId, fbUser: { userId } },
    });
    if (!account) throw new NotFoundException('Ad account not found');

    if (account.isWarmingUp) {
      throw new BadRequestException(`Account is already warming up (Day ${account.warmupDay}/${WARMUP_DAYS})`);
    }

    await this.prisma.adAccount.update({
      where: { id: adAccountId },
      data: {
        isWarmingUp: true,
        warmupDay: 1,
        warmupBaseBudget: targetDailyBudget,
      },
    });

    // Create the Day 1 campaign immediately
    await this.createOrUpdateWarmupCampaign(account, 1);

    this.logger.log(`Started warmup for ${account.name} — target $${targetDailyBudget}/day`);
    return { message: `Warmup started — Day 1/${WARMUP_DAYS}`, day: 1, budget: this.getBudgetForDay(1, targetDailyBudget) };
  }

  /** Stop warmup early */
  async stop(adAccountId: string, userId: string) {
    const account = await this.prisma.adAccount.findFirst({
      where: { id: adAccountId, fbUser: { userId } },
    });
    if (!account) throw new NotFoundException('Ad account not found');
    if (!account.isWarmingUp) throw new BadRequestException('Account is not warming up');

    await this.prisma.adAccount.update({
      where: { id: adAccountId },
      data: { isWarmingUp: false, warmupDay: 0 },
    });

    return { message: 'Warmup stopped' };
  }

  /** Skip to a specific day */
  async skipTo(adAccountId: string, userId: string, day: number) {
    const account = await this.prisma.adAccount.findFirst({
      where: { id: adAccountId, fbUser: { userId } },
    });
    if (!account) throw new NotFoundException('Ad account not found');
    if (!account.isWarmingUp) throw new BadRequestException('Account is not warming up');
    if (day < 1 || day > WARMUP_DAYS) throw new BadRequestException(`Day must be between 1 and ${WARMUP_DAYS}`);

    await this.prisma.adAccount.update({
      where: { id: adAccountId },
      data: { warmupDay: day },
    });

    await this.createOrUpdateWarmupCampaign(account, day);

    return { message: `Skipped to Day ${day}`, day: day, budget: this.getBudgetForDay(day, Number(account.warmupBaseBudget)) };
  }

  /** Get warmup status for all accounts of a user */
  async getStatus(userId: string) {
    const accounts = await this.prisma.adAccount.findMany({
      where: { fbUser: { userId }, isWarmingUp: true },
      select: {
        id: true,
        name: true,
        warmupDay: true,
        warmupBaseBudget: true,
      },
    });

    return accounts.map(a => ({
      id: a.id,
      name: a.name,
      day: a.warmupDay,
      totalDays: WARMUP_DAYS,
      progress: Math.round((a.warmupDay / WARMUP_DAYS) * 100),
      targetBudget: Number(a.warmupBaseBudget),
      currentBudget: a.warmupBaseBudget
        ? this.getBudgetForDay(a.warmupDay, Number(a.warmupBaseBudget))
        : 0,
    }));
  }

  /** Cron — runs every day at midnight to advance warmup */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: 'warmup-advance' })
  async advanceWarmup() {
    const warmingAccounts = await this.prisma.adAccount.findMany({
      where: { isWarmingUp: true },
    });

    for (const account of warmingAccounts) {
      try {
        const nextDay = account.warmupDay + 1;

        if (nextDay > WARMUP_DAYS) {
          // Warmup complete
          await this.prisma.adAccount.update({
            where: { id: account.id },
            data: { isWarmingUp: false, warmupDay: 0 },
          });
          this.logger.log(`Warmup complete for ${account.name}`);
          continue;
        }

        // Advance day
        await this.prisma.adAccount.update({
          where: { id: account.id },
          data: { warmupDay: nextDay },
        });

        await this.createOrUpdateWarmupCampaign(account, nextDay);
        this.logger.log(`Warmup Day ${nextDay}/${WARMUP_DAYS} for ${account.name}`);
      } catch (err: any) {
        this.logger.error(`Warmup advance failed for ${account.name}: ${err.message}`);
      }
    }
  }

  /** Manually trigger warmup advance (for testing) */
  async manualTick(userId: string) {
    const warmingAccounts = await this.prisma.adAccount.findMany({
      where: { isWarmingUp: true, fbUser: { userId } },
    });

    const results: any[] = [];
    for (const account of warmingAccounts) {
      const nextDay = account.warmupDay + 1;

      if (nextDay > WARMUP_DAYS) {
        await this.prisma.adAccount.update({
          where: { id: account.id },
          data: { isWarmingUp: false, warmupDay: 0 },
        });
        results.push({ name: account.name, status: 'completed' });
        continue;
      }

      await this.prisma.adAccount.update({
        where: { id: account.id },
        data: { warmupDay: nextDay },
      });

      await this.createOrUpdateWarmupCampaign(account, nextDay);
      results.push({ name: account.name, status: `advanced to Day ${nextDay}` });
    }

    if (results.length === 0) return { message: 'No warming accounts found' };
    return { results };
  }

  // ─── Helpers ───

  private getBudgetForDay(day: number, target: number): number {
    const pct = WARMUP_BUDGET_PCT[Math.min(day, WARMUP_DAYS)] || 0;
    return Math.round(target * pct);
  }

  private async createOrUpdateWarmupCampaign(
    account: { id: string; accountId: string; name: string; warmupBaseBudget: any },
    day: number,
  ) {
    const fbUser = await this.prisma.fbUser.findFirst({
      where: { adAccounts: { some: { id: account.id } } },
    });
    if (!fbUser) return;

    const accessToken = await this.facebookService.getDecryptedToken(fbUser.id);
    const fbAccountId = account.accountId.replace('act_', '');
    const targetBudget = Number(account.warmupBaseBudget || 0);
    const dayBudget = this.getBudgetForDay(day, targetBudget);
    const campaignName = `🔥 Warmup D${day} — ${account.name}`;

    // Look for existing warmup campaign by name pattern
    const existing = await this.prisma.campaign.findFirst({
      where: {
        adAccountId: account.id,
        name: { startsWith: '🔥 Warmup' },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      // Update budget of existing campaign
      try {
        await this.facebookService.updateCampaignBudget(existing.campaignId, dayBudget, accessToken);
        await this.prisma.campaign.update({
          where: { id: existing.id },
          data: {
            name: campaignName,
            dailyBudget: dayBudget,
            status: 'ACTIVE' as any,
          },
        });
      } catch (err: any) {
        this.logger.warn(`Failed to update warmup campaign: ${err.message}`);
      }
    } else {
      // Create new campaign
      try {
        const fbCampaign = await this.facebookService.createCampaign(
          fbAccountId,
          campaignName,
          'OUTCOME_REACH',
          'ACTIVE',
          dayBudget,
          accessToken,
        );

        await this.prisma.campaign.create({
          data: {
            campaignId: fbCampaign.id,
            name: campaignName,
            objective: 'OUTCOME_REACH' as any,
            status: 'ACTIVE' as any,
            dailyBudget: dayBudget,
            adAccountId: account.id,
          },
        });
      } catch (err: any) {
        this.logger.warn(`Failed to create warmup campaign: ${err.message}`);
      }
    }
  }
}
