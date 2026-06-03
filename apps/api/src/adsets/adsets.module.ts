import { Module } from '@nestjs/common';
import { AdsetsController } from './adsets.controller';
import { AdsetsService } from './adsets.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FacebookModule } from '../facebook/facebook.module';

@Module({
  imports: [PrismaModule, FacebookModule],
  controllers: [AdsetsController],
  providers: [AdsetsService],
  exports: [AdsetsService],
})
export class AdsetsModule {}
