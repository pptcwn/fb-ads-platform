import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookService } from '../facebook/facebook.service';
import { TelegramService } from './telegram.service';

@Injectable()
export class AlertsScheduler {
  private readonly logger = new Logger(AlertsScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly facebookService: FacebookService,
    private readonly telegramService: TelegramService,
  ) {}

  async checkAlerts() {
    this.logger.log('🔔 Checking alerts...');

    const configs = await this.prisma.alertConfig.findMany({
      where: { enabled: true },
      include: {
        user: {
          include: {
            fbUsers: {
              include: { adAccounts: { include: { campaigns: true } } },
            },
            abTests: { where: { status: 'COMPLETED' } },
          },
        },
      },
    });

    for (const config of configs) {
      try {
        await this.evaluateConfig(config);
      } catch (err: any) {
        this.logger.error(`Error checking config "${config.name}": ${err.message}`);
      }
    }
  }

  private async evaluateConfig(config: any) {
    const { user, metric, condition, threshold, campaignId, adAccountId } = config;
    const thresholdNum = threshold ? Number(threshold) : null;
    const userId = user.id;

    switch (metric) {
      case 'BUDGET_USAGE':
        await this.checkBudgetUsage(userId, config, user.fbUsers, condition, thresholdNum, adAccountId);
        break;
      case 'CAMPAIGN_REJECTED':
        await this.checkCampaignStatus(userId, config, user.fbUsers, 'REJECTED');
        break;
      case 'CAMPAIGN_COMPLETED':
        await this.checkCampaignStatus(userId, config, user.fbUsers, 'COMPLETED');
        break;
      case 'TOKEN_EXPIRING':
        await this.checkTokenExpiry(userId, config, user.fbUsers, thresholdNum);
        break;
      case 'A_B_TEST_DONE':
        await this.checkAbTestDone(userId, config, user.abTests);
        break;
      case 'INSIGHT_CPC':
      case 'INSIGHT_CTR':
      case 'INSIGHT_CPA':
      case 'INSIGHT_ROAS':
      case 'INSIGHT_SPEND':
        await this.checkInsightMetric(userId, config, user.fbUsers, metric, condition, thresholdNum, campaignId, adAccountId);
        break;
      default:
        break;
    }
  }

