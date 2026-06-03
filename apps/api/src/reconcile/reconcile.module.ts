import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ReconcileService } from './reconcile.service';
import { ReconcileProcessor } from './reconcile.processor';
import { ReconcileSchedulerService } from './reconcile-scheduler.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FacebookModule } from '../facebook/facebook.module';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'reconcile' }),
    PrismaModule,
    FacebookModule,
    AlertsModule,
  ],
  providers: [ReconcileService, ReconcileProcessor, ReconcileSchedulerService],
  exports: [ReconcileService],
})
export class ReconcileModule {}