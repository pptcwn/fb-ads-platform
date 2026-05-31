import { Module } from '@nestjs/common';
import { AbtestController } from './abtest.controller';
import { AbtestService } from './abtest.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FacebookModule } from '../facebook/facebook.module';

@Module({
  imports: [PrismaModule, FacebookModule],
  controllers: [AbtestController],
  providers: [AbtestService],
  exports: [AbtestService],
})
export class AbtestModule {}
