import { Controller, Get, Param, Query, Req, UseGuards, NotFoundException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';
import { AdAccountService } from './adaccount.service';

@Controller('adaccounts')
@UseGuards(AuthGuard('jwt'))
export class AdAccountController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adAccountService: AdAccountService,
  ) {}

  @Get()
  async listAccounts(
    @Req() req: any,
    @Query('usableOnly') usableOnly?: string,
  ) {
    return this.adAccountService.listForUser(req.user.id, {
      usableOnly: usableOnly === 'true' || usableOnly === '1',
    });
  }

  @Get(':id')
  async getAccount(@Param('id') id: string, @Req() req: any) {
    const accounts = await this.adAccountService.listForUser(req.user.id);
    const account = accounts.find((a) => a.id === id);
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
      where: {
        adAccountId: account.id,
        status: { notIn: ['DELETED', 'ARCHIVED'] },
      },
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