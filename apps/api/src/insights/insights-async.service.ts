import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { FacebookAsyncInsightsClient } from './facebook-async-insights.client';
import { InsightsSyncHelper } from './insights-sync.helper';
import { InsightsPollJobData } from './insights-async.types';
import { shouldUseAsyncInsights } from './facebook-async-insights.client';

const POLL_DELAY_MS = parseInt(process.env.INSIGHTS_ASYNC_POLL_MS ?? '2000', 10);
const MAX_POLL_ATTEMPTS = parseInt(process.env.INSIGHTS_ASYNC_MAX_POLLS ?? '90', 10);

@Injectable()
export class InsightsAsyncService {
  private readonly logger = new Logger(InsightsAsyncService.name);
  private readonly client = new FacebookAsyncInsightsClient();

  constructor(
    @InjectQueue('insights-async') private readonly queue: Queue,
    private readonly syncHelper: InsightsSyncHelper,
  ) {}

  async enqueueInsightsFetch(
    adAccountDbId: string,
    fbAccountId: string,
    accessToken: string,
    userId: string,
    options: { level: 'account' | 'campaign'; datePreset: string; timeIncrement?: number },
  ): Promise<{ jobId: string; reportRunId: string | null; inline: boolean }> {
    const fetchOptions = {
      level: options.level,
      datePreset: options.datePreset,
      timeIncrement: options.timeIncrement,
      preferAsync: true,
    };

    if (!shouldUseAsyncInsights(fetchOptions)) {
      const rows = await this.client.fetchViaSyncGet(fbAccountId, accessToken, fetchOptions);
      await this.persistRows(adAccountDbId, options.level, rows);
      return { jobId: 'sync-inline', reportRunId: null, inline: true };
    }

    const { reportRunId, inlineRows } = await this.client.startAsyncReportRun(
      fbAccountId,
      accessToken,
      fetchOptions,
    );

    if (inlineRows) {
      await this.persistRows(adAccountDbId, options.level, inlineRows);
      return { jobId: 'sync-inline', reportRunId: null, inline: true };
    }

    if (!reportRunId) throw new Error('Facebook did not return report_run_id');

    const job = await this.queue.add(
      'poll-report-run',
      {
        reportRunId,
        accessToken,
        adAccountDbId,
        fbAccountId,
        userId,
        options: fetchOptions,
        pollAttempt: 0,
      } satisfies InsightsPollJobData,
      {
        jobId: `insights-poll-${reportRunId}`,
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );

    return { jobId: job.id!, reportRunId, inline: false };
  }

  async processPollJob(data: InsightsPollJobData): Promise<'done' | 'reschedule'> {
    const attempt = data.pollAttempt ?? 0;
    const status = await this.client.getReportRunStatus(data.reportRunId, data.accessToken);

    if (status.failed) {
      throw new Error(`Async insights job ${data.reportRunId} failed: ${status.status}`);
    }

    if (!status.complete) {
      if (attempt >= MAX_POLL_ATTEMPTS) {
        throw new Error(`Async insights job ${data.reportRunId} timed out after ${attempt} polls`);
      }
      await this.queue.add(
        'poll-report-run',
        { ...data, pollAttempt: attempt + 1 },
        {
          jobId: `insights-poll-${data.reportRunId}-${attempt + 1}`,
          delay: POLL_DELAY_MS,
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      );
      this.logger.debug(
        `Insights poll ${data.reportRunId}: ${status.status} (${status.percent}%) — retry ${attempt + 1}`,
      );
      return 'reschedule';
    }

    const rows = await this.client.fetchReportRunResults(data.reportRunId, data.accessToken);
    await this.persistRows(data.adAccountDbId, data.options.level, rows);
    this.logger.log(
      `Insights job ${data.reportRunId} done: ${rows.length} rows (level=${data.options.level})`,
    );
    return 'done';
  }

  private async persistRows(
    adAccountDbId: string,
    level: 'account' | 'campaign',
    rows: Awaited<ReturnType<FacebookAsyncInsightsClient['fetchViaSyncGet']>>,
  ): Promise<number> {
    if (level === 'account') {
      return this.syncHelper.persistAccountRows(adAccountDbId, rows);
    }
    return this.syncHelper.persistCampaignRows(rows);
  }
}