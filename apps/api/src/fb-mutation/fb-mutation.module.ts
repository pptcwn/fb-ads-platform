import { Module, forwardRef } from '@nestjs/common';
import { FbMutationService } from './fb-mutation.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FacebookModule } from '../facebook/facebook.module';
import { ApprovalsModule } from '../approvals/approvals.module';

@Module({
  imports: [PrismaModule, FacebookModule, forwardRef(() => ApprovalsModule)],
  providers: [FbMutationService],
  exports: [FbMutationService],
})
export class FbMutationModule {}