import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { FacebookController } from './facebook.controller';
import { FacebookService } from './facebook.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    PrismaModule,
  ],
  controllers: [FacebookController],
  providers: [FacebookService],
  exports: [FacebookService],
})
export class FacebookModule {}
