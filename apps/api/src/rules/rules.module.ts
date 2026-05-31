import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpModule } from '@nestjs/axios';
import { RulesController } from './rules.controller';
import { RulesService } from './rules.service';
import { RulesEngineService } from './rules-engine.service';
import { RulesScheduler } from './rules.scheduler';
import { PrismaModule } from '../prisma/prisma.module';
import { FacebookModule } from '../facebook/facebook.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    HttpModule.register({ timeout: 60000, maxRedirects: 5 }),
    PrismaModule,
    FacebookModule,
  ],
  controllers: [RulesController],
  providers: [RulesService, RulesEngineService, RulesScheduler],
  exports: [RulesEngineService],
})
export class RulesModule {}
