import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { registerRepeatableJob } from '../common/bullmq-scheduler.util';

@Injectable()
export class SyncSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SyncSchedulerService.name);

  constructor(@InjectQueue('sync') private readonly queue: Queue) {}

  async onModuleInit() {
    const campaignsMs = parseInt(
      process.env.SYNC_CAMPAIGNS_INTERVAL_MS ?? String(15 * 60 * 1000),
      10,
    );
    const insightsMs = parseInt(
      process.env.SYNC_INSIGHTS_INTERVAL_MS ?? String(60 * 60 * 1000),
      10,
    );
    const insights30dMs = parseInt(
      process.env.SYNC_INSIGHTS_30D_INTERVAL_MS ?? String(6 * 60 * 60 * 1000),
      10,
    );

    await registerRepeatableJob(
      this.queue,
      'sync-campaigns',
      'sync-campaigns-repeat',
      {
        repeat: { every: campaignsMs },
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
      this.logger,
    );
    this.logger.log(`Auto-sync campaigns scheduled every ${campaignsMs / 60000} min`);
    await registerRepeatableJob(
      this.queue,
      'sync-insights',
      'sync-insights-repeat',
      {
        repeat: { every: insightsMs },
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
      this.logger,
    );
    this.logger.log(`Auto-sync insights (yesterday) every ${insightsMs / 60000} min`);
    await registerRepeatableJob(
      this.queue,
      'sync-insights-30d',
      'sync-insights-30d-repeat',
      {
        repeat: { every: insights30dMs },
        attempts: 2,
        backoff: { type: 'exponential', delay: 10000 },
      },
      this.logger,
    );
    this.logger.log(`Auto-sync insights (30d async) every ${insights30dMs / 60000} min`);
  }
}