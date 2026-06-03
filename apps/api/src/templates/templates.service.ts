import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.campaignTemplate.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const tpl = await this.prisma.campaignTemplate.findFirst({
      where: { id, userId },
    });
    if (!tpl) throw new NotFoundException('Template not found');
    return tpl;
  }

  async create(userId: string, dto: CreateTemplateDto) {
    return this.prisma.campaignTemplate.create({
      data: {
        userId,
        name: dto.name,
        notes: dto.notes || null,
        objective: dto.objective || 'OUTCOME_TRAFFIC',
        dailyBudget: dto.dailyBudget || null,
        targetSpec: dto.targetSpec || null,
        adSetName: dto.adSetName || null,
        optimizationGoal: dto.optimizationGoal || null,
        billingEvent: dto.billingEvent || null,
        adName: dto.adName || null,
        creativeConfig: dto.creativeConfig || null,
      },
    });
  }

  async update(id: string, userId: string, dto: Partial<CreateTemplateDto>) {
    const tpl = await this.findOne(id, userId);
    return this.prisma.campaignTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.objective !== undefined && { objective: dto.objective }),
        ...(dto.dailyBudget !== undefined && { dailyBudget: dto.dailyBudget }),
        ...(dto.targetSpec !== undefined && { targetSpec: dto.targetSpec }),
        ...(dto.adSetName !== undefined && { adSetName: dto.adSetName }),
        ...(dto.optimizationGoal !== undefined && { optimizationGoal: dto.optimizationGoal }),
        ...(dto.billingEvent !== undefined && { billingEvent: dto.billingEvent }),
        ...(dto.adName !== undefined && { adName: dto.adName }),
        ...(dto.creativeConfig !== undefined && { creativeConfig: dto.creativeConfig }),
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.campaignTemplate.delete({ where: { id } });
  }

  async apply(id: string, userId: string) {
    // Increment use count
    const tpl = await this.prisma.campaignTemplate.update({
      where: { id },
      data: {
        useCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
    return tpl;
  }
}

interface CreateTemplateDto {
  name: string;
  notes?: string;
  objective?: string;
  dailyBudget?: number;
  targetSpec?: any;
  adSetName?: string;
  optimizationGoal?: string;
  billingEvent?: string;
  adName?: string;
  creativeConfig?: any;
}
