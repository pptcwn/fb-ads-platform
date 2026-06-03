import { AutomationGuardService } from './automation-guard.service';

describe('AutomationGuardService', () => {
  const guard = new AutomationGuardService();

  beforeAll(() => {
    process.env.AUTOMATION_GUARDRAILS_ENABLED = 'true';
    process.env.BUDGET_MAX_DAILY_CAP = '5000';
    process.env.BUDGET_MAX_INCREASE_PERCENT = '50';
    process.env.BUDGET_APPROVAL_THRESHOLD = '1500';
  });

  it('allows small budget increases', () => {
    const r = guard.evaluateBudgetChange({
      currentBudget: 1000,
      proposedBudget: 1200,
      source: 'budget',
    });
    expect(r.allowed).toBe(true);
    expect(r.requiresApproval).toBe(false);
  });

  it('requires approval for large absolute increase', () => {
    const r = guard.evaluateBudgetChange({
      currentBudget: 500,
      proposedBudget: 2500,
      source: 'rules',
    });
    expect(r.requiresApproval).toBe(true);
  });

  it('caps proposed budget at max daily cap', () => {
    const r = guard.evaluateBudgetChange({
      currentBudget: 4000,
      proposedBudget: 9000,
      source: 'budget',
    });
    expect(r.effectiveBudget).toBe(5000);
  });
});