export interface CampaignDTO {
  id: string;
  campaignId: string;
  name: string;
  objective: string;
  status: string;
  dailyBudget?: number;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  cpa?: number;
  roas?: number;
  createdAt: string;
}
