import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { RulesEngineService } from './rules-engine.service';

@Processor('rules', { concurrency: 1 })
export class RulesProcessor extends WorkerHost {
  constructor(private readonly rulesEngine: RulesEngineService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'evaluate-rules') {
      await this.rulesEngine.evaluateAll();
    }
  }
}
