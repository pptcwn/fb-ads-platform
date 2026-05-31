import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRuleDto } from './dto/create-rule.dto';
import { UpdateRuleDto } from './dto/update-rule.dto';

@Injectable()
export class RulesService {
  private readonly logger = new Logger(RulesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateRuleDto) {
    // Validate campaign/adAccount ownership if specified
    if (dto.campaignId) {
      const campaign = await this.prisma.campaign.findUnique({ where: { id: dto.campaignId } });
      if (!campaign) throw new NotFoundException('Campaign not found');
    }
    if (dto.adAccountId) {
      const account = await this.prisma.adAccount.findUnique({ where: { id: dto.adAccountId } });
      if (!account) throw new NotFoundException('Ad account not found');
    }

    const data: any = {
      userId,
      name: dto.name,
      scope: dto.scope || 'CAMPAIGN',
      logic: dto.logic || 'ALL',
      cooldownMinutes: dto.cooldownMinutes || 60,
      conditions: dto.conditions || [],
      actions: dto.actions || [],
    };
    if (dto.description) data.description = dto.description;
    if (dto.campaignId) data.campaignId = dto.campaignId;
    if (dto.adAccountId) data.adAccountId = dto.adAccountId;

    return this.prisma.rule.create({ data });
  }

  async findAll(userId: string) {
    const rules = await this.prisma.rule.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        campaign: { select: { id: true, name: true, status: true } },
        adAccount: { select: { id: true, name: true } },
        _count: { select: { logs: true } },
      },
    });
    return rules.map(r => this.addCooldownInfo(r));
  }

  async findOne(id: string, userId: string) {
    const rule = await this.prisma.rule.findUnique({
      where: { id },
      include: {
        campaign: { select: { id: true, name: true, status: true } },
        adAccount: { select: { id: true, name: true } },
        logs: { orderBy: { triggeredAt: 'desc' }, take: 20 },
      },
    });
    if (!rule) throw new NotFoundException('Rule not found');
    if (rule.userId !== userId) throw new ForbiddenException('Access denied');
    return this.addCooldownInfo(rule);
  }

  /** Add computed cooldown info to rule response */
  private addCooldownInfo(rule: any) {
    let remainingCooldown = 0;
    if (rule.lastTriggeredAt) {
      const elapsed = Date.now() - new Date(rule.lastTriggeredAt).getTime();
      const total = rule.cooldownMinutes * 60 * 1000;
      remainingCooldown = Math.max(0, Math.ceil((total - elapsed) / 1000));
    }
    return { ...rule, remainingCooldown };
  }

  async update(id: string, userId: string, dto: UpdateRuleDto) {
    await this.findOne(id, userId);
    return this.prisma.rule.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        scope: dto.scope,
        campaignId: dto.campaignId,
        adAccountId: dto.adAccountId,
        conditions: dto.conditions as any,
        logic: dto.logic,
        actions: dto.actions as any,
        cooldownMinutes: dto.cooldownMinutes,
        isEnabled: dto.isEnabled,
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.rule.delete({ where: { id } });
  }

  async toggle(id: string, userId: string) {
    const rule = await this.findOne(id, userId);
    return this.prisma.rule.update({
      where: { id },
      data: { isEnabled: !rule.isEnabled },
    });
  }

  async getLogs(ruleId: string, userId: string) {
    const rule = await this.findOne(ruleId, userId);
    return this.prisma.ruleLog.findMany({
      where: { ruleId },
      orderBy: { triggeredAt: 'desc' },
      take: 100,
    });
  }
}
