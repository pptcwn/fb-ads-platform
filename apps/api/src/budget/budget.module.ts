import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BudgetController } from './budget.controller';
import { BudgetService } from './budget.service';
import { BudgetProcessor } from './budget.processor';
import { BudgetSchedulerService } from './budget-scheduler.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FacebookModule } from '../facebook/facebook.module';
import { CampaignLockModule } from '../campaign-lock/campaign-lock.module';
import { FbMutationModule } from '../fb-mutation/fb-mutation.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'budget' }),
    PrismaModule,
    FacebookModule,
    CampaignLockModule,
    FbMutationModule,
  ],
  controllers: [BudgetController],
  providers: [BudgetService, BudgetProcessor, BudgetSchedulerService],
  exports: [BudgetService],
})
export class BudgetModule {}
