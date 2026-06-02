import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';
import { RulesController } from './rules.controller';
import { RulesService } from './rules.service';
import { RulesEngineService } from './rules-engine.service';
import { RulesProcessor } from './rules.processor';
import { RulesSchedulerService } from './rules-scheduler.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FacebookModule } from '../facebook/facebook.module';
import { CampaignLockModule } from '../campaign-lock/campaign-lock.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'rules' }),
    HttpModule.register({ timeout: 60000, maxRedirects: 5 }),
    PrismaModule,
    FacebookModule,
    CampaignLockModule,
  ],
  controllers: [RulesController],
  providers: [RulesService, RulesEngineService, RulesProcessor, RulesSchedulerService],
  exports: [RulesEngineService],
})
export class RulesModule {}
