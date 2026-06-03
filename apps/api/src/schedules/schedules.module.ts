import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SchedulesService } from './schedules.service';
import { SchedulesController } from './schedules.controller';
import { SchedulesProcessor } from './schedules.processor';
import { SchedulesSchedulerService } from './schedules-scheduler.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FacebookModule } from '../facebook/facebook.module';
import { CampaignLockModule } from '../campaign-lock/campaign-lock.module';
import { FbMutationModule } from '../fb-mutation/fb-mutation.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'campaign-schedules' }),
    PrismaModule,
    FacebookModule,
    CampaignLockModule,
    FbMutationModule,
  ],
  controllers: [SchedulesController],
  providers: [SchedulesService, SchedulesProcessor, SchedulesSchedulerService],
  exports: [SchedulesService],
})
export class SchedulesModule {}
