import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookService } from '../facebook/facebook.service';
import { mapFbCampaignStatus } from '../common/campaign-status.util';
import { AutomationGuardService } from '../common/automation-guard.service';
import { ApprovalsService } from '../approvals/approvals.service';

export interface CampaignMutationContext {
  campaignDbId: string;
  fbCampaignId: string;
  accessToken: string;
  accountId?: string;
  userId?: string;
  fbUserId?: string;
}

@Injectable()
export class FbMutationService {
  private readonly logger = new Logger(FbMutationService.name);
  private readonly budgetTolerance = 0.01;

  constructor(
    private readonly prisma: PrismaService,
    private readonly facebook: FacebookService,
    private readonly automationGuard: AutomationGuardService,
    @Inject(forwardRef(() => ApprovalsService))
    private readonly approvals: ApprovalsService,
  ) {}

  /**
   * Idempotent status change: skip FB call if already at target; always align DB with FB truth.
   */
  async setCampaignStatus(
    ctx: CampaignMutationContext & { accountId: string; status: string },
    context: string,
  ): Promise<void> {
    const targetStatus = mapFbCampaignStatus(ctx.status);
    const fbState = await this.facebook.getCampaignState(ctx.fbCampaignId, ctx.accessToken);
    const fbMapped = mapFbCampaignStatus(fbState.status);

    if (fbMapped === targetStatus) {
      await this.syncLocalStatusIfDrift(ctx.campaignDbId, targetStatus, context, 'status-noop');
      return;
    }

    await this.facebook.updateCampaignStatus(
      ctx.accountId,
      ctx.fbCampaignId,
      ctx.status,
      ctx.accessToken,
    );

    try {
      await this.prisma.campaign.update({
        where: { id: ctx.campaignDbId },
        data: { status: targetStatus as any, statusOverriddenAt: new Date() },
      });
    } catch (err: any) {
      this.logger.error(
        `[${context}] FB status updated but DB failed for ${ctx.fbCampaignId}: ${err.message}`,
      );
      throw err;
    }

    await this.logMutation(ctx, context, {
      type: 'SET_STATUS',
      targetStatus,
      fbStatusBefore: fbState.status,
    });
  }

  /**
   * Idempotent budget change: skip FB when already at target (within tolerance).
   */
  async setCampaignDailyBudget(
    ctx: CampaignMutationContext,
    dailyBudget: number,
    context: string,
    skipGuard = false,
    guardMeta?: { source: string; sourceId?: string; action: string },
  ): Promise<'applied' | 'pending_approval'> {
    const fbState = await this.facebook.getCampaignState(ctx.fbCampaignId, ctx.accessToken);
    const currentBudget = fbState.dailyBudget ?? 0;
    let roundedTarget = Math.round(dailyBudget * 100) / 100;

    if (!skipGuard && ctx.userId && guardMeta) {
      const guard = this.automationGuard.evaluateBudgetChange({
        currentBudget,
        proposedBudget: roundedTarget,
        source: guardMeta.source,
      });

      roundedTarget = guard.effectiveBudget;

      if (guard.requiresApproval) {
        await this.approvals.createPending(ctx.userId, {
          source: guardMeta.source,
          sourceId: guardMeta.sourceId,
          action: guardMeta.action,
          reason: guard.reason ?? 'Budget change requires approval',
          payload: {
            kind: 'SET_CAMPAIGN_DAILY_BUDGET',
            ctx,
            dailyBudget: roundedTarget,
            context,
          },
        });
        return 'pending_approval';
      }
    }

    if (
      fbState.dailyBudget !== null &&
      Math.abs(fbState.dailyBudget - roundedTarget) < this.budgetTolerance
    ) {
      await this.syncLocalBudgetIfDrift(ctx.campaignDbId, roundedTarget, context, 'budget-noop');
      return 'applied';
    }

    await this.facebook.updateCampaignBudget(ctx.fbCampaignId, roundedTarget, ctx.accessToken);

    try {
      await this.prisma.campaign.update({
        where: { id: ctx.campaignDbId },
        data: { dailyBudget: roundedTarget },
      });
    } catch (err: any) {
      this.logger.error(
        `[${context}] FB budget updated but DB failed for ${ctx.fbCampaignId}: ${err.message}`,
      );
      throw err;
    }

    await this.logMutation(ctx, context, {
      type: 'SET_BUDGET',
      targetBudget: roundedTarget,
      fbBudgetBefore: fbState.dailyBudget,
    });
    return 'applied';
  }

  private async syncLocalStatusIfDrift(
    campaignDbId: string,
    targetStatus: string,
    context: string,
    phase: string,
  ): Promise<void> {
    const local = await this.prisma.campaign.findUnique({ where: { id: campaignDbId } });
    if (!local || local.status === targetStatus) return;

    await this.prisma.campaign.update({
      where: { id: campaignDbId },
      data: { status: targetStatus as any, statusOverriddenAt: new Date() },
    });
    this.logger.warn(
      `[${context}] DB status drift corrected (${phase}): ${local.status} → ${targetStatus}`,
    );
  }

  private async syncLocalBudgetIfDrift(
    campaignDbId: string,
    targetBudget: number,
    context: string,
    phase: string,
  ): Promise<void> {
    const local = await this.prisma.campaign.findUnique({ where: { id: campaignDbId } });
    if (!local) return;
    const localBudget = local.dailyBudget ? Number(local.dailyBudget) : null;
    if (localBudget !== null && Math.abs(localBudget - targetBudget) < this.budgetTolerance) {
      return;
    }

    await this.prisma.campaign.update({
      where: { id: campaignDbId },
      data: { dailyBudget: targetBudget },
    });
    this.logger.warn(
      `[${context}] DB budget drift corrected (${phase}): ${localBudget} → ${targetBudget}`,
    );
  }

  private async logMutation(
    ctx: CampaignMutationContext,
    context: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.activityLog.create({
        data: {
          userId: ctx.userId ?? null,
          fbUserId: ctx.fbUserId ?? null,
          action: 'FB_MUTATION',
          entityType: 'campaign',
          entityId: ctx.campaignDbId,
          metadata: { context, fbCampaignId: ctx.fbCampaignId, ...metadata },
        },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to write activity log: ${err.message}`);
    }
  }
}