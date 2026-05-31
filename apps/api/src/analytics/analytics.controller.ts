import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(AuthGuard('jwt'))
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  async getOverview(@Req() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    return this.analyticsService.getOverview(req.user.id, from, to);
  }

  @Get('trends')
  async getTrends(
    @Req() req: any,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('granularity') granularity?: string,
    @Query('accountId') accountId?: string,
  ) {
    return this.analyticsService.getTrends(req.user.id, from, to, granularity, accountId);
  }

  @Get('campaigns')
  async getCampaignRanking(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('sort') sort?: string,
    @Query('limit') limit?: string,
  ) {
    return this.analyticsService.getCampaignRanking(req.user.id, from, to, sort, limit ? parseInt(limit) : 20);
  }

  @Get('comparison')
  async getComparison(
    @Req() req: any,
    @Query('period') period?: string,
  ) {
    return this.analyticsService.getPeriodComparison(req.user.id, period);
  }

  @Get('accounts')
  async getAccountSummary(@Req() req: any) {
    return this.analyticsService.getAccountSummary(req.user.id);
  }
}
