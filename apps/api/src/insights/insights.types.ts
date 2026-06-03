export interface FBInsightRow {
  campaign_id?: string;
  campaign_name?: string;
  date_start: string;
  date_stop: string;
  impressions: string;
  clicks: string;
  ctr: string;
  cpc: string;
  cpm: string;
  spend: string;
  conversions?: string;
  cpa?: string;
  reach?: string;
  frequency?: string;
  roas?: string;
  actions?: Array<{ action_type: string; value: string; '1d_click'?: string }>;
}

export interface FBInsightsPage<T> {
  data: T[];
  paging?: { cursors?: { before: string; after: string }; next?: string };
  report_run_id?: string;
}

export type InsightLevel = 'account' | 'campaign';

export interface FetchInsightsOptions {
  level: InsightLevel;
  datePreset: string;
  timeIncrement?: number;
  /** Force async report run (for large date ranges). */
  preferAsync?: boolean;
}