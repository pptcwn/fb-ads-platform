export interface FacebookUserDTO {
  id: string;
  facebookUserId: string;
  facebookName: string;
  facebookEmail?: string;
  status: string;
  tokenExpiresAt: string;
}

export interface FbInsights {
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  spend: number;
  conversions: number;
  cpa?: number;
  reach: number;
  frequency: number;
  roas?: number;
}
