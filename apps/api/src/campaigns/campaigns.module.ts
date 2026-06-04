import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MulterModule } from '@nestjs/platform-express';
import { join } from 'path';
import * as fs from 'fs';
import { CampaignsController } from './campaigns.controller';
import { TargetingController } from './targeting.controller';
import { CampaignsService } from './campaigns.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FacebookModule } from '../facebook/facebook.module';


const uploadDir = join(process.cwd(), 'uploads', 'campaigns');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

@Module({
  imports: [
    HttpModule.register({ timeout: 60000, maxRedirects: 5 }),
    MulterModule.register({ dest: uploadDir, limits: { fileSize: 10 * 1024 * 1024 } }),
    PrismaModule,
    FacebookModule,
  ],
  controllers: [CampaignsController, TargetingController],
  providers: [CampaignsService],
})
export class CampaignsModule {}
