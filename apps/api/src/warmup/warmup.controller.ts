import { Controller, Get, Post, Param, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WarmupService } from './warmup.service';

@Controller('warmup')
@UseGuards(AuthGuard('jwt'))
export class WarmupController {
  constructor(private readonly warmupService: WarmupService) {}

  /** Start warmup for an ad account */
  @Post('start/:id')
  async start(@Param('id') id: string, @Req() req: any, @Body() body: { targetDailyBudget: number }) {
    return this.warmupService.start(id, req.user.id, body.targetDailyBudget);
  }

  /** Stop warmup */
  @Post('stop/:id')
  async stop(@Param('id') id: string, @Req() req: any) {
    return this.warmupService.stop(id, req.user.id);
  }

  /** Skip to a specific day */
  @Post('skip/:id')
  async skip(@Param('id') id: string, @Req() req: any, @Body() body: { day: number }) {
    return this.warmupService.skipTo(id, req.user.id, body.day);
  }

  /** Get warmup status for all warming accounts */
  @Get('status')
  async status(@Req() req: any) {
    return this.warmupService.getStatus(req.user.id);
  }

  /** Manual tick (advance all warming accounts by one day) */
  @Post('tick')
  async tick(@Req() req: any) {
    return this.warmupService.manualTick(req.user.id);
  }
}
