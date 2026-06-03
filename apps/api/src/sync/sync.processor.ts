import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AutoSyncService } from './auto-sync.service';

@Processor('sync', { concurrency: 1 })
export class SyncProcessor extends WorkerHost {
  constructor(private readonly autoSync: AutoSyncService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'sync-campaigns') {
      await this.autoSync.autoSyncCampaigns();
    } else if (job.name === 'sync-insights') {
      await this.autoSync.autoSyncInsights();
    } else if (job.name === 'sync-insights-30d') {
      await this.autoSync.autoSyncInsights30d();
    }
  }
}
