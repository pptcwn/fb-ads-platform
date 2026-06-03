import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FacebookModule } from '../facebook/facebook.module';
import { InsightsModule } from '../insights/insights.module';

@Module({
  imports: [
    HttpModule.register({ timeout: 30000, maxRedirects: 5 }),
    PrismaModule,
    forwardRef(() => FacebookModule),
    InsightsModule,
  ],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
