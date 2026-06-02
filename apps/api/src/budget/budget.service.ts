import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookService } from '../facebook/facebook.service';

@Injectable()
export class BudgetService {
  private readonly logger = new Logger(BudgetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly facebookService: FacebookService,
  ) {}

  // ─── CRUD ───

  async create(userId: string, dto: {
    name: string;
    campaignId?: string;
    adAccountId?: string;
    action: string;
    value?: number;
    cronExpr: string;
    timezone?: string;
  }) {
    if (!['PAUSE', 'RESUME', 'SET_BUDGET', 'ADJUST_PERCENT'].includes(dto.action)) {
      throw new BadRequestException('Invalid action. Must be PAUSE, RESUME, SET_BUDGET, or ADJUST_PERCENT');
    }
    if (!dto.cronExpr || dto.cronExpr.trim() === '') {
      throw new BadRequestException('Cron expression is required');
    }
    if (dto.action === 'SET_BUDGET' && (!dto.value || dto.value <= 0)) {
      throw new BadRequestException('SET_BUDGET requires a positive value');
    }
    if (dto.action === 'ADJUST_PERCENT' && (!dto.value || dto.value === 0)) {
      throw new BadRequestException('ADJUST_PERCENT requires a non-zero percentage value');
    }

    return this.prisma.budgetSchedule.create({
      data: {
        userId,
        name: dto.name,
        campaignId: dto.campaignId || null,
        adAccountId: dto.adAccountId || null,
        action: dto.action,
        value: dto.value ? dto.value : undefined,
        cronExpr: dto.cronExpr,
        timezone: dto.timezone || 'Asia/Bangkok',
      },
    });
  }

  async list(userId: string) {
    const schedules = await this.prisma.budgetSchedule.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return schedules.map(s => ({
      ...s,
      value: s.value ? Number(s.value) : null,
    }));
  }

  async getById(userId: string, id: string) {
    const schedule = await this.prisma.budgetSchedule.findFirst({
      where: { id, userId },
    });
    if (!schedule) throw new NotFoundException('Budget schedule not found');
    return {
      ...schedule,
      value: schedule.value ? Number(schedule.value) : null,
    };
  }

  async update(userId: string, id: string, dto: {
    name?: string;
    campaignId?: string;
    adAccountId?: string;
    action?: string;
    value?: number;
    cronExpr?: string;
    timezone?: string;
    isEnabled?: boolean;
  }) {
    const existing = await this.prisma.budgetSchedule.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('Budget schedule not found');

    if (dto.action && !['PAUSE', 'RESUME', 'SET_BUDGET', 'ADJUST_PERCENT'].includes(dto.action)) {
      throw new BadRequestException('Invalid action');
    }

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.campaignId !== undefined) updateData.campaignId = dto.campaignId || null;
    if (dto.adAccountId !== undefined) updateData.adAccountId = dto.adAccountId || null;
    if (dto.action !== undefined) updateData.action = dto.action;
    if (dto.value !== undefined) updateData.value = dto.value;
    if (dto.cronExpr !== undefined) updateData.cronExpr = dto.cronExpr;
    if (dto.timezone !== undefined) updateData.timezone = dto.timezone;
    if (dto.isEnabled !== undefined) updateData.isEnabled = dto.isEnabled;

    return this.prisma.budgetSchedule.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(userId: string, id: string) {
    const existing = await this.prisma.budgetSchedule.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('Budget schedule not found');

    await this.prisma.budgetSchedule.delete({ where: { id } });
    return { message: 'Budget schedule deleted' };
  }

  async toggle(userId: string, id: string) {
    const existing = await this.prisma.budgetSchedule.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('Budget schedule not found');

    return this.prisma.budgetSchedule.update({
      where: { id },
      data: { isEnabled: !existing.isEnabled },
    });
  }

  // ─── Cron Execution ───

  @Cron('0 * * * *') // Every hour
  async checkSchedules() {
    this.logger.log('⏰ Checking budget schedules...');

    const now = new Date();
    const schedules = await this.prisma.budgetSchedule.findMany({
      where: { isEnabled: true },
      include: { user: true },
    });

    for (const schedule of schedules) {
      try {
        await this.evaluateAndExecute(schedule);
      } catch (err: any) {
        this.logger.error(`Failed to execute schedule ${schedule.id} (${schedule.name}): ${err.message}`);
      }
    }
  }

