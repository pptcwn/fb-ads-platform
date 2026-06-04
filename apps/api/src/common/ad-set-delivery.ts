/**
 * Maps ODAX campaign objectives to valid ad set optimization_goal + billing_event pairs.
 * @see https://developers.facebook.com/docs/marketing-api/reference/ad-campaign
 */

export interface AdSetDelivery {
  optimization_goal: string;
  billing_event: string;
}

const DEFAULT_BY_OBJECTIVE: Record<string, AdSetDelivery> = {
  OUTCOME_AWARENESS: { optimization_goal: 'REACH', billing_event: 'IMPRESSIONS' },
  OUTCOME_ENGAGEMENT: { optimization_goal: 'POST_ENGAGEMENT', billing_event: 'IMPRESSIONS' },
  OUTCOME_TRAFFIC: { optimization_goal: 'LINK_CLICKS', billing_event: 'IMPRESSIONS' },
  OUTCOME_LEADS: { optimization_goal: 'LEAD_GENERATION', billing_event: 'IMPRESSIONS' },
  OUTCOME_SALES: { optimization_goal: 'OFFSITE_CONVERSIONS', billing_event: 'IMPRESSIONS' },
  OUTCOME_APP_PROMOTION: { optimization_goal: 'APP_INSTALLS', billing_event: 'IMPRESSIONS' },
  // Legacy objectives still seen in stored rows
  BRAND_AWARENESS: { optimization_goal: 'REACH', billing_event: 'IMPRESSIONS' },
  REACH: { optimization_goal: 'REACH', billing_event: 'IMPRESSIONS' },
  LINK_CLICKS: { optimization_goal: 'LINK_CLICKS', billing_event: 'IMPRESSIONS' },
  TRAFFIC: { optimization_goal: 'LINK_CLICKS', billing_event: 'IMPRESSIONS' },
};

/** Allowed optimization_goal per objective (Meta rejects mismatched pairs). */
const ALLOWED_GOALS: Record<string, readonly string[]> = {
  OUTCOME_AWARENESS: ['REACH', 'AD_RECALL_LIFT', 'IMPRESSIONS', 'THRUPLAY'],
  OUTCOME_ENGAGEMENT: ['POST_ENGAGEMENT', 'PAGE_LIKES', 'EVENT_RESPONSES', 'THRUPLAY', 'REACH', 'IMPRESSIONS'],
  OUTCOME_TRAFFIC: ['LINK_CLICKS', 'LANDING_PAGE_VIEWS', 'IMPRESSIONS'],
  OUTCOME_LEADS: ['LEAD_GENERATION', 'QUALITY_LEAD', 'REACH', 'IMPRESSIONS'],
  OUTCOME_SALES: ['OFFSITE_CONVERSIONS', 'VALUE', 'LINK_CLICKS', 'REACH', 'IMPRESSIONS'],
  OUTCOME_APP_PROMOTION: ['APP_INSTALLS', 'LINK_CLICKS', 'REACH', 'IMPRESSIONS'],
};

function normalizeObjective(objective: string): string {
  return objective.replace(/-/g, '_').toUpperCase();
}

export function resolveAdSetDelivery(
  objective: string,
  optimizationGoal?: string | null,
  billingEvent?: string | null,
): AdSetDelivery {
  const key = normalizeObjective(objective);
  const defaults = DEFAULT_BY_OBJECTIVE[key] ?? DEFAULT_BY_OBJECTIVE.OUTCOME_TRAFFIC;
  const allowed = ALLOWED_GOALS[key];

  let optimization_goal = (optimizationGoal || '').trim().toUpperCase() || defaults.optimization_goal;
  if (allowed && !allowed.includes(optimization_goal)) {
    optimization_goal = defaults.optimization_goal;
  }

  const billing_event =
    (billingEvent || '').trim().toUpperCase() === 'LINK_CLICKS'
      ? 'LINK_CLICKS'
      : defaults.billing_event;

  return { optimization_goal, billing_event };
}