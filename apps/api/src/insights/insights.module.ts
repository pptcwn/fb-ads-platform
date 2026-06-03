import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';
import { InsightsSyncHelper } from './insights-sync.helper';
import { InsightsAsyncService } from './insights-async.service';
import { InsightsAsyncProcessor } from './insights-async.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { FacebookModule } from '../facebook/facebook.module';

@Module({
  imports: [
    PrismaModule,
    FacebookModule,
    BullModule.registerQueue({ name: 'insights-async' }),
  ],
  controllers: [InsightsController],
  providers: [
    InsightsService,
    InsightsSyncHelper,
    InsightsAsyncService,
    InsightsAsyncProcessor,
  ],
  exports: [InsightsService, InsightsSyncHelper, InsightsAsyncService],
})
export class InsightsModule {}