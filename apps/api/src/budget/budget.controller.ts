import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req, Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BudgetService } from './budget.service';

@Controller('budget-schedules')
@UseGuards(AuthGuard('jwt'))
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  @Post()
  async create(
    @Req() req: any,
    @Body() body: {
      name: string;
      campaignId?: string;
      adAccountId?: string;
      action: string;
      value?: number;
      cronExpr: string;
      timezone?: string;
    },
  ) {
    return this.budgetService.create(req.user.id, body);
  }

  @Get()
  async list(@Req() req: any) {
    return this.budgetService.list(req.user.id);
  }

  @Get(':id')
  async getById(@Param('id') id: string, @Req() req: any) {
    return this.budgetService.getById(req.user.id, id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body: {
      name?: string;
      campaignId?: string;
      adAccountId?: string;
      action?: string;
      value?: number;
      cronExpr?: string;
      timezone?: string;
      isEnabled?: boolean;
    },
  ) {
    return this.budgetService.update(req.user.id, id, body);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: any) {
    return this.budgetService.delete(req.user.id, id);
  }

  @Post(':id/toggle')
  async toggle(@Param('id') id: string, @Req() req: any) {
    return this.budgetService.toggle(req.user.id, id);
  }
}
