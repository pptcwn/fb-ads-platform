import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BudgetController } from './budget.controller';
import { BudgetService } from './budget.service';
import { BudgetProcessor } from './budget.processor';
import { BudgetSchedulerService } from './budget-scheduler.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FacebookModule } from '../facebook/facebook.module';
import { CampaignLockModule } from '../campaign-lock/campaign-lock.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'budget' }),
    PrismaModule,
    FacebookModule,
    CampaignLockModule,
  ],
  controllers: [BudgetController],
  providers: [BudgetService, BudgetProcessor, BudgetSchedulerService],
  exports: [BudgetService],
})
export class BudgetModule {}
