import { Module } from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { SchedulesController } from './schedules.controller';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookService } from '../facebook/facebook.service';
import { HttpModule } from '@nestjs/axios';
import { CampaignLockModule } from '../campaign-lock/campaign-lock.module';

@Module({
  imports: [HttpModule, CampaignLockModule],
  controllers: [SchedulesController],
  providers: [SchedulesService, PrismaService, FacebookService],
  exports: [SchedulesService],
})
export class SchedulesModule {}
