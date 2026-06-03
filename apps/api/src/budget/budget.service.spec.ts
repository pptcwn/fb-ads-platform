import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { BudgetService } from './budget.service';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookService } from '../facebook/facebook.service';
import { CampaignLockService } from '../campaign-lock/campaign-lock.service';
import { FbMutationService } from '../fb-mutation/fb-mutation.service';

describe('BudgetService', () => {
  let service: BudgetService;

  const prisma = {
    budgetSchedule: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    campaign: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    fbUser: {
      findFirst: jest.fn(),
    },
  };

  const facebookService = {
    getDecryptedToken: jest.fn().mockResolvedValue('test-token'),
  };

  const campaignLock = {
    withCampaignLock: jest.fn(async (_id: string, fn: () => Promise<void>) => {
      await fn();
      return true;
    }),
  };

  const fbMutation = {
    setCampaignStatus: jest.fn().mockResolvedValue(undefined),
    setCampaignDailyBudget: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetService,
        { provide: PrismaService, useValue: prisma },
        { provide: FacebookService, useValue: facebookService },
        { provide: CampaignLockService, useValue: campaignLock },
        { provide: FbMutationService, useValue: fbMutation },
      ],
    }).compile();

    service = module.get(BudgetService);
  });

  describe('create validation', () => {
    it('rejects invalid action', async () => {
      await expect(
        service.create('user-1', {
          name: 'Test',
          action: 'INVALID',
          cronExpr: '0 * * * *',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('requires positive value for SET_BUDGET', async () => {
      await expect(
        service.create('user-1', {
          name: 'Test',
          action: 'SET_BUDGET',
          cronExpr: '0 * * * *',
          value: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cronPartMatches', () => {
    const match = (pattern: string, value: number) =>
      (service as any).cronPartMatches(pattern, value);

    it('matches wildcard', () => {
      expect(match('*', 42)).toBe(true);
    });

    it('matches step patterns', () => {
      expect(match('*/15', 30)).toBe(true);
      expect(match('*/15', 7)).toBe(false);
    });

    it('matches ranges and lists', () => {
      expect(match('9-17', 12)).toBe(true);
      expect(match('9-17', 18)).toBe(false);
      expect(match('1,3,5', 3)).toBe(true);
      expect(match('1,3,5', 4)).toBe(false);
    });

    it('matches exact values', () => {
      expect(match('30', 30)).toBe(true);
      expect(match('30', 29)).toBe(false);
    });
  });

  describe('shouldRunNow', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns true when cron matches current UTC time', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-06-04T07:30:00.000Z'));

      const shouldRun = (service as any).shouldRunNow('30 7 * * *', 'UTC', null);
      expect(shouldRun).toBe(true);
    });

    it('returns false when already run in the same hour (timezone-aware)', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-06-04T07:30:00.000Z'));

      const lastRunAt = new Date('2026-06-04T07:05:00.000Z');
      const shouldRun = (service as any).shouldRunNow('30 7 * * *', 'UTC', lastRunAt);
      expect(shouldRun).toBe(false);
    });

    it('returns false for invalid cron expressions', () => {
      expect((service as any).shouldRunNow('invalid', 'UTC', null)).toBe(false);
    });
  });

  describe('executeAdjustPercent', () => {
    it('computes +10% daily budget and calls FbMutationService', async () => {
      prisma.campaign.findUnique.mockResolvedValue({
        id: 'camp-db-1',
        campaignId: 'fb-camp-1',
        dailyBudget: 100,
        adAccount: { fbUserId: 'fb-user-1' },
      });

      const ok = await (service as any).executeAdjustPercent(
        { campaignId: 'camp-db-1', userId: 'user-1', value: 10 },
        'access-token',
      );

      expect(ok).toBe(true);
      expect(fbMutation.setCampaignDailyBudget).toHaveBeenCalledWith(
        expect.objectContaining({ campaignDbId: 'camp-db-1', fbCampaignId: 'fb-camp-1' }),
        110,
        'Budget:ADJUST_PERCENT',
      );
    });

    it('returns false when percent is zero', async () => {
      const ok = await (service as any).executeAdjustPercent(
        { campaignId: 'camp-db-1', value: 0 },
        'access-token',
      );
      expect(ok).toBe(false);
      expect(fbMutation.setCampaignDailyBudget).not.toHaveBeenCalled();
    });
  });

  describe('evaluateAndExecute', () => {
    it('does not update lastRunAt when mutation fails', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-06-04T07:30:00.000Z'));

      prisma.fbUser.findFirst.mockResolvedValue({ id: 'fb-user-1' });
      facebookService.getDecryptedToken.mockResolvedValue('token');
      (campaignLock.withCampaignLock as jest.Mock).mockImplementation(async () => null);

      prisma.campaign.findUnique.mockResolvedValue({
        id: 'camp-db-1',
        campaignId: 'fb-camp-1',
        adAccount: { accountId: 'act-1', fbUserId: 'fb-user-1' },
      });

      const schedule = {
        id: 'sched-1',
        name: 'Pause hourly',
        userId: 'user-1',
        action: 'PAUSE',
        cronExpr: '30 7 * * *',
        timezone: 'UTC',
        lastRunAt: null,
        campaignId: 'camp-db-1',
      };

      await (service as any).evaluateAndExecute(schedule);

      expect(prisma.budgetSchedule.update).not.toHaveBeenCalled();
      jest.useRealTimers();
    });
  });
});