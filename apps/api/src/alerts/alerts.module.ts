import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpModule } from '@nestjs/axios';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AlertsScheduler } from './alerts.scheduler';
import { TelegramService } from './telegram.service';
import { FacebookModule } from '../facebook/facebook.module';

@Module({
  imports: [
    ScheduleModule,
    HttpModule.register({ timeout: 15000, maxRedirects: 3 }),
    FacebookModule,
  ],
  controllers: [AlertsController],
  providers: [AlertsService, AlertsScheduler, TelegramService],
  exports: [AlertsService, TelegramService],
})
export class AlertsModule {}
