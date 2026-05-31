import { Injectable, InternalServerErrorException, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { encryptToken, decryptToken } from '../common/encryption.util';
import { AxiosResponse } from 'axios';

interface FacebookTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface FacebookUserResponse {
  id: string;
  name: string;
  email?: string;
}

@Injectable()
export class FacebookService {
  private readonly logger = new Logger(FacebookService.name);
  private readonly baseUrl = 'https://graph.facebook.com/v20.0';

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
  ) {}

  getAuthUrl(): string {
    throw new InternalServerErrorException('Use getAuthUrlWithState() instead');
  }

  async getAuthUrlWithState(userId: string): Promise<string> {
    const appId = process.env.FB_APP_ID;
    const redirectUri = process.env.FB_REDIRECT_URI;
    if (!appId || !redirectUri) {
      throw new InternalServerErrorException('Facebook App not configured');
    }
    const state = encryptToken(userId);
    const params = new URLSearchParams({
      client_id: appId!,
      redirect_uri: redirectUri!,
      scope: 'ads_management,ads_read,business_management,pages_show_list,pages_read_engagement',
      response_type: 'code',
      state,
    });
    return `https://www.facebook.com/v20.0/dialog/oauth?${params}`;
  }

  decryptState(state: string): string {
    try {
      return decryptToken(state);
    } catch {
      throw new UnauthorizedException('Invalid state parameter');
    }
  }

  async exchangeCode(code: string): Promise<FacebookTokenResponse> {
    const appId = process.env.FB_APP_ID!;
    const appSecret = process.env.FB_APP_SECRET!;
    const redirectUri = process.env.FB_REDIRECT_URI!;

    const params = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    });

    try {
      const response = await firstValueFrom(
        this.http.post<FacebookTokenResponse>(`${this.baseUrl}/oauth/access_token`, params.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );
      return response.data;
    } catch (err: any) {
      this.logger.error('Failed to exchange FB code', err?.response?.data || err.message);
      throw new UnauthorizedException('Invalid or expired Facebook authorization code');
    }
  }

  async getLongLivedToken(shortLivedToken: string): Promise<FacebookTokenResponse> {
    const appId = process.env.FB_APP_ID!;
    const appSecret = process.env.FB_APP_SECRET!;

    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortLivedToken,
    });

    try {
      const response = await firstValueFrom(
        this.http.post<FacebookTokenResponse>(`${this.baseUrl}/oauth/access_token`, params.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );
      return response.data;
    } catch (err: any) {
      this.logger.error('Failed to exchange for long-lived token', err?.response?.data || err.message);
      throw new InternalServerErrorException('Failed to obtain long-lived token');
    }
  }

  async getUserInfo(accessToken: string): Promise<FacebookUserResponse> {
    try {
      const response = await firstValueFrom(
        this.http.get<FacebookUserResponse>(`${this.baseUrl}/me`, {
          params: { fields: 'id,name,email', access_token: accessToken },
        }),
      );
      return response.data;
    } catch (err: any) {
      this.logger.error('Failed to get FB user info', err?.response?.data || err.message);
      throw new InternalServerErrorException('Failed to fetch Facebook user info');
    }
  }

  async storeFbUser(userId: string, fbUser: FacebookUserResponse, accessToken: string, expiresIn: number) {
    const encryptedToken = encryptToken(accessToken);
    const expiresInSec = expiresIn || 5184000; // default 60 days if missing
    const expiresAt = new Date(Date.now() + expiresInSec * 1000);

    return this.prisma.fbUser.upsert({
      where: { facebookUserId: fbUser.id },
      create: {
        userId,
        facebookUserId: fbUser.id,
        facebookName: fbUser.name,
        facebookEmail: fbUser.email,
        accessToken: encryptedToken,
        tokenExpiresAt: expiresAt,
      },
      update: {
        userId,
        facebookName: fbUser.name,
        facebookEmail: fbUser.email,
        accessToken: encryptedToken,
        tokenExpiresAt: expiresAt,
      },
    });
  }

  async handleCallback(userId: string, code: string) {
    // 1. Exchange code for short-lived token
    const tokenResponse = await this.exchangeCode(code);

    // 2. Exchange for long-lived token (60 days)
    const longLived = await this.getLongLivedToken(tokenResponse.access_token);

    // 3. Get FB user info
    const fbUserInfo = await this.getUserInfo(longLived.access_token);

    // 4. Store encrypted token
    const stored = await this.storeFbUser(userId, fbUserInfo, longLived.access_token, longLived.expires_in);

    return {
      id: stored.id,
      facebookUserId: stored.facebookUserId,
      facebookName: stored.facebookName,
      facebookEmail: stored.facebookEmail,
      tokenExpiresAt: stored.tokenExpiresAt,
    };
  }

  async disconnectFb(userId: string) {
    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId } });
    if (!fbUser) return { message: 'Already disconnected' };

    // Delete in order to respect FK constraints
    const adAccounts = await this.prisma.adAccount.findMany({ where: { fbUserId: fbUser.id } });
    const adAccountIds = adAccounts.map(a => a.id);

    for (const accountId of adAccountIds) {
      const campaigns = await this.prisma.campaign.findMany({ where: { adAccountId: accountId } });
      for (const camp of campaigns) {
        await this.prisma.creativeCampaign.deleteMany({ where: { campaignId: camp.id } });
        await this.prisma.campaignInsight.deleteMany({ where: { campaignId: camp.id } });
        await this.prisma.abTest.deleteMany({ where: { sourceCampaignId: camp.id } });
        await this.prisma.abTestVariant.deleteMany({ where: { campaignId: camp.campaignId } });
        const adsets = await this.prisma.adSet.findMany({ where: { campaignId: camp.id } });
        for (const adset of adsets) {
          await this.prisma.ad.deleteMany({ where: { adsetId: adset.id } });
        }
        await this.prisma.adSet.deleteMany({ where: { campaignId: camp.id } });
        await this.prisma.rule.deleteMany({ where: { campaignId: camp.id } });
        await this.prisma.ruleLog.deleteMany({ where: { rule: { campaignId: camp.id } } });
      }
      await this.prisma.campaign.deleteMany({ where: { adAccountId: accountId } });
      await this.prisma.accountInsight.deleteMany({ where: { adAccountId: accountId } });
      await this.prisma.rule.deleteMany({ where: { adAccountId: accountId } });
    }
    await this.prisma.ruleLog.deleteMany({ where: { rule: { adAccountId: { in: adAccountIds } } } });

    // Delete FB pages
    await this.prisma.fbPage.deleteMany({ where: { fbUserId: fbUser.id } });

    // Delete ad accounts
    await this.prisma.adAccount.deleteMany({ where: { fbUserId: fbUser.id } });

    // Delete FB user (cascades: alert configs, budget schedules, creatives linked by userId)
    await this.prisma.alertHistory.deleteMany({ where: { userId } });
    await this.prisma.alertConfig.deleteMany({ where: { userId } });
    await this.prisma.budgetSchedule.deleteMany({ where: { userId } });
    await this.prisma.creative.deleteMany({ where: { userId } });
    await this.prisma.fbUser.delete({ where: { id: fbUser.id } });

    return { message: 'Facebook disconnected successfully. Reconnect to re-sync.' };
  }

  async getFbAccount(userId: string) {
    return this.prisma.fbUser.findFirst({
      where: { userId },
      select: {
        id: true,
        facebookUserId: true,
        facebookName: true,
        facebookEmail: true,
        tokenExpiresAt: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async getDecryptedToken(fbUserId: string): Promise<string> {
    const fbUser = await this.prisma.fbUser.findUnique({
      where: { id: fbUserId },
    });
    if (!fbUser) throw new UnauthorizedException('Facebook account not found');
    return decryptToken(fbUser.accessToken);
  }

  async updateCampaignStatus(accountId: string, campaignId: string, status: string, accessToken: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.baseUrl}/${campaignId}`, null, {
          params: { status, access_token: accessToken },
        }),
      );
    } catch (err: any) {
      this.logger.error(`Failed to update campaign ${campaignId} status`, err?.response?.data || err.message);
      throw new InternalServerErrorException('Failed to update campaign status on Facebook');
    }
  }

  async updateCampaignBudget(campaignId: string, dailyBudget: number, accessToken: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.baseUrl}/${campaignId}`, null, {
          params: {
            daily_budget: Math.round(dailyBudget * 100), // FB expects cents
            access_token: accessToken,
          },
        }),
      );
    } catch (err: any) {
      this.logger.error(`Failed to update campaign ${campaignId} budget`, err?.response?.data || err.message);
      throw new InternalServerErrorException('Failed to update campaign budget on Facebook');
    }
  }

  // ─── Ad Set API ───

  async updateAdsetStatus(adsetId: string, status: string, accessToken: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.baseUrl}/${adsetId}`, null, {
          params: { status, access_token: accessToken },
        }),
      );
    } catch (err: any) {
      this.logger.error(`Failed to update ad set ${adsetId} status`, err?.response?.data || err.message);
      throw new InternalServerErrorException(`Failed to update ad set status on Facebook: ${err?.response?.data?.error?.message || err.message}`);
    }
  }

  async updateAdsetBudget(adsetId: string, dailyBudget: number, accessToken: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.baseUrl}/${adsetId}`, null, {
          params: {
            daily_budget: Math.round(dailyBudget * 100),
            access_token: accessToken,
          },
        }),
      );
    } catch (err: any) {
      this.logger.error(`Failed to update ad set ${adsetId} budget`, err?.response?.data || err.message);
      throw new InternalServerErrorException(`Failed to update ad set budget on Facebook: ${err?.response?.data?.error?.message || err.message}`);
    }
  }

  // ─── Campaign CRUD ───

  async createCampaign(
    adAccountId: string,
    name: string,
    objective: string,
    status: string,
    dailyBudget: number,
    accessToken: string,
  ): Promise<{ id: string }> {
    try {
      const params = new URLSearchParams({
        name,
        objective,
        status,
        daily_budget: String(Math.round(dailyBudget * 100)),
        access_token: accessToken,
        special_ad_categories: 'NONE',
      });
      const { data } = await firstValueFrom(
        this.http.post<{ id: string }>(`${this.baseUrl}/act_${adAccountId}/campaigns`, params.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );
      return data;
    } catch (err: any) {
      this.logger.error('Failed to create campaign', err?.response?.data || err.message);
      throw new InternalServerErrorException('Failed to create campaign on Facebook');
    }
  }

  async createAdSet(
    adAccountId: string,
    campaignId: string,
    name: string,
    dailyBudget: number,
    optimizationGoal: string,
    billingEvent: string,
    bidAmount: number | null,
    targeting: any,
    status: string,
    accessToken: string,
    bidStrategy?: string,
  ): Promise<{ id: string }> {
    try {
      const params: any = {
        name,
        campaign_id: campaignId,
        daily_budget: Math.round(dailyBudget * 100),
        optimization_goal: optimizationGoal,
        billing_event: billingEvent,
        targeting,
        status,
        access_token: accessToken,
      };
      if (bidAmount) params.bid_amount = Math.round(bidAmount * 100);
      if (bidStrategy) params.bid_strategy = bidStrategy;
      const { data } = await firstValueFrom(
        this.http.post<{ id: string }>(`${this.baseUrl}/act_${adAccountId}/adsets`, params, {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      return data;
    } catch (err: any) {
      this.logger.error('Failed to create ad set', err?.response?.data || err.message);
      throw new InternalServerErrorException('Failed to create ad set on Facebook');
    }
  }

  async createCreative(
    adAccountId: string,
    pageId: string | null,
    imageHash: string | null,
    link: string,
    message: string,
    name: string,
    accessToken: string,
  ): Promise<{ id: string }> {
    try {
      const params: any = {
        name,
        object_story_spec: {
          page_id: pageId || '',
          link_data: {
            link,
            message,
            image_hash: imageHash || undefined,
            call_to_action: { type: 'SIGN_UP' },
          },
        },
        access_token: accessToken,
      };
      const { data } = await firstValueFrom(
        this.http.post<{ id: string }>(`${this.baseUrl}/act_${adAccountId}/creatives`, params, {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      return data;
    } catch (err: any) {
      this.logger.error('Failed to create creative', err?.response?.data || err.message);
      throw new InternalServerErrorException('Failed to create creative on Facebook');
    }
  }

  async createAd(
    adAccountId: string,
    adSetId: string,
    creativeId: string,
    name: string,
    status: string,
    accessToken: string,
  ): Promise<{ id: string }> {
    try {
      const params = new URLSearchParams({
        name,
        adset_id: adSetId,
        creative: JSON.stringify({ creative_id: creativeId }),
        status,
        access_token: accessToken,
      });
      const { data } = await firstValueFrom(
        this.http.post<{ id: string }>(`${this.baseUrl}/act_${adAccountId}/ads`, params.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );
      return data;
    } catch (err: any) {
      this.logger.error('Failed to create ad', err?.response?.data || err.message);
      throw new InternalServerErrorException('Failed to create ad on Facebook');
    }
  }

  async listAdAccounts(accessToken: string): Promise<any[]> {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.baseUrl}/me/adaccounts`, {
          params: {
            fields: 'id,name,account_id,currency,account_status,balance,min_campaign_group_spend_cap,amount_spent',
            access_token: accessToken,
          },
        }),
      );
      return data.data || [];
    } catch (err: any) {
      this.logger.error('Failed to list ad accounts', err?.response?.data || err.message);
      throw new InternalServerErrorException('Failed to list ad accounts');
    }
  }

  async getFbCampaigns(adAccountId: string, accessToken: string): Promise<any[]> {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.baseUrl}/act_${adAccountId}/campaigns`, {
          params: {
            fields: 'id,name,objective,status,daily_budget,lifetime_budget,created_time',
            access_token: accessToken,
          },
        }),
      );
      return data.data || [];
    } catch (err: any) {
      this.logger.error('Failed to get campaigns', err?.response?.data || err.message);
      throw new InternalServerErrorException('Failed to fetch campaigns');
    }
  }

  async deleteCampaign(campaignId: string, accessToken: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.baseUrl}/${campaignId}`, null, {
          params: { status: 'DELETED', access_token: accessToken },
        }),
      );
    } catch (err: any) {
      this.logger.error(`Failed to delete campaign ${campaignId}`, err?.response?.data || err.message);
      throw new InternalServerErrorException('Failed to delete campaign on Facebook');
    }
  }

  async updateCampaignName(campaignId: string, name: string, accessToken: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.baseUrl}/${campaignId}`, null, {
          params: { name, access_token: accessToken },
        }),
      );
    } catch (err: any) {
      this.logger.error(`Failed to update campaign ${campaignId} name`, err?.response?.data || err.message);
      throw new InternalServerErrorException('Failed to update campaign name on Facebook');
    }
  }

  // ─── Facebook Pages ───

  async listAndStorePages(fbUserId: string, accessToken: string): Promise<any[]> {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.baseUrl}/me/accounts`, {
          params: { access_token: accessToken },
        }),
      );
      const pages = data.data || [];

      // Upsert each page
      for (const page of pages) {
        await this.prisma.fbPage.upsert({
          where: { pageId: page.id },
          update: {
            name: page.name,
            category: page.category || null,
            accessToken: encryptToken(page.access_token),
            tasks: (page.tasks || []).join(','),
          },
          create: {
            fbUserId,
            pageId: page.id,
            name: page.name,
            category: page.category || null,
            accessToken: encryptToken(page.access_token),
            tasks: (page.tasks || []).join(','),
          },
        });
      }

      return pages.map((p: any) => ({
        pageId: p.id,
        name: p.name,
        category: p.category,
        tasks: p.tasks || [],
      }));
    } catch (err: any) {
      this.logger.error('Failed to list FB pages', err?.response?.data || err.message);
      throw new InternalServerErrorException('Failed to fetch Facebook pages');
    }
  }

  async getStoredPages(fbUserId: string): Promise<any[]> {
    const pages = await this.prisma.fbPage.findMany({
      where: { fbUserId },
      orderBy: { name: 'asc' },
    });
    return pages.map(p => ({
      id: p.id,
      pageId: p.pageId,
      name: p.name,
      category: p.category,
      tasks: p.tasks ? p.tasks.split(',') : [],
    }));
  }

  async getPageAccessToken(pageId: string): Promise<string> {
    const page = await this.prisma.fbPage.findUnique({ where: { pageId } });
    if (!page) throw new NotFoundException('Facebook page not found — re-connect your FB account');
    return decryptToken(page.accessToken);
  }

  /** Refresh a single page's token from /me/accounts and return fresh token */
  async refreshSinglePageToken(userId: string, pageId: string): Promise<string> {
    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId } });
    if (!fbUser) throw new NotFoundException('Facebook account not connected');

    const userAccessToken = decryptToken(fbUser.accessToken);

    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.baseUrl}/me/accounts`, {
          params: { access_token: userAccessToken },
        }),
      );
      const pageData = (data.data || []).find((p: any) => p.id === pageId);
      if (!pageData) throw new NotFoundException('Page not found in your Facebook account — you may not be an admin');

      const freshToken = pageData.access_token;
      await this.prisma.fbPage.upsert({
        where: { pageId },
        update: { accessToken: encryptToken(freshToken), tasks: (pageData.tasks || []).join(',') },
        create: { fbUserId: fbUser.id, pageId, name: pageData.name, accessToken: encryptToken(freshToken), tasks: (pageData.tasks || []).join(',') },
      });
      return freshToken;
    } catch (err: any) {
      this.logger.error(`Failed to refresh page token for ${pageId}`, err?.response?.data || err.message);
      // Fallback: use the stored token
      const stored = await this.getPageAccessToken(pageId);
      return stored;
    }
  }

  async getPagePosts(pageId: string, accessToken: string): Promise<any[]> {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.baseUrl}/${pageId}/posts`, {
          params: {
            fields: 'id,message,permalink_url,created_time,full_picture,attachments{media,subattachments}',
            access_token: accessToken,
            limit: 25,
          },
        }),
      );
      return (data.data || []).map((post: any) => ({
        postId: post.id,
        message: post.message || '',
        permalinkUrl: post.permalink_url || '',
        createdTime: post.created_time,
        imageUrl: post.full_picture || null,
        attachments: post.attachments?.data || [],
      }));
    } catch (err: any) {
      this.logger.error(`Failed to get posts for page ${pageId}`, err?.response?.data || err.message);
      throw new InternalServerErrorException('Failed to fetch page posts');
    }
  }

  async postToPage(pageId: string, accessToken: string, message: string, link?: string, imageUrl?: string): Promise<{ id: string }> {
    try {
      const params: any = { message, access_token: accessToken };
      if (link) params.link = link;
      if (imageUrl && !link) params.url = imageUrl;

      const { data } = await firstValueFrom(
        this.http.post<{ id: string }>(`${this.baseUrl}/${pageId}/feed`, params, {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      return data;
    } catch (err: any) {
      const fbError = err?.response?.data?.error?.message || err?.response?.data?.error || err.message;
      this.logger.error(`Failed to post to page ${pageId}`, fbError);
      throw new InternalServerErrorException(`Facebook API error: ${fbError}`);
    }
  }

  async refreshPageTokens(fbUserId: string, userAccessToken: string): Promise<void> {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.baseUrl}/me/accounts`, {
          params: { access_token: userAccessToken },
        }),
      );
      const pages = data.data || [];
      for (const page of pages) {
        await this.prisma.fbPage.upsert({
          where: { pageId: page.id },
          update: {
            name: page.name,
            accessToken: encryptToken(page.access_token),
            tasks: (page.tasks || []).join(','),
          },
          create: {
            fbUserId,
            pageId: page.id,
            name: page.name,
            category: page.category || null,
            accessToken: encryptToken(page.access_token),
            tasks: (page.tasks || []).join(','),
          },
        });
      }
    } catch (err: any) {
      this.logger.error('Failed to refresh page tokens', err?.response?.data || err.message);
    }
  }

  // ─── Audience API ───

  async getCustomAudiences(adAccountId: string, accessToken: string): Promise<any[]> {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.baseUrl}/act_${adAccountId}/customaudiences`, {
          params: {
            fields: 'id,name,type,subtype,description,approximate_count,status,source_audience_id,lookalike_value,targeting,account_id',
            access_token: accessToken,
            limit: 200,
          },
        }),
      );
      return data.data || [];
    } catch (err: any) {
      this.logger.error(`Failed to get custom audiences for ${adAccountId}`, err?.response?.data || err.message);
      throw new InternalServerErrorException('Failed to fetch audiences from Facebook');
    }
  }

  async createCustomAudience(
    adAccountId: string,
    accessToken: string,
    params: { name: string; description?: string; subtype?: string },
  ): Promise<{ id: string }> {
    try {
      const body: any = {
        name: params.name,
        description: params.description || '',
        subtype: params.subtype || 'CUSTOM',
        access_token: accessToken,
      };
      const { data } = await firstValueFrom(
        this.http.post<{ id: string }>(`${this.baseUrl}/act_${adAccountId}/customaudiences`, body, {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      return data;
    } catch (err: any) {
      this.logger.error('Failed to create custom audience', err?.response?.data || err.message);
      throw new InternalServerErrorException(`Failed to create audience on Facebook: ${err?.response?.data?.error?.message || err.message}`);
    }
  }

  async createLookalikeAudience(
    adAccountId: string,
    accessToken: string,
    params: { name: string; sourceAudienceId: string; ratio: number },
  ): Promise<{ id: string }> {
    try {
      const body: any = {
        name: params.name,
        subtype: 'LOOKALIKE',
        origin_audience_id: params.sourceAudienceId,
        lookalike_spec: JSON.stringify({ ratio: params.ratio / 100, type: 'similarity', country: 'TH' }),
        access_token: accessToken,
      };
      const { data } = await firstValueFrom(
        this.http.post<{ id: string }>(`${this.baseUrl}/act_${adAccountId}/customaudiences`, body, {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      return data;
    } catch (err: any) {
      this.logger.error('Failed to create lookalike audience', err?.response?.data || err.message);
      throw new InternalServerErrorException(`Failed to create lookalike on Facebook: ${err?.response?.data?.error?.message || err.message}`);
    }
  }

  async deleteAudience(audienceId: string, accessToken: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.delete(`${this.baseUrl}/${audienceId}`, {
          params: { access_token: accessToken },
        }),
      );
    } catch (err: any) {
      this.logger.error(`Failed to delete audience ${audienceId}`, err?.response?.data || err.message);
      throw new InternalServerErrorException(`Failed to delete audience: ${err?.response?.data?.error?.message || err.message}`);
    }
  }

  async addUsersToAudience(
    audienceId: string,
    schema: string[],
    dataRows: string[][],
    accessToken: string,
  ): Promise<{ numInvalidEntries: number; numRejected: number }> {
    try {
      const { data } = await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/${audienceId}/users`,
          {
            payload: { schema, data: dataRows },
            access_token: accessToken,
          },
          { headers: { 'Content-Type': 'application/json' } },
        ),
      );
      return data;
    } catch (err: any) {
      this.logger.error(`Failed to add users to audience ${audienceId}`, err?.response?.data || err.message);
      throw new InternalServerErrorException(
        `Failed to add users to audience: ${err?.response?.data?.error?.message || err.message}`,
      );
    }
  }
}
