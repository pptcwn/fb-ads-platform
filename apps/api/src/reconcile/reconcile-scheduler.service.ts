import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { registerRepeatableJob } from '../common/bullmq-scheduler.util';

@Injectable()
export class ReconcileSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(ReconcileSchedulerService.name);

  constructor(@InjectQueue('reconcile') private readonly queue: Queue) {}

  async onModuleInit() {
    await registerRepeatableJob(
      this.queue,
      'reconcile-campaigns',
      'reconcile-repeat',
      {
        repeat: { pattern: '0 */6 * * *' },
        attempts: 2,
        backoff: { type: 'exponential', delay: 10000 },
      },
      this.logger,
    );
  }
}