import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BudgetController } from './budget.controller';
import { BudgetService } from './budget.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FacebookModule } from '../facebook/facebook.module';
import { CampaignLockModule } from '../campaign-lock/campaign-lock.module';

@Module({
  imports: [ScheduleModule, PrismaModule, FacebookModule, CampaignLockModule],
  controllers: [BudgetController],
  providers: [BudgetService],
  exports: [BudgetService],
})
export class BudgetModule {}
