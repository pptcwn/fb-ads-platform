import { Controller, Post, Get, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

@Controller('campaigns')
@UseGuards(AuthGuard('jwt'))
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  async create(@Body() dto: CreateCampaignDto, @Req() req: any) {
    return this.campaignsService.create(req.user.id, dto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateCampaignDto, @Req() req: any) {
    return this.campaignsService.update(id, req.user.id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.campaignsService.remove(id, req.user.id);
  }

  @Get('accounts')
  async getAdAccounts(@Req() req: any) {
    return this.campaignsService.getAdAccounts(req.user.id);
  }

  @Get('accounts/:adAccountId')
  async getCampaigns(@Param('adAccountId') adAccountId: string, @Req() req: any) {
    return this.campaignsService.getCampaigns(adAccountId, req.user.id);
  }

  // ─── Bulk Operations ───

  @Post('bulk/pause')
  async bulkPause(@Body() body: { ids: string[] }, @Req() req: any) {
    return this.campaignsService.bulkUpdateStatus(body.ids, req.user.id, 'PAUSED');
  }

  @Post('bulk/resume')
  async bulkResume(@Body() body: { ids: string[] }, @Req() req: any) {
    return this.campaignsService.bulkUpdateStatus(body.ids, req.user.id, 'ACTIVE');
  }

  @Post('bulk/delete')
  async bulkDelete(@Body() body: { ids: string[] }, @Req() req: any) {
    return this.campaignsService.bulkRemove(body.ids, req.user.id);
  }

  // ─── Clone ───

  @Post(':id/clone')
  async clone(@Param('id') id: string, @Body() body: { name?: string }, @Req() req: any) {
    return this.campaignsService.clone(id, req.user.id, body.name);
  }
}
