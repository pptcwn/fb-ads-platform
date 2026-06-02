import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { WarmupService } from './warmup.service';

@Processor('warmup', { concurrency: 1 })
export class WarmupProcessor extends WorkerHost {
  constructor(private readonly warmupService: WarmupService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'advance-warmup') {
      await this.warmupService.advanceWarmup();
    }
  }
}
