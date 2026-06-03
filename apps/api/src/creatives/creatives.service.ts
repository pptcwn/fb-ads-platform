import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookService } from '../facebook/facebook.service';
import { FB_GRAPH_BASE_URL, fbAdAccountActId } from '../common/facebook-api.config';
import { ObjectStorageService } from '../common/object-storage.service';
import { extname, join } from 'path';
import { existsSync } from 'fs';

interface UploadedFile {
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
  path: string;
  fieldname: string;
}

@Injectable()
export class CreativesService {
  private readonly logger = new Logger(CreativesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly facebookService: FacebookService,
    private readonly objectStorage: ObjectStorageService,
  ) {}

  // ─── CRUD ───

  async create(userId: string, dto: {
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
    return this.prisma.creative.create({
      data: {
        userId,
        name: dto.name,
        type: (dto.type || 'IMAGE') as any,
        primaryText: dto.primaryText || null,
        headline: dto.headline || null,
        description: dto.description || null,
        callToAction: dto.callToAction || null,
        imageUrl: dto.imageUrl || null,
        linkUrl: dto.linkUrl || null,
        pageId: dto.pageId || null,
      },
    });
  }

  async list(userId: string) {
    const creatives = await this.prisma.creative.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      include: { campaigns: { include: { campaign: { select: { id: true, name: true } } } } },
    });
    return creatives;
  }

  async getById(userId: string, id: string) {
    const creative = await this.prisma.creative.findFirst({
      where: { id, userId },
      include: { campaigns: { include: { campaign: { select: { id: true, name: true } } } } },
    });
    if (!creative) throw new NotFoundException('Creative not found');
    return creative;
  }

  async update(userId: string, id: string, dto: {
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
    const existing = await this.prisma.creative.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Creative not found');

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.primaryText !== undefined) data.primaryText = dto.primaryText;
    if (dto.headline !== undefined) data.headline = dto.headline;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.callToAction !== undefined) data.callToAction = dto.callToAction;
    if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl;
    if (dto.linkUrl !== undefined) data.linkUrl = dto.linkUrl;
    if (dto.pageId !== undefined) data.pageId = dto.pageId;

    return this.prisma.creative.update({ where: { id }, data });
  }

  async delete(userId: string, id: string) {
    const existing = await this.prisma.creative.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Creative not found');
    await this.prisma.creative.delete({ where: { id } });
    return { message: 'Creative deleted' };
  }

  // ─── Campaign Linking ───

  async linkToCampaign(userId: string, creativeId: string, campaignId: string) {
    const creative = await this.prisma.creative.findFirst({ where: { id: creativeId, userId } });
    if (!creative) throw new NotFoundException('Creative not found');

    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, adAccount: { fbUser: { userId } } },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    // Upsert link
    const link = await this.prisma.creativeCampaign.upsert({
      where: { creativeId_campaignId: { creativeId, campaignId } },
      update: {},
      create: { creativeId, campaignId },
    });

    // Update used count
    await this.prisma.creative.update({
      where: { id: creativeId },
      data: {
        usedCount: { increment: 1 },
        status: 'USED',
        lastUsedAt: new Date(),
      } as any,
    });

    return link;
  }

  async unlinkCampaign(userId: string, creativeId: string, campaignId: string) {
    const creative = await this.prisma.creative.findFirst({ where: { id: creativeId, userId } });
    if (!creative) throw new NotFoundException('Creative not found');

    await this.prisma.creativeCampaign.deleteMany({
      where: { creativeId, campaignId },
    });

    return { message: 'Creative unlinked from campaign' };
  }

  async getLinkedCampaigns(userId: string, creativeId: string) {
    await this.getById(userId, creativeId); // validate ownership
    return this.prisma.creativeCampaign.findMany({
      where: { creativeId },
      include: { campaign: { select: { id: true, name: true, status: true } } },
    });
  }

  // ─── Image Upload (updates creative with uploaded file info) ───

  async attachImage(userId: string, id: string, file: UploadedFile) {
    const creative = await this.prisma.creative.findFirst({ where: { id, userId } });
    if (!creative) throw new NotFoundException('Creative not found');

    let imageUrl = `/api/creatives/uploads/${file.filename}`;
    if (this.objectStorage.isEnabled() && file.path) {
      const key = `creatives/${userId}/${id}${extname(file.originalname || file.filename)}`;
      imageUrl = await this.objectStorage.uploadLocalFile(
        file.path,
        key,
        file.mimetype || 'application/octet-stream',
      );
    }

    const updateData: any = { imageUrl };
    if (file.size) updateData.imageWidth = null; // We'll skip dimensions for now
    if (file.size) updateData.imageHeight = null;

    return this.prisma.creative.update({ where: { id }, data: updateData });
  }

  // ─── Facebook Creative Integration ───

  async createFbCreative(userId: string, id: string, adAccountId: string) {
    const creative = await this.getById(userId, id);
    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId } });
    if (!fbUser) throw new BadRequestException('Facebook account not connected');

    const accessToken = await this.facebookService.getDecryptedToken(fbUser.id);

    // Get the ad account
    const account = await this.prisma.adAccount.findFirst({
      where: { id: adAccountId, fbUser: { userId } },
    });
    if (!account) throw new NotFoundException('Ad account not found');

    const actId = fbAdAccountActId(account.accountId);

    let pageId = creative.pageId;
    if (!pageId) {
      const pages = await this.facebookService.getStoredPages(fbUser.id);
      if (pages.length === 0) {
        throw new BadRequestException(
          'No Facebook Page linked. Connect FB, then Dashboard → sync pages, or import from a Page.',
        );
      }
      pageId = pages[0].pageId;
    }

    // Upload image to Facebook if we have one
    let imageHash = creative.imageFbHash;
    if (!imageHash && creative.imageUrl) {
      imageHash = await this.uploadImageToFb(actId, accessToken, creative.imageUrl);
    }

    const destinationLink = creative.linkUrl?.includes('facebook.com')
      ? 'https://www.example.com'
      : (creative.linkUrl || 'https://www.example.com');

    // Build creative params
    const creativeParams: any = {
      name: creative.name,
      object_story_spec: {
        page_id: pageId,
        link_data: {
          link: destinationLink,
          message: creative.primaryText || '',
          name: creative.headline || creative.name,
          description: creative.description || '',
          call_to_action: { type: creative.callToAction || 'LEARN_MORE' },
        },
      },
    };

    if (imageHash) {
      creativeParams.object_story_spec.link_data.image_hash = imageHash;
    }

    // Call Facebook API
    const url = `${FB_GRAPH_BASE_URL}/act_${actId}/creatives`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...creativeParams, access_token: accessToken }),
    });

    const result = await response.json();
    if (result.error) {
      throw new BadRequestException(`Facebook error: ${result.error.message}`);
    }

    // Update creative with FB data
    await this.prisma.creative.update({
      where: { id },
      data: {
        fbCreativeId: result.id,
        imageFbHash: imageHash || undefined,
        status: 'READY',
      } as any,
    });

    return { fbCreativeId: result.id, imageFbHash: imageHash };
  }

  private async uploadImageToFb(accountId: string, accessToken: string, imageUrl: string): Promise<string | null> {
    const actId = fbAdAccountActId(accountId);
    try {
      if (imageUrl.startsWith('/api/creatives/uploads/')) {
        const filename = imageUrl.replace(/^\/api\/creatives\/uploads\//, '');
        const filePath = join(process.cwd(), 'uploads', 'creatives', filename);
        if (!existsSync(filePath)) {
          this.logger.warn(`Local upload file missing: ${filePath}`);
          return null;
        }
        const ext = extname(filename).toLowerCase();
        const mime =
          ext === '.png' ? 'image/png'
          : ext === '.webp' ? 'image/webp'
          : ext === '.gif' ? 'image/gif'
          : 'image/jpeg';
        return await this.facebookService.uploadAdImage(actId, accessToken, {
          path: filePath,
          originalname: filename,
          mimetype: mime,
        });
      }

      const response = await fetch(`${FB_GRAPH_BASE_URL}/act_${actId}/adimages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: accessToken,
          url: imageUrl,
        }),
      });

      const result = await response.json();
      if (result.error) {
        this.logger.error(`Failed to upload image to FB: ${result.error.message}`);
        return null;
      }

      const images = result.images || {};
      const hash = Object.values(images)[0] as any;
      return hash?.hash || null;
    } catch (err: any) {
      this.logger.error(`Image upload to FB failed: ${err.message}`);
      return null;
    }
  }

  // ─── Facebook Page Integration ───

  async getPages(userId: string) {
    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId } });
    if (!fbUser) throw new BadRequestException('Facebook account not connected');
    return this.facebookService.getStoredPages(fbUser.id);
  }

  async getPagePosts(userId: string, pageId: string) {
    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId } });
    if (!fbUser) throw new BadRequestException('Facebook account not connected');
    const accessToken = await this.facebookService.getPageAccessToken(pageId);
    return this.facebookService.getPagePosts(pageId, accessToken);
  }

  async importPost(userId: string, pageId: string, postId: string, postData?: { message?: string; imageUrl?: string; permalinkUrl?: string }) {
    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId } });
    if (!fbUser) throw new BadRequestException('Facebook account not connected');

    let message = '';
    let imageUrl: string | null = null;
    let linkUrl: string | null = null;
    let headline = '';

    if (postData) {
      // Use pre-fetched data from posts list (avoids extra FB API call)
      message = postData.message || '';
      imageUrl = postData.imageUrl || null;
      linkUrl = postData.permalinkUrl || null;
    } else {
      // Fallback: fetch post details from FB
      const accessToken = await this.facebookService.getPageAccessToken(pageId);
      const fields = 'id,message,permalink_url,created_time,full_picture,attachments{media,subattachments}';
      const url = `${FB_GRAPH_BASE_URL}/${postId}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(accessToken)}`;
      const response = await fetch(url);
      const post = await response.json();
      if (post.error) throw new BadRequestException(`Facebook error: ${post.error.message}`);

      message = post.message || '';
      imageUrl = post.full_picture || null;
      if (!imageUrl && post.attachments?.data?.[0]?.media?.image?.src) {
        imageUrl = post.attachments.data[0].media.image.src;
      }
      if (post.attachments?.data?.[0]?.title) {
        headline = post.attachments.data[0].title;
      }
      linkUrl = post.permalink_url || null;
    }

    // Create creative from post (use the variables we set above)
    const creative = await this.prisma.creative.create({
      data: {
        userId,
        name: `📥 ${(message || 'Imported Post').slice(0, 60)}`,
        type: 'IMAGE',
        primaryText: message || '',
        headline: headline || null,
        imageUrl,
        linkUrl,
        pageId,
        status: 'DRAFT',
      },
    });

    return creative;
  }

  async postCreativeToPage(userId: string, creativeId: string, pageId: string) {
    const creative = await this.getById(userId, creativeId);

    // Refresh page token from /me/accounts first to ensure it has pages_manage_posts
    const pageAccessToken = await this.facebookService.refreshSinglePageToken(userId, pageId);

    const result = await this.facebookService.postToPage(
      pageId,
      pageAccessToken,
      creative.primaryText || creative.name,
      creative.linkUrl || undefined,
      creative.imageUrl || undefined,
    );

    // Mark creative as USED
    await this.prisma.creative.update({
      where: { id: creativeId },
      data: {
        usedCount: { increment: 1 },
        status: 'USED',
        lastUsedAt: new Date(),
      } as any,
    });

    return { postId: result.id, message: 'Posted to Facebook page successfully!' };
  }

  // ─── Clone ───

  async clone(userId: string, id: string, newName?: string) {
    const source = await this.prisma.creative.findFirst({
      where: { id, userId },
    });
    if (!source) throw new NotFoundException('Creative not found');

    const cloneName = newName || `Copy of ${source.name}`;

    const cloned = await this.prisma.creative.create({
      data: {
        userId: source.userId,
        name: cloneName,
        type: source.type,
        primaryText: source.primaryText,
        headline: source.headline,
        description: source.description,
        callToAction: source.callToAction,
        imageUrl: source.imageUrl,
        linkUrl: source.linkUrl,
        pageId: source.pageId,
        status: 'DRAFT',
      },
    });

    return {
      id: cloned.id,
      name: cloneName,
      type: cloned.type,
      status: cloned.status,
      message: `Creative cloned successfully as "${cloneName}"`,
    };
  }
}
