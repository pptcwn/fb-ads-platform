import { Logger } from '@nestjs/common';
import { AxiosInstance } from 'axios';
import { FB_GRAPH_BASE_URL } from '../common/facebook-api.config';
import { FbAxiosConfig, getFacebookAxios } from '../common/facebook-rate-limit';
import {
  FBInsightRow,
  FBInsightsPage,
  FetchInsightsOptions,
  InsightLevel,
} from './insights.types';

const logger = new Logger('FacebookAsyncInsights');

const POLL_INTERVAL_MS = parseInt(process.env.INSIGHTS_ASYNC_POLL_MS ?? '2000', 10);
const MAX_POLL_ATTEMPTS = parseInt(process.env.INSIGHTS_ASYNC_MAX_POLLS ?? '90', 10);

const ACCOUNT_FIELDS =
  'impressions,clicks,ctr,cpc,cpm,spend,conversions,reach,frequency';
const CAMPAIGN_FIELDS =
  'campaign_id,campaign_name,impressions,clicks,ctr,cpc,cpm,spend,conversions,reach,frequency';

function fieldsForLevel(level: InsightLevel): string {
  return level === 'account' ? ACCOUNT_FIELDS : CAMPAIGN_FIELDS;
}

function normalizeAccountId(accountId: string): string {
  return accountId.replace(/^act_/, '');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function shouldUseAsyncInsights(options: FetchInsightsOptions): boolean {
  if (options.preferAsync) return true;
  if (options.timeIncrement && options.timeIncrement > 0) return true;
  return ['last_30d', 'last_28d', 'last_90d', 'this_month', 'last_month'].includes(
    options.datePreset,
  );
}

export class FacebookAsyncInsightsClient {
  constructor(
    private readonly baseUrl: string = FB_GRAPH_BASE_URL,
    private readonly axios: AxiosInstance = getFacebookAxios(),
  ) {}

  async fetchInsights(
    accountId: string,
    accessToken: string,
    options: FetchInsightsOptions,
  ): Promise<FBInsightRow[]> {
    if (shouldUseAsyncInsights(options)) {
      return this.fetchViaAsyncReportRun(accountId, accessToken, options);
    }
    return this.fetchViaSyncGet(accountId, accessToken, options);
  }

  private buildParams(
    accessToken: string,
    options: FetchInsightsOptions,
  ): Record<string, string | number> {
    const params: Record<string, string | number> = {
      fields: fieldsForLevel(options.level),
      level: options.level,
      date_preset: options.datePreset,
      limit: 500,
      access_token: accessToken,
    };
    if (options.timeIncrement) {
      params.time_increment = options.timeIncrement;
    }
    return params;
  }

  /** Standard GET — suitable for small queries (e.g. yesterday). */
  async fetchViaSyncGet(
    accountId: string,
    accessToken: string,
    options: FetchInsightsOptions,
  ): Promise<FBInsightRow[]> {
    const actId = normalizeAccountId(accountId);
    const params = this.buildParams(accessToken, options);
    const allRows: FBInsightRow[] = [];
    let url: string | null = `${this.baseUrl}/act_${actId}/insights`;

    while (url) {
      const response = await this.axios.get<FBInsightsPage<FBInsightRow>>(url, {
        params: url.includes('?') ? undefined : params,
      });
      const page: FBInsightsPage<FBInsightRow> = response.data;
      allRows.push(...(page.data ?? []));
      url = page.paging?.next ?? null;
    }

    return allRows;
  }

  /**
   * Async Ad Report Run flow:
   * POST insights → report_run_id → poll status → GET /{id}/insights
   */
  /** POST insights — returns report_run_id or inline data. */
  async startAsyncReportRun(
    accountId: string,
    accessToken: string,
    options: FetchInsightsOptions,
  ): Promise<{ reportRunId: string | null; inlineRows: FBInsightRow[] | null }> {
    const actId = normalizeAccountId(accountId);
    const params = this.buildParams(accessToken, options);

    logger.log(
      `Starting async insights job: act_${actId} level=${options.level} preset=${options.datePreset}`,
    );

    const { data: postData } = await this.axios.post<FBInsightsPage<FBInsightRow>>(
      `${this.baseUrl}/act_${actId}/insights`,
      null,
      { params, fbAdAccountId: actId } as FbAxiosConfig,
    );

    if (postData.report_run_id) {
      return { reportRunId: postData.report_run_id, inlineRows: null };
    }

    if (Array.isArray(postData.data)) {
      const rows = [...postData.data];
      let next = postData.paging?.next;
      while (next) {
        const { data: page } = await this.axios.get<FBInsightsPage<FBInsightRow>>(next);
        rows.push(...(page.data ?? []));
        next = page.paging?.next;
      }
      logger.log(`Insights returned inline (${rows.length} rows) for act_${actId}`);
      return { reportRunId: null, inlineRows: rows };
    }

    throw new Error('Facebook insights POST did not return report_run_id or data');
  }

  async getReportRunStatus(
    reportRunId: string,
    accessToken: string,
  ): Promise<{ status: string; percent: number; complete: boolean; failed: boolean }> {
    const { data } = await this.axios.get<{
      async_status?: string;
      async_percent_completion?: number;
    }>(`${this.baseUrl}/${reportRunId}`, {
      params: {
        fields: 'async_status,async_percent_completion',
        access_token: accessToken,
      },
    });

    const status = data.async_status ?? 'unknown';
    return {
      status,
      percent: data.async_percent_completion ?? 0,
      complete: status === 'Job Completed',
      failed: status === 'Job Failed' || status === 'Job Skipped',
    };
  }

  async fetchViaAsyncReportRun(
    accountId: string,
    accessToken: string,
    options: FetchInsightsOptions,
  ): Promise<FBInsightRow[]> {
    const { reportRunId, inlineRows } = await this.startAsyncReportRun(
      accountId,
      accessToken,
      options,
    );
    if (inlineRows) return inlineRows;
    if (!reportRunId) throw new Error('No report_run_id from Facebook');

    await this.waitForReportRun(reportRunId, accessToken);
    return this.fetchReportRunResults(reportRunId, accessToken);
  }

  async waitForReportRun(reportRunId: string, accessToken: string): Promise<void> {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      const { data } = await this.axios.get<{
        async_status?: string;
        async_percent_completion?: number;
      }>(`${this.baseUrl}/${reportRunId}`, {
        params: {
          fields: 'async_status,async_percent_completion',
          access_token: accessToken,
        },
      });

      const status = data.async_status ?? 'unknown';
      const pct = data.async_percent_completion ?? 0;

      if (status === 'Job Completed') {
        logger.log(`Async insights job ${reportRunId} completed`);
        return;
      }

      if (status === 'Job Failed' || status === 'Job Skipped') {
        throw new Error(`Async insights job ${reportRunId} ended with status: ${status}`);
      }

      if (attempt % 5 === 0) {
        logger.debug(`Insights job ${reportRunId}: ${status} (${pct}%)`);
      }

      await sleep(POLL_INTERVAL_MS);
    }

    throw new Error(
      `Async insights job ${reportRunId} timed out after ${MAX_POLL_ATTEMPTS} polls`,
    );
  }

  async fetchReportRunResults(
    reportRunId: string,
    accessToken: string,
  ): Promise<FBInsightRow[]> {
    const allRows: FBInsightRow[] = [];
    let url: string | null = `${this.baseUrl}/${reportRunId}/insights`;
    const baseParams = { access_token: accessToken, limit: 500 };

    while (url) {
      const response = await this.axios.get<FBInsightsPage<FBInsightRow>>(url, {
        params: url.includes('access_token') ? undefined : baseParams,
      });
      const page: FBInsightsPage<FBInsightRow> = response.data;
      allRows.push(...(page.data ?? []));
      url = page.paging?.next ?? null;
    }

    logger.log(`Fetched ${allRows.length} insight rows from report ${reportRunId}`);
    return allRows;
  }
}