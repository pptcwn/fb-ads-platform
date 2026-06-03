import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AlertsScheduler } from './alerts.scheduler';
import { AlertsProcessor } from './alerts.processor';
import { AlertsSchedulerService } from './alerts-scheduler.service';
import { TelegramService } from './telegram.service';
import { FacebookModule } from '../facebook/facebook.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'alerts' }),
    HttpModule.register({ timeout: 15000, maxRedirects: 3 }),
    FacebookModule,
  ],
  controllers: [AlertsController],
  providers: [AlertsService, AlertsScheduler, AlertsProcessor, AlertsSchedulerService, TelegramService],
  exports: [AlertsService, TelegramService],
})
export class AlertsModule {}
