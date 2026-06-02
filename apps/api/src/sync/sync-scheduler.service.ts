import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class SyncSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SyncSchedulerService.name);

  constructor(@InjectQueue('sync') private readonly queue: Queue) {}

  async onModuleInit() {
    await this.queue.add(
      'sync-campaigns',
      {},
      {
        repeat: { every: 15 * 60 * 1000 },
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );
    await this.queue.add(
      'sync-insights',
      {},
      {
        repeat: { every: 60 * 60 * 1000 },
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );
    this.logger.log('Sync jobs scheduled via BullMQ');
  }
}
