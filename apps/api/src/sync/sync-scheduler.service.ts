import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { registerRepeatableJob } from '../common/bullmq-scheduler.util';

@Injectable()
export class SyncSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SyncSchedulerService.name);

  constructor(@InjectQueue('sync') private readonly queue: Queue) {}

  async onModuleInit() {
    await registerRepeatableJob(
      this.queue,
      'sync-campaigns',
      'sync-campaigns-repeat',
      {
        repeat: { every: 15 * 60 * 1000 },
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
      this.logger,
    );
    await registerRepeatableJob(
      this.queue,
      'sync-insights',
      'sync-insights-repeat',
      {
        repeat: { every: 60 * 60 * 1000 },
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
      this.logger,
    );
  }
}