import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CampaignLockService {
  private readonly logger = new Logger(CampaignLockService.name);

  constructor(private readonly prisma: PrismaService) {}

  async withCampaignLock<T>(
    campaignId: string,
    fn: () => Promise<T>,
    context: string,
  ): Promise<T | null> {
    const lockKey = this.toLockKey(campaignId);
    const result = await this.prisma.$queryRaw<[{ acquired: boolean }]>`
      SELECT pg_try_advisory_lock(${lockKey}::bigint) AS acquired
    `;
    const acquired = result[0]?.acquired;

    if (!acquired) {
      this.logger.warn(`[${context}] campaign ${campaignId} is locked by another process — skipping`);
      return null;
    }

    try {
      return await fn();
    } finally {
      await this.prisma.$queryRaw`SELECT pg_advisory_unlock(${lockKey}::bigint)`;
    }
  }

  private toLockKey(id: string): bigint {
    // djb2 hash: stable, collision-unlikely for UUIDs
    let hash = 5381n;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5n) + hash + BigInt(id.charCodeAt(i))) & 0x7FFFFFFFFFFFFFFFn;
    }
    return hash;
  }
}
