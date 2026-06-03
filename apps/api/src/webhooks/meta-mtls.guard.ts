import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { readFileSync, existsSync } from 'fs';

@Injectable()
export class MetaMtlsGuard implements CanActivate {
  private readonly logger = new Logger(MetaMtlsGuard.name);
  private readonly required = process.env.META_WEBHOOK_MTLS_REQUIRED === 'true';
  private readonly caBundlePath = process.env.META_CA_BUNDLE_PATH;

  canActivate(context: ExecutionContext): boolean {
    if (!this.required) return true;

    const req = context.switchToHttp().getRequest<Request>();

    const forwardedVerify =
      req.headers['x-ssl-client-verify'] === 'SUCCESS' ||
      req.headers['x-client-cert-verified'] === 'SUCCESS';

    const socket = req.socket as { getPeerCertificate?: () => { subject?: unknown; issuer?: unknown; raw?: Buffer } };
    const cert = socket?.getPeerCertificate?.();
    const hasPeerCert = Boolean(cert?.raw?.length);

    if (forwardedVerify || hasPeerCert) {
      if (this.caBundlePath && existsSync(this.caBundlePath)) {
        this.logger.debug('mTLS client certificate present (custom CA bundle configured)');
      }
      return true;
    }

    throw new UnauthorizedException(
      'Meta webhook requires mutual TLS client certificate',
    );
  }
}

/** Optional: load Meta CA bundle for termination at reverse proxy (documented in docs/meta-webhooks-mtls.md). */
export function loadMetaCaHint(): string | null {
  const path = process.env.META_CA_BUNDLE_PATH;
  if (!path || !existsSync(path)) return null;
  readFileSync(path);
  return path;
}