import { Injectable } from '@nestjs/common';

export interface BudgetGuardInput {
  currentBudget: number;
  proposedBudget: number;
  source: string;
}

export interface BudgetGuardResult {
  allowed: boolean;
  requiresApproval: boolean;
  effectiveBudget: number;
  reason?: string;
}

@Injectable()
export class AutomationGuardService {
  private readonly maxDailyCap = parseFloat(process.env.BUDGET_MAX_DAILY_CAP ?? '5000');
  private readonly maxIncreasePercent = parseFloat(
    process.env.BUDGET_MAX_INCREASE_PERCENT ?? '50',
  );
  private readonly approvalThreshold = parseFloat(
    process.env.BUDGET_APPROVAL_THRESHOLD ?? '1500',
  );
  private readonly enabled = process.env.AUTOMATION_GUARDRAILS_ENABLED !== 'false';

  evaluateBudgetChange(input: BudgetGuardInput): BudgetGuardResult {
    if (!this.enabled) {
      return {
        allowed: true,
        requiresApproval: false,
        effectiveBudget: input.proposedBudget,
      };
    }

    const current = Math.max(0, input.currentBudget);
    let proposed = Math.max(1, input.proposedBudget);
    let reason: string | undefined;

    if (proposed > this.maxDailyCap) {
      proposed = this.maxDailyCap;
      reason = `Capped at max daily budget ${this.maxDailyCap}`;
    }

    const delta = proposed - current;
    const increasePct = current > 0 ? (delta / current) * 100 : delta > 0 ? 100 : 0;

    if (increasePct > this.maxIncreasePercent) {
      return {
        allowed: false,
        requiresApproval: true,
        effectiveBudget: proposed,
        reason:
          reason ??
          `Increase ${increasePct.toFixed(1)}% exceeds limit ${this.maxIncreasePercent}% (${input.source})`,
      };
    }

    if (delta >= this.approvalThreshold) {
      return {
        allowed: false,
        requiresApproval: true,
        effectiveBudget: proposed,
        reason:
          reason ??
          `Budget change +${delta.toFixed(0)} requires approval (threshold ${this.approvalThreshold})`,
      };
    }

    return {
      allowed: true,
      requiresApproval: false,
      effectiveBudget: proposed,
      reason,
    };
  }
}