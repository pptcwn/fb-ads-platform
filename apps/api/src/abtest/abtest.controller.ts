import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AbtestService } from './abtest.service';

@Controller('abtest')
@UseGuards(AuthGuard('jwt'))
export class AbtestController {
  constructor(private readonly abtestService: AbtestService) {}

  @Post('create')
  async create(@Req() req: any, @Body() body: { sourceCampaignId: string; variants: Array<{ name: string; creativeMessage?: string; dailyBudget?: number }> }) {
    return this.abtestService.create(req.user.id, body);
  }

  @Get('list')
  async list(@Req() req: any) {
    return this.abtestService.list(req.user.id);
  }

  @Get(':id/variants')
  async getVariants(@Param('id') id: string, @Req() req: any) {
    return this.abtestService.getVariants(req.user.id, id);
  }

  @Post(':id/stop')
  async stop(@Param('id') id: string, @Req() req: any) {
    return this.abtestService.stop(req.user.id, id);
  }

  @Post(':id/pause')
  async pause(@Param('id') id: string, @Req() req: any) {
    return this.abtestService.pauseAll(req.user.id, id);
  }

  @Post(':id/resume')
  async resume(@Param('id') id: string, @Req() req: any) {
    return this.abtestService.resumeAll(req.user.id, id);
  }

  @Patch('variants/:variantId')
  async editVariant(@Param('variantId') variantId: string, @Req() req: any, @Body() body: { name?: string; dailyBudget?: number }) {
    return this.abtestService.editVariant(req.user.id, variantId, body);
  }

  @Post('variants/:variantId/toggle')
  async toggleVariant(@Param('variantId') variantId: string, @Req() req: any) {
    return this.abtestService.toggleVariant(req.user.id, variantId);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: any) {
    return this.abtestService.delete(req.user.id, id);
  }

  @Delete('variants/:variantId')
  async deleteVariant(@Param('variantId') variantId: string, @Req() req: any) {
    return this.abtestService.deleteVariant(req.user.id, variantId);
  }
}
