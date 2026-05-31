import { Module } from '@nestjs/common';
import { AutoSyncService } from './auto-sync.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FacebookModule } from '../facebook/facebook.module';
import { SyncModule } from './sync.module';

@Module({
  imports: [PrismaModule, FacebookModule, SyncModule],
  providers: [AutoSyncService],
})
export class AutoSyncModule {}
