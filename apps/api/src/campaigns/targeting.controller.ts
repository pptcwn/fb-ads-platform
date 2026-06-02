// apps/api/src/campaigns/targeting.controller.ts
import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FacebookService } from '../facebook/facebook.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('targeting')
@UseGuards(AuthGuard('jwt'))
export class TargetingController {
  constructor(
    private readonly facebookService: FacebookService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('interests')
  async searchInterests(@Query('q') query: string, @Req() req: any) {
    if (!query || query.length < 2) return [];
    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId: req.user.id } });
    if (!fbUser) return [];
    const token = await this.facebookService.getDecryptedToken(fbUser.id);
    return this.facebookService.searchTargetingInterests(query, token);
  }

  @Get('locations')
  async searchLocations(
    @Query('q') query: string,
    @Query('types') types: string,
    @Req() req: any,
  ) {
    if (!query || query.length < 2) return [];
    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId: req.user.id } });
    if (!fbUser) return [];
    const token = await this.facebookService.getDecryptedToken(fbUser.id);
    const locationTypes = types ? types.split(',') : ['country', 'region', 'city'];
    return this.facebookService.searchTargetingLocations(query, token, locationTypes);
  }

  @Get('demographics')
  async searchDemographics(@Query('q') query: string, @Req() req: any) {
    if (!query || query.length < 2) return [];
    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId: req.user.id } });
    if (!fbUser) return [];
    const token = await this.facebookService.getDecryptedToken(fbUser.id);
    return this.facebookService.searchTargetingDemographics(query, token);
  }

  @Get('estimate')
  async estimateAudience(
    @Query('targeting') targetingJson: string,
    @Query('adAccountId') adAccountId: string,
    @Req() req: any,
  ) {
    if (!targetingJson) return { dailyUniqueReach: 0, monthlyUniqueReach: 0 };
    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId: req.user.id } });
    if (!fbUser) return { dailyUniqueReach: 0, monthlyUniqueReach: 0 };
    const token = await this.facebookService.getDecryptedToken(fbUser.id);
    const targeting = JSON.parse(targetingJson);
    const account = await this.prisma.adAccount.findFirst({
      where: { id: adAccountId, fbUser: { userId: req.user.id } },
    });
    const fbAccountId = account ? account.accountId.replace('act_', '') : '';
    return this.facebookService.estimateAudienceSize(targeting, token, fbAccountId);
  }
}
