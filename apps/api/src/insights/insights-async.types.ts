import { FetchInsightsOptions } from './insights.types';

export interface InsightsPollJobData {
  reportRunId: string;
  accessToken: string;
  adAccountDbId: string;
  fbAccountId: string;
  userId: string;
  options: FetchInsightsOptions;
  pollAttempt?: number;
}