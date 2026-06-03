import { Controller, Get, Post, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApprovalsService } from './approvals.service';

@Controller('approvals')
@UseGuards(AuthGuard('jwt'))
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Get()
  list(@Req() req: any, @Query('status') status?: string) {
    return this.approvalsService.list(req.user.id, status || 'PENDING');
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @Req() req: any) {
    return this.approvalsService.approve(req.user.id, id);
  }

  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() body: { note?: string },
    @Req() req: any,
  ) {
    return this.approvalsService.reject(req.user.id, id, body?.note);
  }
}