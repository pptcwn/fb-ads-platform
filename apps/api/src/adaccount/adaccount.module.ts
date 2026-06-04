import { Module } from '@nestjs/common';
import { AdAccountController } from './adaccount.controller';
import { AdAccountService } from './adaccount.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AdAccountController],
  providers: [AdAccountService],
  exports: [AdAccountService],
})
export class AdAccountModule {}