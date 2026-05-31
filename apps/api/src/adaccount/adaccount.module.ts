import { Module } from '@nestjs/common';
import { AdAccountController } from './adaccount.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AdAccountController],
})
export class AdAccountModule {}
