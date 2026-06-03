import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TemplatesService } from './templates.service';

@Controller('templates')
@UseGuards(AuthGuard('jwt'))
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  async findAll(@Req() req: any) {
    return this.templatesService.findAll(req.user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.templatesService.findOne(id, req.user.id);
  }

  @Post()
  async create(@Body() dto: any, @Req() req: any) {
    return this.templatesService.create(req.user.id, dto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: any, @Req() req: any) {
    return this.templatesService.update(id, req.user.id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.templatesService.remove(id, req.user.id);
  }

  @Post(':id/apply')
  async apply(@Param('id') id: string, @Req() req: any) {
    return this.templatesService.apply(id, req.user.id);
  }
}
