import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { registerRepeatableJob } from '../common/bullmq-scheduler.util';

@Injectable()
export class WarmupSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(WarmupSchedulerService.name);

  constructor(@InjectQueue('warmup') private readonly queue: Queue) {}

  async onModuleInit() {
    await registerRepeatableJob(
      this.queue,
      'advance-warmup',
      'warmup-advance-repeat',
      {
        repeat: { pattern: '0 0 * * *' },
        attempts: 3,
        backoff: { type: 'exponential', delay: 10000 },
      },
      this.logger,
    );
  }
}