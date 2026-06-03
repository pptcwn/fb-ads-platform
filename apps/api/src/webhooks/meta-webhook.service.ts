import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MetaWebhookService {
  private readonly logger = new Logger(MetaWebhookService.name);
  private readonly verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN ?? '';
  private readonly appSecret = process.env.FB_APP_SECRET ?? '';

  constructor(private readonly prisma: PrismaService) {}

  verifySubscription(mode: string, token: string, challenge: string): string {
    if (mode === 'subscribe' && token === this.verifyToken && challenge) {
      return challenge;
    }
    throw new BadRequestException('Invalid webhook verification');
  }

  verifySignature(rawBody: Buffer | string, signatureHeader?: string): void {
    if (!this.appSecret || !signatureHeader) return;

    const expected = 'sha256=' + createHmac('sha256', this.appSecret)
      .update(rawBody)
      .digest('hex');

    const sigBuf = Buffer.from(signatureHeader);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      throw new BadRequestException('Invalid X-Hub-Signature-256');
    }
  }

  async handlePayload(payload: { object?: string; entry?: unknown[] }): Promise<void> {
    await this.prisma.activityLog.create({
      data: {
        action: 'META_WEBHOOK_RECEIVED',
        entityType: 'webhook',
        entityId: payload.object ?? 'unknown',
        metadata: {
          entryCount: payload.entry?.length ?? 0,
          object: payload.object,
        },
      },
    });

    this.logger.log(
      `Meta webhook: object=${payload.object} entries=${payload.entry?.length ?? 0}`,
    );
  }
}