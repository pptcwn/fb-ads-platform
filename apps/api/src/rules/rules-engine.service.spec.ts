import { Test, TestingModule } from '@nestjs/testing';
import { RulesEngineService } from './rules-engine.service';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookService } from '../facebook/facebook.service';
import { CampaignLockService } from '../campaign-lock/campaign-lock.service';
import { FbMutationService } from '../fb-mutation/fb-mutation.service';

describe('RulesEngineService', () => {
  let service: RulesEngineService;

  const prisma = {
    rule: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    campaignInsight: {
      findFirst: jest.fn(),
    },
    accountInsight: {
      findFirst: jest.fn(),
    },
    fbUser: {
      findUnique: jest.fn(),
    },
    ruleLog: {
      create: jest.fn(),
    },
    campaign: {
      update: jest.fn(),
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
        RulesEngineService,
        { provide: PrismaService, useValue: prisma },
        { provide: FacebookService, useValue: facebookService },
        { provide: CampaignLockService, useValue: campaignLock },
        { provide: FbMutationService, useValue: fbMutation },
      ],
    }).compile();

    service = module.get(RulesEngineService);
  });

  describe('evaluateCondition', () => {
    const evaluate = (cond: object, metrics: Record<string, number>) =>
      (service as any).evaluateCondition(cond, metrics);

    it('evaluates GT / LT / EQ', () => {
      expect(evaluate({ metric: 'CPC', operator: 'GT', value: 5 }, { CPC: 10 })).toBe(true);
      expect(evaluate({ metric: 'CTR', operator: 'LT', value: 2 }, { CTR: 1 })).toBe(true);
      expect(evaluate({ metric: 'SPEND', operator: 'EQ', value: 100 }, { SPEND: 100 })).toBe(true);
      expect(evaluate({ metric: 'SPEND', operator: 'EQ', value: 100 }, { SPEND: 99 })).toBe(false);
    });

    it('returns false when metric is missing', () => {
      expect(evaluate({ metric: 'CPC', operator: 'GT', value: 1 }, {})).toBe(false);
    });
  });

  describe('evaluateRule', () => {
    const baseRule = {
      id: 'rule-1',
      name: 'High CPC pause',
      isEnabled: true,
      cooldownMinutes: 60,
      lastTriggeredAt: null,
      logic: 'ALL',
      scope: 'CAMPAIGN',
      conditions: [{ metric: 'CPC', operator: 'GT', value: 5 }],
      actions: ['PAUSE_CAMPAIGN'],
      userId: 'user-1',
      campaign: {
        id: 'camp-db-1',
        campaignId: 'fb-camp-1',
        dailyBudget: 200,
        adAccount: { accountId: 'act-1', fbUserId: 'fb-user-1' },
      },
      adAccount: null,
    };

    it('skips when cooldown has not elapsed', async () => {
      prisma.rule.findUnique.mockResolvedValue({
        ...baseRule,
        lastTriggeredAt: new Date(),
      });

      const result = await service.evaluateRule('rule-1');
      expect(result).toBe(false);
      expect(prisma.rule.update).not.toHaveBeenCalled();
    });

    it('triggers PAUSE_CAMPAIGN when conditions match', async () => {
      prisma.rule.findUnique.mockResolvedValue(baseRule);
      prisma.campaignInsight.findFirst.mockResolvedValue({
        ctr: 0.02,
        cpc: 10,
        cpa: null,
        cpm: 5,
        spend: 50,
        impressions: 1000,
        frequency: 1.2,
        roas: null,
        conversions: 2,
        reach: 800,
      });
      prisma.fbUser.findUnique.mockResolvedValue({ id: 'fb-user-1' });

      const result = await service.evaluateRule('rule-1');

      expect(result).toBe(true);
      expect(fbMutation.setCampaignStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          campaignDbId: 'camp-db-1',
          status: 'PAUSED',
        }),
        'RulesEngine:PAUSE_CAMPAIGN',
      );
      expect(prisma.rule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rule-1' },
          data: expect.objectContaining({ triggerCount: { increment: 1 } }),
        }),
      );
    });

    it('uses ANY logic — one matching condition is enough', async () => {
      prisma.rule.findUnique.mockResolvedValue({
        ...baseRule,
        logic: 'ANY',
        conditions: [
          { metric: 'CPC', operator: 'LT', value: 1 },
          { metric: 'SPEND', operator: 'GT', value: 10 },
        ],
      });
      prisma.campaignInsight.findFirst.mockResolvedValue({
        ctr: 0.01,
        cpc: 2,
        cpa: null,
        cpm: 1,
        spend: 50,
        impressions: 100,
        frequency: 1,
        roas: null,
        conversions: 0,
        reach: 50,
      });
      prisma.fbUser.findUnique.mockResolvedValue({ id: 'fb-user-1' });

      const result = await service.evaluateRule('rule-1');
      expect(result).toBe(true);
    });

    it('caps INCREASE_BUDGET_50 at 5000', async () => {
      prisma.rule.findUnique.mockResolvedValue({
        ...baseRule,
        campaign: { ...baseRule.campaign, dailyBudget: 4000 },
        conditions: [{ metric: 'SPEND', operator: 'GT', value: 1 }],
        actions: ['INCREASE_BUDGET_50'],
      });
      prisma.campaignInsight.findFirst.mockResolvedValue({
        ctr: 0.01,
        cpc: 1,
        cpa: null,
        cpm: 1,
        spend: 100,
        impressions: 100,
        frequency: 1,
        roas: null,
        conversions: 0,
        reach: 50,
      });
      prisma.fbUser.findUnique.mockResolvedValue({ id: 'fb-user-1' });

      await service.evaluateRule('rule-1');

      expect(fbMutation.setCampaignDailyBudget).toHaveBeenCalledWith(
        expect.any(Object),
        5000,
        'RulesEngine:INCREASE_BUDGET_50',
        false,
        { source: 'rules', sourceId: 'rule-1', action: 'INCREASE_BUDGET_50' },
      );
    });
  });

  describe('evaluateAll', () => {
    it('continues when one rule throws', async () => {
      prisma.rule.findMany.mockResolvedValue([
        { id: 'r1', name: 'A' },
        { id: 'r2', name: 'B' },
        { id: 'r3', name: 'C' },
      ]);
      const evaluateRuleSpy = jest
        .spyOn(service, 'evaluateRule')
        .mockResolvedValueOnce(false)
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce(true);

      await expect(service.evaluateAll()).resolves.toBeUndefined();
      expect(evaluateRuleSpy).toHaveBeenCalledTimes(3);
    });
  });
});