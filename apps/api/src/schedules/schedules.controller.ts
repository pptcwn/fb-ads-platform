import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req, NotFoundException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SchedulesService } from './schedules.service';

@Controller('schedules')
@UseGuards(AuthGuard('jwt'))
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get()
  async list(@Req() req: any) {
    return this.schedulesService.list(req.user.id);
  }

  @Get(':id')
  async get(@Param('id') id: string, @Req() req: any) {
    return this.schedulesService.get(req.user.id, id);
  }

  @Post()
  async create(@Body() body: any, @Req() req: any) {
    return this.schedulesService.create(req.user.id, body);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.schedulesService.update(req.user.id, id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.schedulesService.remove(req.user.id, id);
  }

  @Post(':id/toggle')
  async toggle(@Param('id') id: string, @Req() req: any) {
    return this.schedulesService.toggle(req.user.id, id);
  }

  @Post(':id/run-now')
  async runNow(@Param('id') id: string, @Req() req: any) {
    return this.schedulesService.runNow(req.user.id, id);
  }
}
