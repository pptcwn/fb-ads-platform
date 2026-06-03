import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ReconcileService } from './reconcile.service';

@Processor('reconcile', { concurrency: 1 })
export class ReconcileProcessor extends WorkerHost {
  constructor(private readonly reconcileService: ReconcileService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'reconcile-campaigns') {
      await this.reconcileService.reconcileDrift();
    }
  }
}