  private async evaluateAndExecute(schedule: any) {
    // Parse cron expression and check if it should run now
    if (!this.shouldRunNow(schedule.cronExpr, schedule.timezone, schedule.lastRunAt)) {
      return;
    }

    this.logger.log(`⚡ Executing budget schedule: ${schedule.name} (${schedule.action})`);

    // Get the user's Facebook token
    const fbUser = await this.prisma.fbUser.findFirst({
      where: { userId: schedule.userId },
    });
    if (!fbUser) {
      this.logger.warn(`User ${schedule.userId} has no connected Facebook account, skipping`);
      return;
    }

    const accessToken = await this.facebookService.getDecryptedToken(fbUser.id);

    switch (schedule.action) {
      case 'PAUSE':
        await this.executePause(schedule, accessToken);
        break;
      case 'RESUME':
        await this.executeResume(schedule, accessToken);
        break;
      case 'SET_BUDGET':
        await this.executeSetBudget(schedule, accessToken);
        break;
      case 'ADJUST_PERCENT':
        await this.executeAdjustPercent(schedule, accessToken);
        break;
    }

    // Update last run time
    await this.prisma.budgetSchedule.update({
      where: { id: schedule.id },
      data: { lastRunAt: new Date() },
    });

    this.logger.log(`✅ Budget schedule executed: ${schedule.name}`);
  }