  private async createAlert(userId: string, configId: string, title: string, message: string, severity: string, category: string, metadata?: any) {
    // Check if similar alert already exists in last 30 min (dedup)
    const recent = await this.prisma.alertHistory.findFirst({
      where: {
        userId,
        configId,
        createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
      },
    });
    if (recent) return; // Already has a recent alert, skip to avoid spam

    await this.prisma.alertHistory.create({
      data: {
        userId,
        configId,
        title,
        message,
        severity,
        category,
        metadata: metadata || undefined,
      },
    });
    this.logger.log(`📢 Alert: ${title} — ${message}`);

    // Send to Telegram if enabled
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { telegramBotToken: true, telegramChatId: true },
      });

      // Check if this specific config has notifyTelegram enabled
      const config = configId ? await this.prisma.alertConfig.findUnique({
        where: { id: configId },
        select: { notifyTelegram: true },
      }) : null;

      if (config?.notifyTelegram && user?.telegramBotToken && user?.telegramChatId) {
        const tgMessage = this.telegramService.formatAlert(title, message, severity, category);
        await this.telegramService.sendMessage(user.telegramBotToken, user.telegramChatId, tgMessage);
      }
    } catch (err: any) {
      this.logger.error(`Failed to send Telegram alert: ${err.message}`);
    }
  }

  // ─── Check: Budget Usage ───

  private async checkBudgetUsage(userId: string, config: any, fbUsers: any[], condition: string, threshold: number | null, adAccountId?: string | null) {
    const accounts = fbUsers.flatMap((fu: any) => fu.adAccounts);
    for (const account of accounts) {
      if (adAccountId && account.id !== adAccountId) continue;
      const dailyBudget = account.dailyBudget ? Number(account.dailyBudget) : 0;
      const spentToday = Number(account.spentToday);
      if (dailyBudget <= 0) continue;

      const usagePct = Math.round((spentToday / dailyBudget) * 100);
      const triggered = condition === 'ABOVE' ? usagePct >= (threshold || 80) : usagePct <= (threshold || 80);

      if (triggered) {
        await this.createAlert(
          userId, config.id,
          `💰 Budget สูง: ${account.name}`,
          `ใช้ไป ${usagePct}% ของงบรายวัน (${spentToday.toLocaleString()} / ${dailyBudget.toLocaleString()} ${account.currency})`,
          usagePct >= 90 ? 'CRITICAL' : 'WARNING',
          'BUDGET',
          { accountId: account.id, accountName: account.name, usagePct, spentToday, dailyBudget },
        );
      }
    }
  }

  // ─── Check: Campaign Rejected / Completed ───

  private async checkCampaignStatus(userId: string, config: any, fbUsers: any[], status: string) {
    const accounts = fbUsers.flatMap((fu: any) => fu.adAccounts);
    for (const account of accounts) {
      const campaigns = (account.campaigns || []).filter((c: any) => c.status === status);
      for (const camp of campaigns) {
        // Check we haven't alerted for this campaign already
        const alerted = await this.prisma.alertHistory.findFirst({
          where: { userId, metadata: { path: ['campaignId'], equals: camp.id } },
        });
        if (alerted) continue;

        const severity = status === 'REJECTED' ? 'CRITICAL' : 'INFO';
        const label = status === 'REJECTED' ? '❌ โดน Reject' : '✅ เสร็จสมบูรณ์';

        await this.createAlert(
          userId, config.id,
          `${label}: ${camp.name}`,
          `Campaign "${camp.name}" อยู่ในสถานะ ${status}`,
          severity,
          'CAMPAIGN',
          { campaignId: camp.id, campaignName: camp.name, status, accountName: account.name },
        );
      }
    }
  }

  // ─── Check: Token Expiry ───

  private async checkTokenExpiry(userId: string, config: any, fbUsers: any[], thresholdDays: number | null) {
    const days = thresholdDays || 7;
    const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    for (const fbUser of fbUsers) {
      const expires = new Date(fbUser.tokenExpiresAt);
      if (expires <= cutoff) {
        const remainingDays = Math.ceil((expires.getTime() - Date.now()) / (24 * 60 * 60 * 1000));

        // Dedup: check if already alerted in last 24h
        const alerted = await this.prisma.alertHistory.findFirst({
          where: {
            userId,
            configId: config.id,
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        });
        if (alerted) continue;

        await this.createAlert(
          userId, config.id,
          `🔑 Token ใกล้หมดอายุ: ${fbUser.facebookName}`,
          `Facebook token จะหมดอายุในอีก ${remainingDays} วัน (${expires.toLocaleDateString('th')})`,
          remainingDays <= 1 ? 'CRITICAL' : 'WARNING',
          'TOKEN',
          { fbUserId: fbUser.id, name: fbUser.facebookName, expiresAt: expires.toISOString(), remainingDays },
        );
      }
    }
  }

  // ─── Check: A/B Test Done ───

  private async checkAbTestDone(userId: string, config: any, abTests: any[]) {
    // Note: this only catches tests already marked COMPLETED
    // Actual completion logic runs when a test is manually stopped
    // We check if any completed tests haven't been notified
    const completed = await this.prisma.abTest.findMany({
      where: { userId, status: 'COMPLETED' },
    });

    for (const test of completed) {
      const alerted = await this.prisma.alertHistory.findFirst({
        where: { userId, configId: config.id, metadata: { path: ['abTestId'], equals: test.id } },
      });
      if (!alerted) {
        await this.createAlert(
          userId, config.id,
          `🔁 A/B Test เสร็จ: ${test.name}`,
          `A/B Test "${test.name}" เสร็จสมบูรณ์แล้ว — ตรวจสอบผลลัพธ์`,
          'INFO',
          'AB_TEST',
          { abTestId: test.id, abTestName: test.name },
        );
      }
    }
  }

  // ─── Check: Insight Metrics (CPC, CTR, CPA, ROAS, Spend) ───

  private async checkInsightMetric(
    userId: string, config: any, fbUsers: any[],
    metric: string, condition: string, threshold: number | null,
    campaignId?: string | null, adAccountId?: string | null,
  ) {
    // Use latest campaign insight data
    const accounts = fbUsers.flatMap((fu: any) => fu.adAccounts);
    for (const account of accounts) {
      if (adAccountId && account.id !== adAccountId) continue;

      const campaigns = (account.campaigns || []).filter((c: any) => {
        if (campaignId) return c.id === campaignId;
        return ['ACTIVE', 'PAUSED'].includes(c.status);
      });

      for (const camp of campaigns) {
        let value: number | null = null;
        let label = '';

        switch (metric) {
          case 'INSIGHT_CPC': value = Number(camp.cpc); label = 'CPC'; break;
          case 'INSIGHT_CTR': value = Number(camp.ctr); label = 'CTR'; break;
          case 'INSIGHT_CPA': value = Number(camp.cpa); label = 'CPA'; break;
          case 'INSIGHT_ROAS': value = Number(camp.roas); label = 'ROAS'; break;
          case 'INSIGHT_SPEND': value = Number(camp.spend); label = 'Spend'; break;
        }

        if (value === null || threshold === null) continue;

        const triggered = condition === 'ABOVE' ? value >= threshold : value <= threshold;
        if (!triggered) continue;

        // Dedup per campaign per 24h
        const alerted = await this.prisma.alertHistory.findFirst({
          where: {
            userId,
            configId: config.id,
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            metadata: { path: ['campaignId'], equals: camp.id },
          },
        });
        if (alerted) continue;

        const severity = metric === 'INSIGHT_CTR' || metric === 'INSIGHT_ROAS' ? 'WARNING' : 'WARNING';

        await this.createAlert(
          userId, config.id,
          `📊 ${label} แจ้งเตือน: ${camp.name}`,
          `${label} = ${metric === 'INSIGHT_CPC' || metric === 'INSIGHT_CPA' ? '$' : ''}${typeof value === 'number' ? value.toFixed(2) : value} (threshold: ${condition === 'ABOVE' ? '>' : '<'} ${threshold})`,
          severity,
          'PERFORMANCE',
          { campaignId: camp.id, campaignName: camp.name, metric, value, threshold, condition, accountName: account.name },
        );
      }
    }
  }
}
