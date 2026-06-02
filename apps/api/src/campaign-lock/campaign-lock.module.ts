import { Module } from '@nestjs/common';
import { CampaignLockService } from './campaign-lock.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [CampaignLockService],
  exports: [CampaignLockService],
})
export class CampaignLockModule {}
