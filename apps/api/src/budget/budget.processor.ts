import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BudgetService } from './budget.service';

@Processor('budget', { concurrency: 1 })
export class BudgetProcessor extends WorkerHost {
  constructor(private readonly budgetService: BudgetService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'run-budget-schedules') {
      await this.budgetService.checkSchedules();
    }
  }
}
