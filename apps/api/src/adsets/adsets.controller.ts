import { Controller, Get, Post, Patch, Param, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdsetsService } from './adsets.service';

@Controller('adsets')
@UseGuards(AuthGuard('jwt'))
export class AdsetsController {
  constructor(private readonly adsetsService: AdsetsService) {}

  @Get('campaign/:campaignId')
  async getCampaignAdsets(@Param('campaignId') campaignId: string, @Req() req: any) {
    return this.adsetsService.getCampaignAdsets(req.user.id, campaignId);
  }

  @Get(':id')
  async getAdset(@Param('id') id: string, @Req() req: any) {
    return this.adsetsService.getAdsetById(req.user.id, id);
  }

  @Post(':id/pause')
  async pauseAdset(@Param('id') id: string, @Req() req: any) {
    return this.adsetsService.updateAdsetStatus(req.user.id, id, 'PAUSED');
  }

  @Post(':id/resume')
  async resumeAdset(@Param('id') id: string, @Req() req: any) {
    return this.adsetsService.updateAdsetStatus(req.user.id, id, 'ACTIVE');
  }

  @Patch(':id/budget')
  async updateAdsetBudget(
    @Param('id') id: string,
    @Body() body: { dailyBudget: number },
    @Req() req: any,
  ) {
    return this.adsetsService.updateAdsetBudget(req.user.id, id, body.dailyBudget);
  }
}
