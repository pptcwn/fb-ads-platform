import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { SchedulesService } from './schedules.service';

@Processor('campaign-schedules', { concurrency: 1 })
export class SchedulesProcessor extends WorkerHost {
  constructor(private readonly schedulesService: SchedulesService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'run-campaign-schedules') {
      await this.schedulesService.checkSchedules();
    }
  }
}
