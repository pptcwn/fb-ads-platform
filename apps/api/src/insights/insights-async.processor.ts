import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InsightsAsyncService } from './insights-async.service';
import { InsightsPollJobData } from './insights-async.types';

@Processor('insights-async', { concurrency: 3 })
export class InsightsAsyncProcessor extends WorkerHost {
  constructor(private readonly insightsAsync: InsightsAsyncService) {
    super();
  }

  async process(job: Job<InsightsPollJobData>): Promise<void> {
    if (job.name === 'poll-report-run') {
      await this.insightsAsync.processPollJob(job.data);
    }
  }
}