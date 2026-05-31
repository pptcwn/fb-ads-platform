import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FacebookModule } from '../facebook/facebook.module';

@Module({
  imports: [
    HttpModule.register({ timeout: 60000, maxRedirects: 5 }),
    PrismaModule,
    FacebookModule,
  ],
  controllers: [InsightsController],
  providers: [InsightsService],
})
export class InsightsModule {}
