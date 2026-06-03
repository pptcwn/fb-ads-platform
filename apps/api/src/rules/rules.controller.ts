import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RulesService } from './rules.service';
import { CreateRuleDto } from './dto/create-rule.dto';
import { UpdateRuleDto } from './dto/update-rule.dto';

@Controller('rules')
@UseGuards(AuthGuard('jwt'))
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  @Post()
  async create(@Body() dto: CreateRuleDto, @Req() req: any) {
    return this.rulesService.create(req.user.id, dto);
  }

  @Get()
  async findAll(@Req() req: any) {
    return this.rulesService.findAll(req.user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.rulesService.findOne(id, req.user.id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateRuleDto, @Req() req: any) {
    return this.rulesService.update(id, req.user.id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.rulesService.remove(id, req.user.id);
  }

  @Post(':id/toggle')
  async toggle(@Param('id') id: string, @Req() req: any) {
    return this.rulesService.toggle(id, req.user.id);
  }

  @Get(':id/logs')
  async getLogs(@Param('id') id: string, @Req() req: any) {
    return this.rulesService.getLogs(id, req.user.id);
  }
}
