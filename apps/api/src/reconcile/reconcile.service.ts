import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookService } from '../facebook/facebook.service';
import { mapFbCampaignStatus } from '../common/campaign-status.util';
import { TelegramService } from '../alerts/telegram.service';

export interface ReconcileResult {
  checked: number;
  fixed: number;
  errors: number;
}

type CampaignWithOwner = {
  id: string;
  campaignId: string;
  name: string;
  status: string;
  dailyBudget: { toString(): string } | null;
  adAccount: {
    accountId: string;
    fbUser: { id: string; userId: string };
  };
};

@Injectable()
export class ReconcileService {
  private readonly logger = new Logger(ReconcileService.name);
  private readonly budgetTolerance = 0.01;
  private readonly lookbackHours = 24;
  private readonly telegramNotify =
    process.env.RECONCILE_TELEGRAM_NOTIFY !== 'false';

  constructor(
    private readonly prisma: PrismaService,
    private readonly facebook: FacebookService,
    private readonly telegram: TelegramService,
  ) {}

  async reconcileDrift(): Promise<ReconcileResult> {
    const since = new Date(Date.now() - this.lookbackHours * 60 * 60 * 1000);
    const campaigns = await this.findCampaignsToReconcile(since);

    let fixed = 0;
    let errors = 0;
    const fixedByUser = new Map<string, string[]>();

    for (const campaign of campaigns) {
      try {
        const detail = await this.reconcileCampaign(campaign);
        if (detail) {
          fixed++;
          const userId = campaign.adAccount.fbUser.userId;
          const lines = fixedByUser.get(userId) ?? [];
          lines.push(detail);
          fixedByUser.set(userId, lines);
        }
      } catch (err: any) {
        errors++;
        this.logger.error(
          `Reconcile failed for campaign ${campaign.campaignId}: ${err.message}`,
        );
      }
    }

    if (this.telegramNotify && fixedByUser.size > 0) {
      await this.notifyUsers(fixedByUser);
    }

    this.logger.log(
      `Reconciliation complete: ${campaigns.length} checked, ${fixed} fixed, ${errors} errors`,
    );

    return { checked: campaigns.length, fixed, errors };
  }

  private async findCampaignsToReconcile(since: Date): Promise<CampaignWithOwner[]> {
    const [overridden, failedRules] = await Promise.all([
      this.prisma.campaign.findMany({
        where: { statusOverriddenAt: { gte: since } },
        include: {
          adAccount: { include: { fbUser: true } },
        },
        take: 100,
      }),
      this.prisma.campaign.findMany({
        where: {
          rules: {
            some: {
              logs: {
                some: { success: false, triggeredAt: { gte: since } },
              },
            },
          },
        },
        include: {
          adAccount: { include: { fbUser: true } },
        },
        take: 100,
      }),
    ]);

    const byId = new Map<string, CampaignWithOwner>();
    for (const c of [...overridden, ...failedRules]) {
      byId.set(c.id, c as CampaignWithOwner);
    }
    return [...byId.values()];
  }

  private async reconcileCampaign(campaign: CampaignWithOwner): Promise<string | null> {
    const accessToken = await this.facebook.getDecryptedToken(campaign.adAccount.fbUser.id);
    const fbState = await this.facebook.getCampaignState(campaign.campaignId, accessToken);

    const fbStatus = mapFbCampaignStatus(fbState.status);
    const localStatus = campaign.status;
    const localBudget = campaign.dailyBudget ? Number(campaign.dailyBudget) : null;
    const fbBudget = fbState.dailyBudget;

    const statusDrift = localStatus !== fbStatus;
    const budgetDrift =
      fbBudget !== null &&
      (localBudget === null || Math.abs(localBudget - fbBudget) >= this.budgetTolerance);

    if (!statusDrift && !budgetDrift) {
      return null;
    }

    await this.prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: fbStatus as any,
        ...(fbBudget !== null ? { dailyBudget: fbBudget } : {}),
      },
    });

    await this.prisma.activityLog.create({
      data: {
        fbUserId: campaign.adAccount.fbUser.id,
        action: 'RECONCILED',
        entityType: 'campaign',
        entityId: campaign.id,
        metadata: {
          fbCampaignId: campaign.campaignId,
          statusDrift,
          budgetDrift,
          before: { status: localStatus, dailyBudget: localBudget },
          after: { status: fbStatus, dailyBudget: fbBudget },
        },
      },
    });

    const detail =
      `${campaign.name}: status ${localStatus}→${fbStatus}` +
      (budgetDrift ? `, budget ${localBudget}→${fbBudget}` : '');

    this.logger.warn(`Reconciled campaign ${campaign.campaignId}: ${detail}`);

    return detail;
  }

  private async notifyUsers(fixedByUser: Map<string, string[]>): Promise<void> {
    for (const [userId, lines] of fixedByUser) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { telegramBotToken: true, telegramChatId: true },
      });
      if (!user?.telegramBotToken || !user?.telegramChatId) continue;

      const preview = lines.slice(0, 5).join('\n');
      const more = lines.length > 5 ? `\n...and ${lines.length - 5} more` : '';
      const message =
        `Reconciled ${lines.length} campaign(s) from Facebook (source of truth):\n${preview}${more}`;

      const formatted = this.telegram.formatAlert(
        'Data drift corrected',
        message,
        'WARNING',
        'SYNC',
      );
      await this.telegram.sendMessage(
        user.telegramBotToken,
        user.telegramChatId,
        formatted,
      );
    }
  }
}