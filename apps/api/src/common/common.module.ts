import { Global, Module, OnModuleInit } from '@nestjs/common';
import { ObjectStorageService } from './object-storage.service';
import { FbAccountRateLimiterService } from './fb-account-rate-limiter.service';
import { AutomationGuardService } from './automation-guard.service';
import { bindFbAccountRateLimiter } from './facebook-rate-limit';

@Global()
@Module({
  providers: [ObjectStorageService, FbAccountRateLimiterService, AutomationGuardService],
  exports: [ObjectStorageService, FbAccountRateLimiterService, AutomationGuardService],
})
export class CommonModule implements OnModuleInit {
  constructor(private readonly fbRateLimiter: FbAccountRateLimiterService) {}

  onModuleInit(): void {
    bindFbAccountRateLimiter(this.fbRateLimiter);
  }
}