  private async executePause(schedule: any, accessToken: string) {
    if (schedule.campaignId) {
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: schedule.campaignId },
      });
      if (campaign) {
        await this.facebookService.updateCampaignStatus('', campaign.campaignId, 'PAUSED', accessToken);
        await this.prisma.campaign.update({
          where: { id: schedule.campaignId },
          data: { status: 'PAUSED' },
        });
      }
    } else if (schedule.adAccountId) {
      // Pause all active campaigns under this account
      const campaigns = await this.prisma.campaign.findMany({
        where: { adAccountId: schedule.adAccountId, status: 'ACTIVE' },
      });
      for (const campaign of campaigns) {
        try {
          await this.facebookService.updateCampaignStatus('', campaign.campaignId, 'PAUSED', accessToken);
        } catch (err: any) {
          this.logger.warn(`Failed to pause campaign ${campaign.name}: ${err.message}`);
        }
      }
      await this.prisma.campaign.updateMany({
        where: { adAccountId: schedule.adAccountId, status: 'ACTIVE' },
        data: { status: 'PAUSED' },
      });
    }
  }

  private async executeResume(schedule: any, accessToken: string) {
    if (schedule.campaignId) {
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: schedule.campaignId },
      });
      if (campaign) {
        await this.facebookService.updateCampaignStatus('', campaign.campaignId, 'ACTIVE', accessToken);
        await this.prisma.campaign.update({
          where: { id: schedule.campaignId },
          data: { status: 'ACTIVE' },
        });
      }
    } else if (schedule.adAccountId) {
      const campaigns = await this.prisma.campaign.findMany({
        where: { adAccountId: schedule.adAccountId, status: 'PAUSED' },
      });
      for (const campaign of campaigns) {
        try {
          await this.facebookService.updateCampaignStatus('', campaign.campaignId, 'ACTIVE', accessToken);
        } catch (err: any) {
          this.logger.warn(`Failed to resume campaign ${campaign.name}: ${err.message}`);
        }
      }
      await this.prisma.campaign.updateMany({
        where: { adAccountId: schedule.adAccountId, status: 'PAUSED' },
        data: { status: 'ACTIVE' },
      });
    }
  }

  private async executeSetBudget(schedule: any, accessToken: string) {
    const budgetValue = Number(schedule.value);
    if (budgetValue <= 0) {
      this.logger.warn(`Invalid budget value ${budgetValue} for schedule ${schedule.name}`);
      return;
    }

    if (schedule.campaignId) {
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: schedule.campaignId },
      });
      if (campaign) {
        await this.facebookService.updateCampaignBudget(campaign.campaignId, budgetValue, accessToken);
        await this.prisma.campaign.update({
          where: { id: schedule.campaignId },
          data: { dailyBudget: budgetValue },
        });
      }
    } else if (schedule.adAccountId) {
      // Set budget for all campaigns under this account
      const campaigns = await this.prisma.campaign.findMany({
        where: { adAccountId: schedule.adAccountId },
      });
      for (const campaign of campaigns) {
        try {
          await this.facebookService.updateCampaignBudget(campaign.campaignId, budgetValue, accessToken);
          await this.prisma.campaign.update({
            where: { id: campaign.id },
            data: { dailyBudget: budgetValue },
          });
        } catch (err: any) {
          this.logger.warn(`Failed to set budget for campaign ${campaign.name}: ${err.message}`);
        }
      }
    }
  }

  private async executeAdjustPercent(schedule: any, accessToken: string) {
    const percent = Number(schedule.value);
    if (percent === 0) return;

    if (schedule.campaignId) {
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: schedule.campaignId },
      });
      if (campaign) {
        const currentBudget = Number(campaign.dailyBudget || 0);
        const newBudget = Math.max(1, Math.round(currentBudget * (1 + percent / 100)));
        await this.facebookService.updateCampaignBudget(campaign.campaignId, newBudget, accessToken);
        await this.prisma.campaign.update({
          where: { id: schedule.campaignId },
          data: { dailyBudget: newBudget },
        });
        this.logger.log(`Adjusted budget for ${campaign.name}: ${currentBudget} → ${newBudget} (${percent > 0 ? '+' : ''}${percent}%)`);
      }
    } else if (schedule.adAccountId) {
      const campaigns = await this.prisma.campaign.findMany({
        where: { adAccountId: schedule.adAccountId },
      });
      for (const campaign of campaigns) {
        try {
          const currentBudget = Number(campaign.dailyBudget || 0);
          const newBudget = Math.max(1, Math.round(currentBudget * (1 + percent / 100)));
          await this.facebookService.updateCampaignBudget(campaign.campaignId, newBudget, accessToken);
          await this.prisma.campaign.update({
            where: { id: campaign.id },
            data: { dailyBudget: newBudget },
          });
        } catch (err: any) {
          this.logger.warn(`Failed to adjust budget for campaign ${campaign.name}: ${err.message}`);
        }
      }
    }
  }

  private shouldRunNow(cronExpr: string, timezone: string, lastRunAt: Date | null): boolean {
    const parts = cronExpr.trim().split(/\s+/);
    if (parts.length !== 5) {
      this.logger.warn(`Invalid cron expression: ${cronExpr}`);
      return false;
    }

    const [minutePart, hourPart, dayOfMonthPart, monthPart, dayOfWeekPart] = parts;
    const { minute, hour, dayOfMonth, month, dayOfWeek } = this.getNowInTimezone(timezone ?? 'UTC');

    if (!this.cronPartMatches(minutePart, minute)) return false;
    if (!this.cronPartMatches(hourPart, hour)) return false;
    if (!this.cronPartMatches(dayOfMonthPart, dayOfMonth)) return false;
    if (!this.cronPartMatches(monthPart, month)) return false;
    if (!this.cronPartMatches(dayOfWeekPart, dayOfWeek)) return false;

    // Prevent re-running in the same hour (using timezone-aware comparison)
    if (lastRunAt) {
      const lastParts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone ?? 'UTC',
        hour: 'numeric', day: 'numeric', month: 'numeric', hour12: false,
      }).formatToParts(new Date(lastRunAt));
      const getL = (type: string) => lastParts.find(p => p.type === type)?.value ?? '0';
      if (
        parseInt(getL('hour')) === hour &&
        parseInt(getL('day')) === dayOfMonth &&
        parseInt(getL('month')) === month
      ) return false;
    }

    return true;
  }

  private getNowInTimezone(tz: string): { minute: number; hour: number; dayOfMonth: number; month: number; dayOfWeek: number } {
    const now = new Date();
    const safeZone = (() => {
      try { Intl.DateTimeFormat(undefined, { timeZone: tz }); return tz; } catch {
        this.logger.warn(`Invalid timezone "${tz}", falling back to UTC`);
        return 'UTC';
      }
    })();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: safeZone,
      hour: 'numeric', minute: 'numeric',
      day: 'numeric', month: 'numeric',
      hour12: false,
    }).formatToParts(now);
    const get = (type: string) => parts.find(p => p.type === type)?.value ?? '0';

    // Get day of week separately using locale-independent en-US format
    const weekdayIdx = new Intl.DateTimeFormat('en-US', {
      timeZone: safeZone,
      weekday: 'short',
    }).format(now);
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayOfWeek = weekdays.indexOf(weekdayIdx);

    return {
      minute: parseInt(get('minute')),
      hour: parseInt(get('hour')),
      dayOfMonth: parseInt(get('day')),
      month: parseInt(get('month')),
      dayOfWeek: dayOfWeek === -1 ? 0 : dayOfWeek,
    };
  }

  private cronPartMatches(pattern: string, value: number): boolean {
    if (pattern === '*') return true;

    // Handle */N (every N)
    if (pattern.startsWith('*/')) {
      const step = parseInt(pattern.slice(2), 10);
      if (isNaN(step) || step <= 0) return false;
      return value % step === 0;
    }

    // Handle comma-separated values
    if (pattern.includes(',')) {
      return pattern.split(',').some(p => this.cronPartMatches(p.trim(), value));
    }

    // Handle ranges (e.g., 9-17)
    if (pattern.includes('-')) {
      const [start, end] = pattern.split('-').map(n => parseInt(n, 10));
      return value >= start && value <= end;
    }

    // Exact value
    return parseInt(pattern, 10) === value;
  }
}
