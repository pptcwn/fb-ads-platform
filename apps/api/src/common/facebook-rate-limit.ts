import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { Logger } from '@nestjs/common';
import { FbAccountRateLimiterService } from './fb-account-rate-limiter.service';

const logger = new Logger('FacebookRateLimit');
const SETUP_FLAG = '__fbRateLimitSetup';

export type FbAxiosConfig = InternalAxiosRequestConfig & {
  __fbRetryCount?: number;
  fbAdAccountId?: string;
};

let accountRateLimiter: FbAccountRateLimiterService | null = null;

export function bindFbAccountRateLimiter(limiter: FbAccountRateLimiterService): void {
  accountRateLimiter = limiter;
}

const MAX_RETRIES = parseInt(process.env.FB_API_MAX_RETRIES ?? '4', 10);
const BASE_DELAY_MS = parseInt(process.env.FB_API_RETRY_BASE_MS ?? '1000', 10);

export function parseBusinessUseCaseUsage(headers: Record<string, unknown>): void {
  const raw =
    headers['x-business-use-case-usage'] ??
    headers['X-Business-Use-Case-Usage'];
  if (!raw) return;

  try {
    const usage = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!usage || typeof usage !== 'object') return;

    for (const [accountId, metrics] of Object.entries(usage as Record<string, unknown>)) {
      const entries = Array.isArray(metrics) ? metrics : [metrics];
      for (const m of entries as Array<{
        call_count?: number;
        total_cputime?: number;
        total_time?: number;
        estimated_time_to_regain_access?: number;
      }>) {
        const callCount = m.call_count ?? 0;
        const regain = m.estimated_time_to_regain_access ?? 0;
        if (callCount >= 80 || regain > 0) {
          logger.warn(
            `FB API usage high for ${accountId}: call_count=${callCount}, regain_in=${regain}s`,
          );
        }
      }
    }
  } catch {
    logger.debug(`Could not parse X-Business-Use-Case-Usage header`);
  }
}

export function isRetryableFacebookError(error: AxiosError): boolean {
  const status = error.response?.status;
  if (status === 429 || status === 503) return true;

  const fbError = (error.response?.data as { error?: { code?: number } })?.error;
  const code = fbError?.code;
  return code === 4 || code === 17 || code === 32 || code === 613;
}

function retryDelayMs(attempt: number, error: AxiosError): number {
  const retryAfter = error.response?.headers?.['retry-after'];
  if (retryAfter) {
    const seconds = parseInt(String(retryAfter), 10);
    if (!isNaN(seconds) && seconds > 0) return seconds * 1000;
  }
  return BASE_DELAY_MS * Math.pow(2, attempt);
}

export function setupFacebookRateLimitInterceptors(instance: AxiosInstance): void {
  if ((instance as unknown as Record<string, boolean>)[SETUP_FLAG]) return;
  (instance as unknown as Record<string, boolean>)[SETUP_FLAG] = true;

  instance.interceptors.request.use(async (config: FbAxiosConfig) => {
    if (!accountRateLimiter) return config;
    const url = config.url ?? '';
    const accountId = accountRateLimiter.resolveAccountId(url, config.fbAdAccountId);
    if (accountId) await accountRateLimiter.acquire(accountId);
    return config;
  });

  instance.interceptors.response.use(
    (response) => {
      parseBusinessUseCaseUsage(response.headers as Record<string, unknown>);
      return response;
    },
    async (error: AxiosError) => {
      const config = error.config as InternalAxiosRequestConfig & { __fbRetryCount?: number };
      if (!config) return Promise.reject(error);

      const retryCount = config.__fbRetryCount ?? 0;
      if (retryCount < MAX_RETRIES && isRetryableFacebookError(error)) {
        config.__fbRetryCount = retryCount + 1;
        const delay = retryDelayMs(retryCount, error);
        logger.warn(
          `FB API retry ${config.__fbRetryCount}/${MAX_RETRIES} in ${delay}ms (HTTP ${error.response?.status ?? 'n/a'})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        return instance.request(config);
      }

      return Promise.reject(error);
    },
  );
}

let sharedFacebookAxios: AxiosInstance | null = null;

/** Shared axios instance with FB rate-limit interceptors (for sync/auto-sync). */
export function getFacebookAxios(): AxiosInstance {
  if (!sharedFacebookAxios) {
    sharedFacebookAxios = axios.create({ timeout: 60000, maxRedirects: 5 });
    setupFacebookRateLimitInterceptors(sharedFacebookAxios);
  }
  return sharedFacebookAxios;
}