import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

const DEFAULT_MAX_PER_SEC = parseInt(process.env.FB_API_MAX_CALLS_PER_ACCOUNT_SEC ?? '8', 10);
const WINDOW_MS = 1000;

function extractAdAccountId(url: string): string | null {
  if (!url) return null;
  const act = url.match(/act_(\d+)/);
  if (act) return act[1];
  return null;
}

@Injectable()
export class FbAccountRateLimiterService implements OnModuleDestroy {
  private readonly logger = new Logger(FbAccountRateLimiterService.name);
  private readonly redis: Redis | null;
  private readonly maxPerWindow: number;
  private readonly enabled: boolean;

  constructor() {
    this.maxPerWindow = Math.max(1, DEFAULT_MAX_PER_SEC);
    this.enabled = process.env.FB_API_RATE_LIMIT_ENABLED !== 'false';
    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
    if (this.enabled) {
      this.redis = new Redis(redisUrl, { maxRetriesPerRequest: 2, lazyConnect: true });
      this.redis.connect().catch((err) => {
        this.logger.warn(`FB rate limiter Redis unavailable: ${err.message}`);
      });
    } else {
      this.redis = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis?.quit();
  }

  resolveAccountId(url?: string, explicit?: string): string | null {
    if (explicit) return explicit.replace(/^act_/, '');
    if (url) return extractAdAccountId(url);
    return null;
  }

  /**
   * Sliding-window limiter per ad account (Redis). Falls through if Redis is down.
   */
  async acquire(accountId: string): Promise<void> {
    if (!this.enabled || !this.redis || this.redis.status !== 'ready') return;

    const key = `fb:ratelimit:${accountId}`;
    const now = Date.now();
    const windowStart = now - WINDOW_MS;

    try {
      const pipeline = this.redis.multi();
      pipeline.zremrangebyscore(key, 0, windowStart);
      pipeline.zadd(key, now, `${now}-${Math.random()}`);
      pipeline.zcard(key);
      pipeline.pexpire(key, WINDOW_MS * 2);
      const results = await pipeline.exec();
      const count = (results?.[2]?.[1] as number) ?? 0;

      if (count > this.maxPerWindow) {
        const waitMs = WINDOW_MS - (now % WINDOW_MS) + 50;
        this.logger.debug(`Rate limit act_${accountId}: waiting ${waitMs}ms (${count}/${this.maxPerWindow})`);
        await new Promise((r) => setTimeout(r, waitMs));
        return this.acquire(accountId);
      }
    } catch (err: any) {
      this.logger.debug(`Rate limiter skip: ${err.message}`);
    }
  }
}