import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookService } from '../facebook/facebook.service';
import { CampaignLockService } from '../campaign-lock/campaign-lock.service';
import { FbMutationService } from '../fb-mutation/fb-mutation.service';

@Injectable()
export class SchedulesService {
  private readonly logger = new Logger(SchedulesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly facebookService: FacebookService,
    private readonly campaignLock: CampaignLockService,
    private readonly fbMutation: FbMutationService,
  ) {}

  // ─── CRUD ───

  async list(userId: string) {
    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId } });
    if (!fbUser) return [];

    const schedules = await this.prisma.campaignSchedule.findMany({
      where: {
        campaign: {
          adAccount: { fbUserId: fbUser.id },
        },
      },
      include: {
        campaign: {
          select: { id: true, campaignId: true, name: true, status: true },
        },
      },
      orderBy: { executeAt: 'asc' },
    });

    return schedules.map(s => ({
      id: s.id,
      campaignId: s.campaignId,
      campaignName: s.campaign.name,
      campaignStatus: s.campaign.status,
      action: s.action,
      scheduleType: s.scheduleType,
      executeAt: s.executeAt,
      endTime: s.endTime,
      daysOfWeek: s.daysOfWeek ? JSON.parse(s.daysOfWeek) : null,
      timeOfDay: s.timeOfDay,
      enabled: s.enabled,
      lastRunAt: s.lastRunAt,
      lastError: s.lastError,
      runCount: s.runCount,
      createdAt: s.createdAt,
    }));
  }

  async get(userId: string, id: string) {
    const schedule = await this.findSchedule(userId, id);
    return schedule;
  }

  async create(userId: string, dto: any) {
    const { campaignId, action, scheduleType, executeAt, endTime, daysOfWeek, timeOfDay } = dto;

    if (!campaignId || !action || !scheduleType) {
      throw new BadRequestException('campaignId, action, and scheduleType are required');
    }

    // Verify campaign belongs to user
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        id: campaignId,
        adAccount: { fbUser: { userId } },
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    // Validate schedule config
    if (scheduleType === 'ONCE' && !executeAt) {
      throw new BadRequestException('executeAt is required for ONCE schedule');
    }
    if ((scheduleType === 'DAILY' || scheduleType === 'WEEKLY') && !timeOfDay) {
      throw new BadRequestException('timeOfDay is required for DAILY/WEEKLY schedule');
    }
    if (scheduleType === 'WEEKLY' && !daysOfWeek) {
      throw new BadRequestException('daysOfWeek is required for WEEKLY schedule');
    }

    const schedule = await this.prisma.campaignSchedule.create({
      data: {
        campaignId,
        action,
        scheduleType,
        executeAt: executeAt ? new Date(executeAt) : new Date(),
        endTime: endTime ? new Date(endTime) : null,
        daysOfWeek: daysOfWeek ? JSON.stringify(daysOfWeek) : null,
        timeOfDay: timeOfDay || null,
      },
    });

    return { id: schedule.id, message: `Schedule created: ${action} campaign at ${executeAt || timeOfDay}` };
  }

  async update(userId: string, id: string, dto: any) {
    await this.findSchedule(userId, id);

    const data: any = {};
    if (dto.action) data.action = dto.action;
    if (dto.scheduleType) data.scheduleType = dto.scheduleType;
    if (dto.executeAt) data.executeAt = new Date(dto.executeAt);
    if (dto.endTime !== undefined) data.endTime = dto.endTime ? new Date(dto.endTime) : null;
    if (dto.daysOfWeek !== undefined) data.daysOfWeek = dto.daysOfWeek ? JSON.stringify(dto.daysOfWeek) : null;
    if (dto.timeOfDay !== undefined) data.timeOfDay = dto.timeOfDay || null;
    if (dto.enabled !== undefined) data.enabled = dto.enabled;

    await this.prisma.campaignSchedule.update({ where: { id }, data });
    return { message: 'Schedule updated' };
  }

  async remove(userId: string, id: string) {
    await this.findSchedule(userId, id);
    await this.prisma.campaignSchedule.delete({ where: { id } });
    return { message: 'Schedule deleted' };
  }

  async toggle(userId: string, id: string) {
    const schedule = await this.findSchedule(userId, id);
    const updated = await this.prisma.campaignSchedule.update({
      where: { id },
      data: { enabled: !schedule.enabled },
    });
    return { enabled: updated.enabled, message: updated.enabled ? 'Schedule enabled' : 'Schedule paused' };
  }

  async runNow(userId: string, id: string) {
    const schedule = await this.findSchedule(userId, id);
    return this.executeSchedule(schedule);
  }

  // ─── Check schedules (scheduled via BullMQ every minute) ───

  async checkSchedules() {
    this.logger.debug('Checking campaign schedules...');
    const now = new Date();

    const schedules = await this.prisma.campaignSchedule.findMany({
      where: { enabled: true },
      include: {
        campaign: {
          include: { adAccount: { include: { fbUser: true } } },
        },
      },
    });

    for (const schedule of schedules) {
      try {
        if (this.shouldRun(schedule, now)) {
          await this.executeSchedule(schedule);
        }
      } catch (err: any) {
        this.logger.error(`Schedule ${schedule.id} error: ${err.message}`);
        await this.prisma.campaignSchedule.update({
          where: { id: schedule.id },
          data: { lastError: err.message },
        });
      }
    }
  }

  // ─── Schedule logic ───

  private shouldRun(schedule: any, now: Date): boolean {
    switch (schedule.scheduleType) {
      case 'ONCE': {
        if (schedule.lastRunAt) return false; // already ran
        const execAt = new Date(schedule.executeAt);
        return now >= execAt && now.getTime() - execAt.getTime() < 60_000;
      }
      case 'DAILY': {
        if (!schedule.timeOfDay) return false;
        if (schedule.lastRunAt) {
          const last = new Date(schedule.lastRunAt);
          if (
            last.getFullYear() === now.getFullYear() &&
            last.getMonth() === now.getMonth() &&
            last.getDate() === now.getDate()
          ) return false;
        }
        const [h, m] = schedule.timeOfDay.split(':').map(Number);
        return now.getHours() === h && now.getMinutes() === m;
      }
      case 'WEEKLY': {
        if (!schedule.timeOfDay || !schedule.daysOfWeek) return false;
        if (schedule.lastRunAt) {
          const last = new Date(schedule.lastRunAt);
          if (
            last.getFullYear() === now.getFullYear() &&
            last.getMonth() === now.getMonth() &&
            last.getDate() === now.getDate()
          ) return false;
        }
        const days: number[] = JSON.parse(schedule.daysOfWeek);
        if (!days.includes(now.getDay())) return false;
        const [h, m] = schedule.timeOfDay.split(':').map(Number);
        return now.getHours() === h && now.getMinutes() === m;
      }
      default:
        return false;
    }
  }

  private async executeSchedule(schedule: any) {
    const { id, action, campaign } = schedule;
    const fbStatus = action === 'START' ? 'ACTIVE' : 'PAUSED';

    this.logger.log(`Executing schedule ${id}: ${action} campaign ${campaign.campaignId}`);

    try {
      const accessToken = await this.facebookService.getDecryptedToken(campaign.adAccount.fbUser.id);
      await this.campaignLock.withCampaignLock(
        campaign.id,
        async () => {
          await this.fbMutation.setCampaignStatus(
            {
              campaignDbId: campaign.id,
              fbCampaignId: campaign.campaignId,
              accountId: campaign.adAccount.accountId,
              accessToken,
              fbUserId: campaign.adAccount.fbUser.id,
              status: fbStatus,
            },
            `Schedules:${action}`,
          );
        },
        `Schedules:${action}`,
      );

      await this.prisma.campaignSchedule.update({
        where: { id },
        data: { lastRunAt: new Date(), lastError: null, runCount: { increment: 1 } },
      });

      this.logger.log(`Schedule ${id} executed: campaign ${campaign.name} → ${action}`);
    } catch (err: any) {
      this.logger.error(`Schedule ${id} failed: ${err.message}`);
      await this.prisma.campaignSchedule.update({
        where: { id },
        data: { lastError: err.message },
      });
      throw err;
    }
  }

  // ─── Helpers ───

  private async findSchedule(userId: string, id: string) {
    const schedule = await this.prisma.campaignSchedule.findFirst({
      where: {
        id,
        campaign: {
          adAccount: { fbUser: { userId } },
        },
      },
      include: {
        campaign: {
          select: { id: true, campaignId: true, name: true, status: true },
        },
      },
    });
    if (!schedule) throw new NotFoundException('Schedule not found');
    return schedule;
  }
}
