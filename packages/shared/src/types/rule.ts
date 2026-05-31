export interface RuleCondition {
  metric: string;
  operator: 'LT' | 'GT' | 'LTE' | 'GTE' | 'EQ';
  value: number;
  window: string;
}

export interface RuleAction {
  type: string;
}

export interface RuleDTO {
  id: string;
  name: string;
  scope: string;
  conditions: RuleCondition[];
  logic: 'ALL' | 'ANY';
  actions: RuleAction[];
  isEnabled: boolean;
  cooldownMinutes: number;
  lastTriggeredAt?: string;
}
