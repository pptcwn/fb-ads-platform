import { Controller, Get, Post, Param, Query, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InsightsService } from './insights.service';

@Controller('insights')
@UseGuards(AuthGuard('jwt'))
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Post('sync')
  async syncAll(@Req() req: any) {
    return this.insightsService.syncInsights(req.user.id);
  }

  @Post('sync/:adAccountId')
  async syncOne(@Param('adAccountId') adAccountId: string, @Req() req: any) {
    return this.insightsService.syncInsights(req.user.id, adAccountId);
  }

  @Get('accounts/:adAccountId')
  async getAccountInsights(
    @Param('adAccountId') adAccountId: string,
    @Query('days') days: string,
    @Req() req: any,
  ) {
    return this.insightsService.getAccountInsights(adAccountId, req.user.id, parseInt(days) || 30);
  }

  @Get('accounts/:adAccountId/campaigns/:campaignId')
  async getCampaignInsights(
    @Param('adAccountId') adAccountId: string,
    @Param('campaignId') campaignId: string,
    @Query('days') days: string,
    @Req() req: any,
  ) {
    return this.insightsService.getCampaignInsights(adAccountId, campaignId, req.user.id, parseInt(days) || 30);
  }

  @Get('summary')
  async getSummary(@Req() req: any) {
    return this.insightsService.getDashboardSummary(req.user.id);
  }
}
