import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookService } from '../facebook/facebook.service';
import { CampaignLockService } from '../campaign-lock/campaign-lock.service';
import { FbMutationService } from '../fb-mutation/fb-mutation.service';

interface RuleCondition {
  metric: string;
  operator: 'GT' | 'LT' | 'GTE' | 'LTE' | 'EQ';
  value: number;
  window?: string;
}

@Injectable()
export class RulesEngineService {
  private readonly logger = new Logger(RulesEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly facebookService: FacebookService,
    private readonly campaignLock: CampaignLockService,
    private readonly fbMutation: FbMutationService,
  ) {}

  /**
   * Evaluate all enabled rules. Called by the BullMQ processor.
   */
  async evaluateAll(): Promise<void> {
    const rules = await this.prisma.rule.findMany({
      where: { isEnabled: true },
      select: { id: true, name: true },
    });

    let triggered = 0;
    let errors = 0;

    for (const rule of rules) {
      try {
        const result = await this.evaluateRule(rule.id);
        if (result) triggered++;
      } catch (err: any) {
        errors++;
        this.logger.error(
          `Rule "${rule.name}" (${rule.id}) evaluation error: ${err.message}`,
        );
      }
    }

    this.logger.log(
      `Rule evaluation complete: ${rules.length} checked, ${triggered} triggered, ${errors} errors`,
    );
  }

  /**
   * Evaluate a single rule and execute actions if triggered.
   * Returns true if the rule triggered.
   */
  async evaluateRule(ruleId: string): Promise<boolean> {
    const rule = await this.prisma.rule.findUnique({
      where: { id: ruleId },
      include: {
        campaign: { include: { adAccount: true } },
        adAccount: true,
      },
    });

    if (!rule || !rule.isEnabled) return false;

    // Check cooldown
    if (rule.lastTriggeredAt) {
      const cooldownMs = rule.cooldownMinutes * 60 * 1000;
      if (Date.now() - rule.lastTriggeredAt.getTime() < cooldownMs) {
        return false;
      }
    }

    // Get the metrics to evaluate
    const metrics = await this.getCurrentMetrics(rule);
    if (!metrics) return false;

    // Evaluate conditions
    const conditions = rule.conditions as unknown as RuleCondition[];
    const results = conditions.map((cond) => this.evaluateCondition(cond, metrics));

    const triggered = rule.logic === 'ANY'
      ? results.some(Boolean)
      : results.every(Boolean);

    if (!triggered) return false;

    // Execute actions
    await this.executeActions(rule, metrics);

    // Update rule stats
    await this.prisma.rule.update({
      where: { id: rule.id },
      data: {
        lastTriggeredAt: new Date(),
        triggerCount: { increment: 1 },
      },
    });

    const actions = rule.actions as unknown as string[];
    this.logger.log(`Rule "${rule.name}" triggered — ${actions.join(', ')}`);
    return true;
  }

  private async getCurrentMetrics(rule: any): Promise<Record<string, number> | null> {
    if (rule.scope === 'CAMPAIGN' && rule.campaign) {
      // Use the latest campaign insight
      const insight = await this.prisma.campaignInsight.findFirst({
        where: { campaignId: rule.campaign.id },
        orderBy: { date: 'desc' },
      });
      if (!insight) return null;
      return {
        CTR: Number(insight.ctr) * 100, // Convert to percentage
        CPC: Number(insight.cpc),
        CPA: insight.cpa ? Number(insight.cpa) : 0,
        CPM: Number(insight.cpm),
        SPEND: Number(insight.spend),
        IMPRESSIONS: insight.impressions,
        FREQUENCY: Number(insight.frequency),
        ROAS: insight.roas ? Number(insight.roas) : 0,
        CONVERSIONS: insight.conversions,
        REACH: insight.reach,
      };
    }

    if (rule.scope === 'ACCOUNT' && rule.adAccount) {
      const insight = await this.prisma.accountInsight.findFirst({
        where: { adAccountId: rule.adAccount.id },
        orderBy: { date: 'desc' },
      });
      if (!insight) return null;
      return {
        SPEND: Number(insight.spend),
        IMPRESSIONS: insight.impressions,
        CLICKS: insight.clicks,
        CTR: Number(insight.ctr) * 100,
        CPC: Number(insight.cpc),
        CONVERSIONS: insight.conversions,
      };
    }

    return null;
  }

  private evaluateCondition(cond: RuleCondition, metrics: Record<string, number>): boolean {
    const currentValue = metrics[cond.metric];
    if (currentValue === undefined || currentValue === null) return false;

    switch (cond.operator) {
      case 'GT': return currentValue > cond.value;
      case 'LT': return currentValue < cond.value;
      case 'GTE': return currentValue >= cond.value;
      case 'LTE': return currentValue <= cond.value;
      case 'EQ': return currentValue === cond.value;
      default: return false;
    }
  }

