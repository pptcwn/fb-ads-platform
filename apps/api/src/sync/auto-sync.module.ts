import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AutoSyncService } from './auto-sync.service';
import { SyncProcessor } from './sync.processor';
import { SyncSchedulerService } from './sync-scheduler.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FacebookModule } from '../facebook/facebook.module';
import { SyncModule } from './sync.module';
import { InsightsModule } from '../insights/insights.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'sync' }),
    PrismaModule,
    FacebookModule,
    SyncModule,
    InsightsModule,
  ],
  providers: [AutoSyncService, SyncProcessor, SyncSchedulerService],
  exports: [AutoSyncService],
})
export class AutoSyncModule {}
