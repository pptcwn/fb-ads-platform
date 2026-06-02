import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class AlertsSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(AlertsSchedulerService.name);

  constructor(@InjectQueue('alerts') private readonly queue: Queue) {}

  async onModuleInit() {
    await this.queue.add(
      'check-alerts',
      {},
      {
        repeat: { every: 5 * 60 * 1000 },
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );
    this.logger.log('Alerts check job scheduled via BullMQ');
  }
}
