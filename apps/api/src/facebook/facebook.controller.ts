import { Controller, Get, Post, Query, Req, UseGuards, Redirect, HttpCode, HttpStatus, Res, NotFoundException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FacebookService } from './facebook.service';
import { Response } from 'express';

@Controller('facebook')
export class FacebookController {
  constructor(private readonly facebookService: FacebookService) {}

  @Get('auth')
  @UseGuards(AuthGuard('jwt'))
  async getAuthUrl(@Req() req: any): Promise<{ url: string }> {
    const url = await this.facebookService.getAuthUrlWithState(req.user.id);
    return { url };
  }

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const frontendUrl = process.env.FB_REDIRECT_URI?.replace('/api/facebook/callback', '') || '/';
    if (!code || !state) {
      return res.redirect(`${frontendUrl}/dashboard?fb=error&reason=missing_params`);
    }
    try {
      const userId = this.facebookService.decryptState(state);
      await this.facebookService.handleCallback(userId, code);
      return res.redirect(`${frontendUrl}/dashboard?fb=success`);
    } catch (err: any) {
      return res.redirect(`${frontendUrl}/dashboard?fb=error&reason=${encodeURIComponent(err.message)}`);
    }
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getProfile(@Req() req: any) {
    const userId = req.user.id;
    const account = await this.facebookService.getFbAccount(userId);
    return {
      connected: !!account,
      data: account,
    };
  }

  @Post('sync-pages')
  @UseGuards(AuthGuard('jwt'))
  async syncPages(@Req() req: any) {
    const fbUser = await this.facebookService.getFbAccount(req.user.id);
    if (!fbUser?.id) throw new NotFoundException('Facebook not connected');
    const token = await this.facebookService.getDecryptedToken(fbUser.id);
    return this.facebookService.listAndStorePages(fbUser.id, token);
  }

  @Post('disconnect')
  @UseGuards(AuthGuard('jwt'))
  async disconnect(@Req() req: any) {
    return this.facebookService.disconnectFb(req.user.id);
  }
}
