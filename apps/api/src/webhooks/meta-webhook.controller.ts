import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  RawBodyRequest,
} from '@nestjs/common';
import { Request } from 'express';
import { MetaMtlsGuard } from './meta-mtls.guard';
import { MetaWebhookService } from './meta-webhook.service';

@Controller('webhooks/meta')
export class MetaWebhookController {
  constructor(private readonly webhookService: MetaWebhookService) {}

  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    return this.webhookService.verifySubscription(mode, token, challenge);
  }

  @Post()
  @UseGuards(MetaMtlsGuard)
  @HttpCode(HttpStatus.OK)
  async receive(@Req() req: RawBodyRequest<Request>) {
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    this.webhookService.verifySignature(
      raw,
      req.headers['x-hub-signature-256'] as string | undefined,
    );
    await this.webhookService.handlePayload(req.body ?? {});
    return { received: true };
  }
}