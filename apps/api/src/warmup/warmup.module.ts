import { Module } from '@nestjs/common';
import { WarmupService } from './warmup.service';
import { WarmupController } from './warmup.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { FacebookModule } from '../facebook/facebook.module';

@Module({
  imports: [PrismaModule, FacebookModule],
  controllers: [WarmupController],
  providers: [WarmupService],
  exports: [WarmupService],
})
export class WarmupModule {}
