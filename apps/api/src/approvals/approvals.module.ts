import { Module, forwardRef } from '@nestjs/common';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FbMutationModule } from '../fb-mutation/fb-mutation.module';

@Module({
  imports: [PrismaModule, forwardRef(() => FbMutationModule)],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}