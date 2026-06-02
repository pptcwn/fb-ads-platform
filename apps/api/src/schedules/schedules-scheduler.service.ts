import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class SchedulesSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulesSchedulerService.name);

  constructor(@InjectQueue('campaign-schedules') private readonly queue: Queue) {}

  async onModuleInit() {
    await this.queue.add(
      'run-campaign-schedules',
      {},
      {
        repeat: { every: 60 * 1000 },
        attempts: 2,
        backoff: { type: 'fixed', delay: 5000 },
      },
    );
    this.logger.log('Campaign schedules job scheduled via BullMQ');
  }
}
