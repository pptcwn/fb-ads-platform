import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RulesEngineService } from './rules-engine.service';

@Injectable()
export class RulesScheduler {
  private readonly logger = new Logger(RulesScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rulesEngine: RulesEngineService,
  ) {}

  /**
   * Evaluate all enabled rules every 5 minutes.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async evaluateAllRules() {
    this.logger.log('Running rule evaluation...');

    const rules = await this.prisma.rule.findMany({
      where: { isEnabled: true },
      select: { id: true, name: true },
    });

    let triggered = 0;
    let errors = 0;

    for (const rule of rules) {
      try {
        const result = await this.rulesEngine.evaluateRule(rule.id);
        if (result) triggered++;
      } catch (err: any) {
        errors++;
        this.logger.error(`Rule "${rule.name}" (${rule.id}) evaluation error: ${err.message}`);
      }
    }

    this.logger.log(`Rule evaluation complete: ${rules.length} checked, ${triggered} triggered, ${errors} errors`);
  }
}
