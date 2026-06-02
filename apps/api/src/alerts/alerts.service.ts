import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookService } from '../facebook/facebook.service';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly facebookService: FacebookService,
  ) {}

  // ─── Alert Config CRUD ───

  async createConfig(userId: string, dto: {
    name: string;
    metric: string;
    condition?: string;
    threshold?: number;
    unit?: string;
    campaignId?: string;
    adAccountId?: string;
    notifyTelegram?: boolean;
  }) {
    if (!['BUDGET_USAGE','INSIGHT_IMPRESSIONS','INSIGHT_CLICKS','INSIGHT_SPEND','INSIGHT_CTR','INSIGHT_CPC','INSIGHT_CPA','INSIGHT_ROAS','CAMPAIGN_REJECTED','CAMPAIGN_COMPLETED','TOKEN_EXPIRING','A_B_TEST_DONE','SYNC_FAILED'].includes(dto.metric)) {
      throw new BadRequestException('Invalid metric');
    }

    return this.prisma.alertConfig.create({
      data: {
        userId,
        name: dto.name,
        metric: dto.metric as any,
        condition: dto.condition || 'ABOVE',
        threshold: dto.threshold || undefined,
        unit: dto.unit || null,
        campaignId: dto.campaignId || null,
        adAccountId: dto.adAccountId || null,
        notifyTelegram: dto.notifyTelegram || false,
      },
    });
  }

  async listConfigs(userId: string) {
    const configs = await this.prisma.alertConfig.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return configs.map(c => ({
      ...c,
      threshold: c.threshold ? Number(c.threshold) : null,
    }));
  }

  async getConfig(userId: string, id: string) {
    const config = await this.prisma.alertConfig.findFirst({ where: { id, userId } });
    if (!config) throw new NotFoundException('Alert config not found');
    return { ...config, threshold: config.threshold ? Number(config.threshold) : null };
  }

  async updateConfig(userId: string, id: string, dto: {
    name?: string;
    metric?: string;
    condition?: string;
    threshold?: number;
    unit?: string;
    campaignId?: string;
    adAccountId?: string;
    enabled?: boolean;
    notifyTelegram?: boolean;
  }) {
    const existing = await this.prisma.alertConfig.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Alert config not found');

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.metric !== undefined) {
      if (!['BUDGET_USAGE','INSIGHT_IMPRESSIONS','INSIGHT_CLICKS','INSIGHT_SPEND','INSIGHT_CTR','INSIGHT_CPC','INSIGHT_CPA','INSIGHT_ROAS','CAMPAIGN_REJECTED','CAMPAIGN_COMPLETED','TOKEN_EXPIRING','A_B_TEST_DONE','SYNC_FAILED'].includes(dto.metric)) {
        throw new BadRequestException('Invalid metric');
      }
      data.metric = dto.metric;
    }
    if (dto.condition !== undefined) data.condition = dto.condition;
    if (dto.threshold !== undefined) data.threshold = dto.threshold;
    if (dto.unit !== undefined) data.unit = dto.unit || null;
    if (dto.campaignId !== undefined) data.campaignId = dto.campaignId || null;
    if (dto.adAccountId !== undefined) data.adAccountId = dto.adAccountId || null;
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    if (dto.notifyTelegram !== undefined) data.notifyTelegram = dto.notifyTelegram;

    return this.prisma.alertConfig.update({ where: { id }, data });
  }

  async toggleConfig(userId: string, id: string) {
    const existing = await this.prisma.alertConfig.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Alert config not found');
    return this.prisma.alertConfig.update({
      where: { id },
      data: { enabled: !existing.enabled },
    });
  }

  async deleteConfig(userId: string, id: string) {
    const existing = await this.prisma.alertConfig.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Alert config not found');
    await this.prisma.alertConfig.delete({ where: { id } });
    return { message: 'Alert config deleted' };
  }

  // ─── Telegram Settings ───

  async getTelegramSettings(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { telegramBotToken: true, telegramChatId: true },
    });
    return {
      hasBotToken: !!user?.telegramBotToken,
      hasChatId: !!user?.telegramChatId,
      chatId: user?.telegramChatId || null,
      // Never expose the full bot token
      botTokenPreview: user?.telegramBotToken ? user.telegramBotToken.substring(0, 8) + '...' : null,
    };
  }

  async saveTelegramSettings(userId: string, botToken: string, chatId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { telegramBotToken: botToken, telegramChatId: chatId },
    });
    return { message: 'Telegram settings saved' };
  }

  async testTelegram(userId: string, telegramService: any) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.telegramBotToken || !user?.telegramChatId) {
      return { success: false, error: 'Telegram not configured. Add Bot Token and Chat ID first.' };
    }

    const result = await telegramService.testConnection(user.telegramBotToken, user.telegramChatId);

    if (result.success) {
      this.logger.log(`✅ Telegram test successful for user ${userId} (bot: ${result.botName})`);
    }

    return result;
  }

  async disconnectTelegram(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { telegramBotToken: null, telegramChatId: null },
    });
    return { message: 'Telegram disconnected' };
  }

  // ─── Alert History ───

  async createAlert(userId: string, dto: {
    configId?: string;
    title: string;
    message: string;
    severity?: string;
    category?: string;
    metadata?: any;
  }) {
    return this.prisma.alertHistory.create({
      data: {
        userId,
        configId: dto.configId || null,
        title: dto.title,
        message: dto.message,
        severity: dto.severity || 'INFO',
        category: dto.category || 'SYSTEM',
        metadata: dto.metadata || undefined,
      },
    });
  }

  async listAlerts(userId: string, limit = 50, unreadOnly = false) {
    const where: any = { userId };
    if (unreadOnly) where.isRead = false;

    const [alerts, unreadCount] = await Promise.all([
      this.prisma.alertHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.alertHistory.count({
        where: { userId, isRead: false },
      }),
    ]);

    return { alerts, unreadCount };
  }

  async markRead(userId: string, id?: string) {
    if (id) {
      await this.prisma.alertHistory.updateMany({
        where: { id, userId },
        data: { isRead: true },
      });
    } else {
      await this.prisma.alertHistory.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });
    }
    return { message: 'Marked as read' };
  }

  async deleteAlert(userId: string, id: string) {
    await this.prisma.alertHistory.deleteMany({ where: { id, userId } });
    return { message: 'Alert deleted' };
  }

  // ─── Create default configs for a user ───

  async ensureDefaultConfigs(userId: string) {
    const count = await this.prisma.alertConfig.count({ where: { userId } });
    if (count > 0) return;

    const defaults = [
      { name: 'Budget ใกล้หมด', metric: 'BUDGET_USAGE' as const, condition: 'ABOVE', threshold: 80, unit: 'percent', severity: 'WARNING', category: 'BUDGET' },
      { name: 'Token ใกล้หมดอายุ', metric: 'TOKEN_EXPIRING' as const, condition: 'BELOW', threshold: 7, unit: 'days', severity: 'WARNING', category: 'TOKEN' },
      { name: 'Campaign โดน Reject', metric: 'CAMPAIGN_REJECTED' as const, condition: 'EQUALS', threshold: 1, unit: null, severity: 'CRITICAL', category: 'CAMPAIGN' },
      { name: 'Sync ล้มเหลว', metric: 'SYNC_FAILED' as const, condition: 'EQUALS', threshold: 1, unit: null, severity: 'WARNING', category: 'SYNC' },
      { name: 'A/B Test เสร็จแล้ว', metric: 'A_B_TEST_DONE' as const, condition: 'EQUALS', threshold: 1, unit: null, severity: 'INFO', category: 'AB_TEST' },
      { name: 'CPC สูงเกินไป', metric: 'INSIGHT_CPC' as const, condition: 'ABOVE', threshold: 5, unit: 'amount', severity: 'WARNING', category: 'PERFORMANCE' },
      { name: 'ROAS ต่ำเกินไป', metric: 'INSIGHT_ROAS' as const, condition: 'BELOW', threshold: 1.5, unit: 'ratio', severity: 'WARNING', category: 'PERFORMANCE' },
    ];

    for (const d of defaults) {
      await this.prisma.alertConfig.create({
        data: { userId, name: d.name, metric: d.metric, condition: d.condition, threshold: d.threshold, unit: d.unit },
      });
    }
  }
}
