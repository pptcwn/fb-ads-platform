import { Module } from '@nestjs/common';
import { MetaWebhookController } from './meta-webhook.controller';
import { MetaWebhookService } from './meta-webhook.service';
import { MetaMtlsGuard } from './meta-mtls.guard';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MetaWebhookController],
  providers: [MetaWebhookService, MetaMtlsGuard],
})
export class WebhooksModule {}