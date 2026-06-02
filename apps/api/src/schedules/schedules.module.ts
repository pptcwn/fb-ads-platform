import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SchedulesService } from './schedules.service';
import { SchedulesController } from './schedules.controller';
import { SchedulesProcessor } from './schedules.processor';
import { SchedulesSchedulerService } from './schedules-scheduler.service';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookService } from '../facebook/facebook.service';
import { HttpModule } from '@nestjs/axios';
import { CampaignLockModule } from '../campaign-lock/campaign-lock.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'campaign-schedules' }),
    HttpModule,
    CampaignLockModule,
  ],
  controllers: [SchedulesController],
  providers: [SchedulesService, SchedulesProcessor, SchedulesSchedulerService, PrismaService, FacebookService],
  exports: [SchedulesService],
})
export class SchedulesModule {}
