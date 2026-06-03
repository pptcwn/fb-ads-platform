import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req,
  UseInterceptors, UploadedFile, Res, StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';
import { CreativesService } from './creatives.service';

@Controller('creatives')
@UseGuards(AuthGuard('jwt'))
export class CreativesController {
  constructor(private readonly creativesService: CreativesService) {}

  // ─── Static routes FIRST (must be before :id to avoid route clash) ───

  @Post()
  create(@Req() req: any, @Body() body: {
    name: string;
    type?: string;
    primaryText?: string;
    headline?: string;
    description?: string;
    callToAction?: string;
    imageUrl?: string;
    linkUrl?: string;
    pageId?: string;
  }) {
    return this.creativesService.create(req.user.id, body);
  }

  @Get()
  list(@Req() req: any) {
    return this.creativesService.list(req.user.id);
  }

  // ─── Facebook Page Integration (static paths, before :id) ───

  @Get('pages')
  getPages(@Req() req: any) {
    return this.creativesService.getPages(req.user.id);
  }

  @Get('pages/:pageId/posts')
  getPagePosts(@Param('pageId') pageId: string, @Req() req: any) {
    return this.creativesService.getPagePosts(req.user.id, pageId);
  }

  @Post('import/:pageId/:postId')
  importPost(
    @Param('pageId') pageId: string,
    @Param('postId') postId: string,
    @Req() req: any,
    @Body() body?: { message?: string; imageUrl?: string; permalinkUrl?: string },
  ) {
    return this.creativesService.importPost(req.user.id, pageId, postId, body);
  }

  @Get('uploads/:filename')
  getUpload(@Param('filename') filename: string, @Res({ passthrough: true }) res: Response) {
    const filePath = join(process.cwd(), 'uploads', 'creatives', filename);
    if (!existsSync(filePath)) {
      return { error: 'File not found' };
    }
    const stream = createReadStream(filePath);
    res.set({ 'Content-Type': 'image/*' });
    return new StreamableFile(stream);
  }

  // ─── Parametrized routes (after static paths) ───

  @Get(':id')
  getById(@Param('id') id: string, @Req() req: any) {
    return this.creativesService.getById(req.user.id, id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Req() req: any, @Body() body: {
    name?: string;
    type?: string;
    status?: string;
    primaryText?: string;
    headline?: string;
    description?: string;
    callToAction?: string;
    imageUrl?: string;
    linkUrl?: string;
    pageId?: string;
  }) {
    return this.creativesService.update(req.user.id, id, body);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Req() req: any) {
    return this.creativesService.delete(req.user.id, id);
  }

  // ─── Image Upload ───

  @Post(':id/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @Param('id') id: string,
    @Req() req: any,
    @UploadedFile() file: any,
  ) {
    if (!file) {
      return { success: false, error: 'No file uploaded' };
    }
    return this.creativesService.attachImage(req.user.id, id, file);
  }

  // ─── Campaign Linking ───

  @Post(':id/link/:campaignId')
  linkToCampaign(@Param('id') id: string, @Param('campaignId') campaignId: string, @Req() req: any) {
    return this.creativesService.linkToCampaign(req.user.id, id, campaignId);
  }

  @Delete(':id/link/:campaignId')
  unlinkCampaign(@Param('id') id: string, @Param('campaignId') campaignId: string, @Req() req: any) {
    return this.creativesService.unlinkCampaign(req.user.id, id, campaignId);
  }

  @Get(':id/campaigns')
  getLinkedCampaigns(@Param('id') id: string, @Req() req: any) {
    return this.creativesService.getLinkedCampaigns(req.user.id, id);
  }

  // ─── Facebook Integration ───

  @Post(':id/fb-create/:adAccountId')
  createFbCreative(@Param('id') id: string, @Param('adAccountId') adAccountId: string, @Req() req: any) {
    return this.creativesService.createFbCreative(req.user.id, id, adAccountId);
  }

  @Post(':id/fb-post/:pageId')
  postToPage(@Param('id') id: string, @Param('pageId') pageId: string, @Req() req: any) {
    return this.creativesService.postCreativeToPage(req.user.id, id, pageId);
  }

  // ─── Clone ───

  @Post(':id/clone')
  clone(@Param('id') id: string, @Body() body: { name?: string }, @Req() req: any) {
    return this.creativesService.clone(req.user.id, id, body.name);
  }
}
