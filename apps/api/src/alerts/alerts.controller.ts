import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req, Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AlertsService } from './alerts.service';
import { TelegramService } from './telegram.service';

@Controller('alerts')
@UseGuards(AuthGuard('jwt'))
export class AlertsController {
  constructor(
    private readonly alertsService: AlertsService,
    private readonly telegramService: TelegramService,
  ) {}

  // ─── Configs ───

  @Post('configs')
  createConfig(@Req() req: any, @Body() body: {
    name: string;
    metric: string;
    condition?: string;
    threshold?: number;
    unit?: string;
    campaignId?: string;
    adAccountId?: string;
    notifyTelegram?: boolean;
  }) {
    return this.alertsService.createConfig(req.user.id, body);
  }

  @Get('configs')
  listConfigs(@Req() req: any) {
    return this.alertsService.listConfigs(req.user.id);
  }

  @Get('configs/:id')
  getConfig(@Param('id') id: string, @Req() req: any) {
    return this.alertsService.getConfig(req.user.id, id);
  }

  @Patch('configs/:id')
  updateConfig(@Param('id') id: string, @Req() req: any, @Body() body: {
    name?: string;
    metric?: string;
    condition?: string;
    threshold?: number;
    unit?: string;
    campaignId?: string;
    adAccountId?: string;
    enabled?: boolean;
    notifyTelegram?: boolean;
  }) {
    return this.alertsService.updateConfig(req.user.id, id, body);
  }

  @Post('configs/:id/toggle')
  toggleConfig(@Param('id') id: string, @Req() req: any) {
    return this.alertsService.toggleConfig(req.user.id, id);
  }

  @Delete('configs/:id')
  deleteConfig(@Param('id') id: string, @Req() req: any) {
    return this.alertsService.deleteConfig(req.user.id, id);
  }

  // ─── History ───

  @Get('history')
  listAlerts(
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('unread') unread?: string,
  ) {
    return this.alertsService.listAlerts(
      req.user.id,
      limit ? parseInt(limit) : 50,
      unread === 'true',
    );
  }

  @Post('history/read')
  markRead(@Req() req: any, @Body() body?: { id?: string }) {
    return this.alertsService.markRead(req.user.id, body?.id);
  }

  @Delete('history/:id')
  deleteAlert(@Param('id') id: string, @Req() req: any) {
    return this.alertsService.deleteAlert(req.user.id, id);
  }

  // ─── Init defaults ───

  @Post('init-defaults')
  initDefaults(@Req() req: any) {
    return this.alertsService.ensureDefaultConfigs(req.user.id);
  }

  // ─── Telegram Settings ───

  @Get('telegram')
  async getTelegramSettings(@Req() req: any) {
    const settings = await this.alertsService.getTelegramSettings(req.user.id);
    return settings;
  }

  @Post('telegram')
  async saveTelegramSettings(@Req() req: any, @Body() body: { botToken: string; chatId: string }) {
    if (!body.botToken || !body.chatId) {
      return { success: false, error: 'Bot Token and Chat ID are required' };
    }
    return this.alertsService.saveTelegramSettings(req.user.id, body.botToken, body.chatId);
  }

  @Post('telegram/test')
  async testTelegram(@Req() req: any) {
    return this.alertsService.testTelegram(req.user.id, this.telegramService);
  }

  @Delete('telegram')
  async disconnectTelegram(@Req() req: any) {
    return this.alertsService.disconnectTelegram(req.user.id);
  }
}
