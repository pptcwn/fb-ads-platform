import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { registerRepeatableJob } from '../common/bullmq-scheduler.util';

@Injectable()
export class SchedulesSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulesSchedulerService.name);

  constructor(@InjectQueue('campaign-schedules') private readonly queue: Queue) {}

  async onModuleInit() {
    await registerRepeatableJob(
      this.queue,
      'run-campaign-schedules',
      'schedules-run-repeat',
      {
        repeat: { every: 60 * 1000 },
        attempts: 2,
        backoff: { type: 'fixed', delay: 5000 },
      },
      this.logger,
    );
  }
}