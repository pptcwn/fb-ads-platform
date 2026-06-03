import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WarmupService } from './warmup.service';
import { WarmupController } from './warmup.controller';
import { WarmupProcessor } from './warmup.processor';
import { WarmupSchedulerService } from './warmup-scheduler.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FacebookModule } from '../facebook/facebook.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'warmup' }),
    PrismaModule,
    FacebookModule,
  ],
  controllers: [WarmupController],
  providers: [WarmupService, WarmupProcessor, WarmupSchedulerService],
  exports: [WarmupService],
})
export class WarmupModule {}
