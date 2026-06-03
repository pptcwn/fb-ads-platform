import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { FacebookModule } from './facebook/facebook.module';
import { SyncModule } from './sync/sync.module';
import { AdAccountModule } from './adaccount/adaccount.module';
import { InsightsModule } from './insights/insights.module';
import { RulesModule } from './rules/rules.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { WarmupModule } from './warmup/warmup.module';
import { ReportsModule } from './reports/reports.module';
import { AbtestModule } from './abtest/abtest.module';
import { AutoSyncModule } from './sync/auto-sync.module';
import { BudgetModule } from './budget/budget.module';
import { AlertsModule } from './alerts/alerts.module';
import { CreativesModule } from './creatives/creatives.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AdsetsModule } from './adsets/adsets.module';
import { AudiencesModule } from './audiences/audiences.module';
import { SchedulesModule } from './schedules/schedules.module';
import { TemplatesModule } from './templates/templates.module';
import { CampaignLockModule } from './campaign-lock/campaign-lock.module';
import { ReconcileModule } from './reconcile/reconcile.module';
import { CommonModule } from './common/common.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    BullModule.forRoot({
      connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
    }),
    PrismaModule,
    CommonModule,
    CampaignLockModule,
    AuthModule,
    FacebookModule,
    SyncModule,
    AdAccountModule,
    InsightsModule,
    RulesModule,
    CampaignsModule,
    WarmupModule,
    ReportsModule,
    AbtestModule,
    AutoSyncModule,
    BudgetModule,
    AlertsModule,
    CreativesModule,
    AnalyticsModule,
    AdsetsModule,
    AudiencesModule,
    SchedulesModule,
    TemplatesModule,
    ReconcileModule,
    ApprovalsModule,
    WebhooksModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
