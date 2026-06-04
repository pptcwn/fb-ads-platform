export const CREATE_STEPS = [
  { id: 'setup', label: 'ตั้งค่า' },
  { id: 'budget', label: 'งบประมาณ' },
  { id: 'audience', label: 'กลุ่มเป้าหมาย' },
  { id: 'ad', label: 'โฆษณา' },
  { id: 'review', label: 'สรุป' },
] as const;

/** Default ad set optimization_goal per ODAX objective (must match API resolveAdSetDelivery). */
export const DEFAULT_OPTIMIZATION_BY_OBJECTIVE: Record<string, string> = {
  OUTCOME_AWARENESS: 'REACH',
  OUTCOME_ENGAGEMENT: 'POST_ENGAGEMENT',
  OUTCOME_TRAFFIC: 'LINK_CLICKS',
  OUTCOME_LEADS: 'LEAD_GENERATION',
  OUTCOME_SALES: 'OFFSITE_CONVERSIONS',
  OUTCOME_APP_PROMOTION: 'APP_INSTALLS',
};

export function defaultOptimizationForObjective(objective: string): string {
  return DEFAULT_OPTIMIZATION_BY_OBJECTIVE[objective] ?? 'LINK_CLICKS';
}

export const OBJECTIVES: { key: string; label: string; desc: string }[] = [
  { key: 'OUTCOME_AWARENESS', label: 'Awareness', desc: 'เข้าถึงคนให้มากที่สุด' },
  { key: 'OUTCOME_TRAFFIC', label: 'Traffic', desc: 'พาคนเข้าเว็บไซต์' },
  { key: 'OUTCOME_ENGAGEMENT', label: 'Engagement', desc: 'ไลก์ คอมเมนต์ แชร์' },
  { key: 'OUTCOME_LEADS', label: 'Leads', desc: 'เก็บลีดและสมัคร' },
  { key: 'OUTCOME_SALES', label: 'Sales', desc: 'ยอดขายและ Conversion' },
  { key: 'OUTCOME_APP_PROMOTION', label: 'App Promotion', desc: 'โปรโมตการติดตั้งแอป' },
];

export interface CampaignFormState {
  adAccountId: string;
  name: string;
  objective: string;
  dailyBudget: number;
  status: string;
  adSetName: string;
  optimizationGoal: string;
  billingEvent: string;
  adName: string;
  creativeMessage: string;
  creativeLink: string;
  pageId: string;
  createAd: boolean;
  creativeImageHash: string;
  targeting: Record<string, unknown>;
}

export const initialCampaignForm = (): CampaignFormState => ({
  adAccountId: '',
  name: '',
  objective: 'OUTCOME_TRAFFIC',
  dailyBudget: 300,
  status: 'PAUSED',
  adSetName: '',
  optimizationGoal: 'LINK_CLICKS',
  billingEvent: 'IMPRESSIONS',
  adName: '',
  creativeMessage: '',
  creativeLink: '',
  pageId: '',
  createAd: false,
  creativeImageHash: '',
  targeting: { geo_locations: { countries: ['TH'] }, age_min: 18, age_max: 65 },
});

export function estimateBudgetBreakdown(budget: number) {
  const estimatedDailyReach = Math.round(budget * 120);
  const estimatedCpc = budget > 0 ? (budget / (estimatedDailyReach * 0.05)).toFixed(2) : '0.00';
  const estimatedCpm = budget > 0 ? (budget / (estimatedDailyReach / 1000)).toFixed(2) : '0.00';
  return {
    dailySpend: Math.round(budget * 100) / 100,
    estimatedDailyReach,
    estimatedCpc,
    estimatedCpm,
  };
}