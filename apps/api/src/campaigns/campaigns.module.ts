import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FacebookModule } from '../facebook/facebook.module';

@Module({
  imports: [
    HttpModule.register({ timeout: 60000, maxRedirects: 5 }),
    PrismaModule,
    FacebookModule,
  ],
  controllers: [CampaignsController],
  providers: [CampaignsService],
})
export class CampaignsModule {}