  private async executeActions(rule: any, metrics: Record<string, number>) {
    const actions = rule.actions as unknown as string[];
    const fbUser = rule.campaign?.adAccount?.fbUserId
      ? await this.prisma.fbUser.findUnique({ where: { id: rule.campaign.adAccount.fbUserId } })
      : rule.adAccount?.fbUserId
        ? await this.prisma.fbUser.findUnique({ where: { id: rule.adAccount.fbUserId } })
        : null;

    if (!fbUser) {
      this.logger.warn(`Rule ${rule.id}: No FB user found`);
      return;
    }

    const accessToken = await this.facebookService.getDecryptedToken(fbUser.id);

    for (const action of actions) {
      try {
        await this.executeAction(action, rule, accessToken, metrics);
        // Log success
        await this.prisma.ruleLog.create({
          data: {
            ruleId: rule.id,
            condition: rule.conditions,
            action: { type: action, metrics },
            success: true,
            actionResult: { status: 'executed' },
            campaignState: metrics,
          },
        });
      } catch (err: any) {
        this.logger.error(`Rule ${rule.id}: Action ${action} failed: ${err.message}`);
        await this.prisma.ruleLog.create({
          data: {
            ruleId: rule.id,
            condition: rule.conditions,
            action: { type: action, metrics },
            success: false,
            errorMessage: err.message,
            campaignState: metrics,
          },
        });
      }
    }
  }

  private async executeAction(
    action: string,
    rule: any,
    accessToken: string,
    metrics: Record<string, number>,
  ) {
    switch (action) {
      case 'PAUSE_CAMPAIGN': {
        if (!rule.campaign) break;
        await this.campaignLock.withCampaignLock(
          rule.campaign.id,
          async () => {
            await this.fbMutation.setCampaignStatus(
              {
                campaignDbId: rule.campaign.id,
                fbCampaignId: rule.campaign.campaignId,
                accountId: rule.campaign.adAccount.accountId,
                accessToken,
                userId: rule.userId,
                fbUserId: rule.campaign.adAccount.fbUserId,
                status: 'PAUSED',
              },
              'RulesEngine:PAUSE_CAMPAIGN',
            );
          },
          'RulesEngine:PAUSE_CAMPAIGN',
        );
        break;
      }

      case 'PAUSE_ADSET': {
        if (!rule.campaign) break;
        await this.campaignLock.withCampaignLock(
          rule.campaign.id,
          async () => {
            await this.fbMutation.setCampaignStatus(
              {
                campaignDbId: rule.campaign.id,
                fbCampaignId: rule.campaign.campaignId,
                accountId: rule.campaign.adAccount.accountId,
                accessToken,
                userId: rule.userId,
                fbUserId: rule.campaign.adAccount.fbUserId,
                status: 'PAUSED',
              },
              'RulesEngine:PAUSE_ADSET',
            );
          },
          'RulesEngine:PAUSE_ADSET',
        );
        break;
      }

      case 'INCREASE_BUDGET_10':
      case 'INCREASE_BUDGET_20':
      case 'INCREASE_BUDGET_50': {
        if (!rule.campaign) break;
        const multipliers = { INCREASE_BUDGET_10: 1.1, INCREASE_BUDGET_20: 1.2, INCREASE_BUDGET_50: 1.5 };
        const currentBudget = rule.campaign.dailyBudget ? Number(rule.campaign.dailyBudget) : metrics.SPEND || 100;
        const newBudget = Math.min(currentBudget * multipliers[action], 5000);
        await this.campaignLock.withCampaignLock(
          rule.campaign.id,
          async () => {
            await this.fbMutation.setCampaignDailyBudget(
              {
                campaignDbId: rule.campaign.id,
                fbCampaignId: rule.campaign.campaignId,
                accessToken,
                userId: rule.userId,
                fbUserId: rule.campaign.adAccount.fbUserId,
              },
              newBudget,
              `RulesEngine:${action}`,
              false,
              { source: 'rules', sourceId: rule.id, action },
            );
          },
          `RulesEngine:${action}`,
        );
        break;
      }

      case 'DECREASE_BUDGET_10':
      case 'DECREASE_BUDGET_20': {
        if (!rule.campaign) break;
        const downMultipliers = { DECREASE_BUDGET_10: 0.9, DECREASE_BUDGET_20: 0.8 };
        const curBudget = rule.campaign.dailyBudget ? Number(rule.campaign.dailyBudget) : metrics.SPEND || 100;
        const reducedBudget = Math.max(curBudget * downMultipliers[action], 10);
        await this.campaignLock.withCampaignLock(
          rule.campaign.id,
          async () => {
            await this.fbMutation.setCampaignDailyBudget(
              {
                campaignDbId: rule.campaign.id,
                fbCampaignId: rule.campaign.campaignId,
                accessToken,
                userId: rule.userId,
                fbUserId: rule.campaign.adAccount.fbUserId,
              },
              reducedBudget,
              `RulesEngine:${action}`,
              false,
              { source: 'rules', sourceId: rule.id, action },
            );
          },
          `RulesEngine:${action}`,
        );
        break;
      }

      case 'NOTIFY':
        // For v1, just log — can add email/telegram later
        this.logger.log(`[NOTIFY] Rule "${rule.name}" triggered: ${JSON.stringify(metrics)}`);
        break;

      default:
        this.logger.warn(`Unknown action: ${action}`);
    }
  }
}
