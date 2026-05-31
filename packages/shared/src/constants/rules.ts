export const RULE_METRICS = [
  'CTR', 'CPC', 'CPA', 'CPM', 'SPEND', 'IMPRESSIONS',
  'FREQUENCY', 'ROAS', 'CONVERSIONS', 'REACH',
] as const;

export const MAX_BUDGET_PER_ACTION: Record<string, number> = {
  INCREASE_BUDGET_10: 1.1,
  INCREASE_BUDGET_20: 1.2,
  INCREASE_BUDGET_50: 1.5,
};

export const ABSOLUTE_MAX_DAILY_BUDGET = 5000; // THB
