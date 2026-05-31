import { Controller, Get, Post, Delete, Body, Param, UseGuards, Req, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { AudiencesService } from './audiences.service';

@Controller('audiences')
@UseGuards(AuthGuard('jwt'))
export class AudiencesController {
  constructor(private readonly audiencesService: AudiencesService) {}

  @Get()
  async list(@Req() req: any) {
    return this.audiencesService.list(req.user.id);
  }

  @Get('sync/:adAccountId')
  async sync(@Param('adAccountId') adAccountId: string, @Req() req: any) {
    return this.audiencesService.syncFromFacebook(req.user.id, adAccountId);
  }

  @Post('create-custom')
  async createCustom(@Body() body: { adAccountId: string; name: string; description?: string; subtype?: string; }, @Req() req: any) {
    return this.audiencesService.createCustomAudience(req.user.id, body);
  }

  @Post('create-lookalike')
  async createLookalike(
    @Body() body: { adAccountId: string; name: string; sourceAudienceId: string; ratio?: number },
    @Req() req: any,
  ) {
    return this.audiencesService.createLookalike(req.user.id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.audiencesService.remove(req.user.id, id);
  }

  @Post(':id/upload-users')
  @UseInterceptors(FileInterceptor('file'))
  async uploadUsers(
    @Param('id') id: string,
    @UploadedFile() file: any,
    @Body() body: { schema?: string },
    @Req() req: any,
  ) {
    if (!file) throw new BadRequestException('CSV file is required');
    const schemaMapping = body.schema ? JSON.parse(body.schema) : null;
    return this.audiencesService.uploadUsers(req.user.id, id, file, schemaMapping);
  }
}
