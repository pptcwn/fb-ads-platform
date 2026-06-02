import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class RulesSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(RulesSchedulerService.name);

  constructor(@InjectQueue('rules') private readonly queue: Queue) {}

  async onModuleInit() {
    await this.queue.add(
      'evaluate-rules',
      {},
      {
        repeat: { every: 5 * 60 * 1000 },
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );
    this.logger.log('Rules evaluation job scheduled via BullMQ');
  }
}
