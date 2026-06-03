import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FbMutationService, CampaignMutationContext } from '../fb-mutation/fb-mutation.service';

export interface BudgetApprovalPayload {
  kind: 'SET_CAMPAIGN_DAILY_BUDGET';
  ctx: CampaignMutationContext;
  dailyBudget: number;
  context: string;
}

@Injectable()
export class ApprovalsService {
  private readonly logger = new Logger(ApprovalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => FbMutationService))
    private readonly fbMutation: FbMutationService,
  ) {}

  async createPending(
    userId: string,
    dto: {
      source: string;
      sourceId?: string;
      action: string;
      payload: BudgetApprovalPayload;
      reason: string;
    },
  ) {
    const approval = await this.prisma.automationApproval.create({
      data: {
        userId,
        source: dto.source,
        sourceId: dto.sourceId ?? null,
        action: dto.action,
        payload: dto.payload as object,
        status: 'PENDING',
        reason: dto.reason,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        userId,
        action: 'AUTOMATION_APPROVAL_PENDING',
        entityType: 'approval',
        entityId: approval.id,
        metadata: {
          source: dto.source,
          action: dto.action,
          reason: dto.reason,
          dailyBudget: dto.payload.dailyBudget,
        },
      },
    });

    this.logger.warn(
      `Budget change queued for approval: ${dto.action} (${approval.id}) — ${dto.reason}`,
    );

    return approval;
  }

  async list(userId: string, status = 'PENDING') {
    return this.prisma.automationApproval.findMany({
      where: { userId, status },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async approve(userId: string, id: string) {
    const approval = await this.getPending(userId, id);
    const payload = approval.payload as unknown as BudgetApprovalPayload;

    if (payload.kind === 'SET_CAMPAIGN_DAILY_BUDGET') {
      await this.fbMutation.setCampaignDailyBudget(
        payload.ctx,
        payload.dailyBudget,
        `${payload.context}:APPROVED`,
        true,
      );
    } else {
      throw new BadRequestException(`Unknown approval payload kind`);
    }

    const updated = await this.prisma.automationApproval.update({
      where: { id },
      data: { status: 'APPROVED', reviewedAt: new Date() },
    });

    await this.prisma.activityLog.create({
      data: {
        userId,
        action: 'AUTOMATION_APPROVAL_APPROVED',
        entityType: 'approval',
        entityId: id,
        metadata: { action: approval.action, source: approval.source },
      },
    });

    return updated;
  }

  async reject(userId: string, id: string, note?: string) {
    const approval = await this.getPending(userId, id);
    const updated = await this.prisma.automationApproval.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        reason: note ? `${approval.reason ?? ''} | rejected: ${note}` : approval.reason,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        userId,
        action: 'AUTOMATION_APPROVAL_REJECTED',
        entityType: 'approval',
        entityId: id,
      },
    });

    return updated;
  }

  private async getPending(userId: string, id: string) {
    const approval = await this.prisma.automationApproval.findFirst({
      where: { id, userId, status: 'PENDING' },
    });
    if (!approval) throw new NotFoundException('Pending approval not found');
    return approval;
  }
}