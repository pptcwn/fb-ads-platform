import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AlertsScheduler } from './alerts.scheduler';

@Processor('alerts', { concurrency: 1 })
export class AlertsProcessor extends WorkerHost {
  constructor(private readonly alertsScheduler: AlertsScheduler) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'check-alerts') {
      await this.alertsScheduler.checkAlerts();
    }
  }
}
