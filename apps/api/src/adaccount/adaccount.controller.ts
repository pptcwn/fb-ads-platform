import { Controller, Get, Param, UseGuards, Req, NotFoundException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';

@Controller('adaccounts')
@UseGuards(AuthGuard('jwt'))
export class AdAccountController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async listAccounts(@Req() req: any) {
    const accounts = await this.prisma.adAccount.findMany({
      where: { fbUser: { userId: req.user.id } },
      select: {
        id: true,
        accountId: true,
        name: true,
        currency: true,
        timezone: true,
        status: true,
        balance: true,
        spentToday: true,
        spendCap: true,
        isWarmingUp: true,
        warmupDay: true,
        createdAt: true,
        _count: { select: { campaigns: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return accounts;
  }

  @Get(':id')
  async getAccount(@Param('id') id: string, @Req() req: any) {
    const account = await this.prisma.adAccount.findFirst({
      where: { id, fbUser: { userId: req.user.id } },
      include: {
        _count: { select: { campaigns: true } },
      },
    });
    if (!account) throw new NotFoundException('Ad account not found');
    return account;
  }

  @Get(':id/campaigns')
  async listCampaigns(@Param('id') id: string, @Req() req: any) {
    const account = await this.prisma.adAccount.findFirst({
      where: { id, fbUser: { userId: req.user.id } },
    });
    if (!account) throw new NotFoundException('Ad account not found');

    const campaigns = await this.prisma.campaign.findMany({
      where: { adAccountId: account.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return campaigns;
  }

  @Get(':id/campaigns/:campaignId')
  async getCampaign(@Param('id') id: string, @Param('campaignId') campaignId: string, @Req() req: any) {
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        campaignId,
        adAccount: { id, fbUser: { userId: req.user.id } },
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }
}
