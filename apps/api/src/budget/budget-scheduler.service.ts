import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { registerRepeatableJob } from '../common/bullmq-scheduler.util';

@Injectable()
export class BudgetSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(BudgetSchedulerService.name);

  constructor(@InjectQueue('budget') private readonly queue: Queue) {}

  async onModuleInit() {
    await registerRepeatableJob(
      this.queue,
      'run-budget-schedules',
      'budget-run-repeat',
      {
        repeat: { pattern: '0 * * * *' },
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
      this.logger,
    );
  }
}