/** Normalize UI/legacy campaign objectives to ODAX values accepted by Graph API v24+. */
const OBJECTIVE_MAP: Record<string, string> = {
  OUTCOME_AWARENESS: 'OUTCOME_AWARENESS',
  OUTCOME_ENGAGEMENT: 'OUTCOME_ENGAGEMENT',
  OUTCOME_TRAFFIC: 'OUTCOME_TRAFFIC',
  OUTCOME_LEADS: 'OUTCOME_LEADS',
  OUTCOME_SALES: 'OUTCOME_SALES',
  OUTCOME_APP_PROMOTION: 'OUTCOME_APP_PROMOTION',
  BRAND_AWARENESS: 'OUTCOME_AWARENESS',
  REACH: 'OUTCOME_AWARENESS',
  LINK_CLICKS: 'OUTCOME_TRAFFIC',
  TRAFFIC: 'OUTCOME_TRAFFIC',
  CONVERSIONS: 'OUTCOME_SALES',
  LEAD_GENERATION: 'OUTCOME_LEADS',
  APP_INSTALLS: 'OUTCOME_APP_PROMOTION',
};

export function normalizeCampaignObjective(objective: string): string {
  const key = objective.replace(/-/g, '_').toUpperCase();
  return OBJECTIVE_MAP[key] ?? key;
}