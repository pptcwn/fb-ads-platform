import { Controller, Post, Get, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SyncService } from './sync.service';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('trigger')
  @UseGuards(AuthGuard('jwt'))
  async triggerSync(@Req() req: any) {
    const result = await this.syncService.syncAll(req.user.id);
    return {
      message: 'Sync completed',
      ...result,
    };
  }

  @Get('status')
  @UseGuards(AuthGuard('jwt'))
  async getStatus(@Req() req: any) {
    return this.syncService.getSyncStats(req.user.id);
  }
}
