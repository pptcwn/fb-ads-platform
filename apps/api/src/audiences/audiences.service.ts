import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookService } from '../facebook/facebook.service';
import { hashAudienceDataRow, normalizeSchemaType } from '../common/audience-pii.util';

@Injectable()
export class AudiencesService {
  private readonly logger = new Logger(AudiencesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly facebookService: FacebookService,
  ) {}

  async list(userId: string) {
    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId } });
    if (!fbUser) return [];

    const audiences = await this.prisma.audience.findMany({
      where: { adAccount: { fbUserId: fbUser.id } },
      orderBy: { updatedAt: 'desc' },
      include: { adAccount: { select: { id: true, accountId: true, name: true } } },
    });

    return audiences.map(a => ({
      id: a.id,
      adAccountId: a.adAccountId,
      accountName: a.adAccount.name,
      fbAudienceId: a.fbAudienceId,
      name: a.name,
      type: a.type,
      subtype: a.subtype,
      description: a.description,
      approximateCount: a.approximateCount,
      status: a.status,
      sourceAudienceId: a.sourceAudienceId,
      lookalikeRatio: a.lookalikeRatio,
      createdAt: a.createdAt,
    }));
  }

  async syncFromFacebook(userId: string, adAccountId: string) {
    const adAccount = await this.prisma.adAccount.findFirst({
      where: { id: adAccountId, fbUser: { userId } },
      include: { fbUser: true },
    });
    if (!adAccount) throw new NotFoundException('Ad account not found');

    const accessToken = await this.facebookService.getDecryptedToken(adAccount.fbUser.id);
    const fbAccountId = adAccount.accountId.replace('act_', '');

    const fbAudiences = await this.facebookService.getCustomAudiences(fbAccountId, accessToken);

    let synced = 0;
    for (const fb of fbAudiences) {
      const type = fb.type === 'lookalike' ? 'LOOKALIKE' : fb.type === 'saved' ? 'SAVED' : 'CUSTOM';
      await this.prisma.audience.upsert({
        where: { fbAudienceId: fb.id },
        update: {
          name: fb.name,
          type: type as any,
          subtype: fb.subtype || null,
          description: fb.description || null,
          approximateCount: fb.approximate_count || null,
          status: typeof fb.status === 'string' ? fb.status : 'READY',
          sourceAudienceId: fb.source_audience_id || null,
          lookalikeRatio: fb.lookalike_value ? parseFloat(fb.lookalike_value) : null,
          targeting: fb.targeting || null,
        },
        create: {
          adAccountId: adAccount.id,
          fbAudienceId: fb.id,
          name: fb.name,
          type: type as any,
          subtype: fb.subtype || null,
          description: fb.description || null,
          approximateCount: fb.approximate_count || null,
          status: typeof fb.status === 'string' ? fb.status : 'READY',
          sourceAudienceId: fb.source_audience_id || null,
          lookalikeRatio: fb.lookalike_value ? parseFloat(fb.lookalike_value) : null,
          targeting: fb.targeting || null,
        },
      });
      synced++;
    }

    const total = await this.prisma.audience.count({ where: { adAccountId: adAccount.id } });
    return { synced, total, message: `Synced ${synced} audiences (total: ${total})` };
  }

  async createCustomAudience(userId: string, dto: { adAccountId: string; name: string; description?: string; subtype?: string }) {
    if (!dto.name) throw new BadRequestException('Audience name is required');

    const adAccount = await this.prisma.adAccount.findFirst({
      where: { id: dto.adAccountId, fbUser: { userId } },
      include: { fbUser: true },
    });
    if (!adAccount) throw new NotFoundException('Ad account not found');

    const accessToken = await this.facebookService.getDecryptedToken(adAccount.fbUser.id);
    const fbAccountId = adAccount.accountId.replace('act_', '');

    const result = await this.facebookService.createCustomAudience(fbAccountId, accessToken, {
      name: dto.name,
      description: dto.description || '',
      subtype: dto.subtype || 'CUSTOM',
    });

    const audience = await this.prisma.audience.create({
      data: {
        adAccountId: adAccount.id,
        fbAudienceId: result.id,
        name: dto.name,
        type: 'CUSTOM',
        subtype: dto.subtype || 'CUSTOM',
        description: dto.description || null,
        status: 'READY',
      },
    });

    return {
      id: audience.id,
      fbAudienceId: audience.fbAudienceId,
      name: audience.name,
      type: audience.type,
      message: `Custom audience "${dto.name}" created`,
    };
  }

  async createLookalike(userId: string, dto: { adAccountId: string; name: string; sourceAudienceId: string; ratio?: number }) {
    if (!dto.name || !dto.sourceAudienceId) {
      throw new BadRequestException('Name and source audience ID are required');
    }

    const adAccount = await this.prisma.adAccount.findFirst({
      where: { id: dto.adAccountId, fbUser: { userId } },
      include: { fbUser: true },
    });
    if (!adAccount) throw new NotFoundException('Ad account not found');

    // Verify source audience exists
    const source = await this.prisma.audience.findFirst({
      where: { fbAudienceId: dto.sourceAudienceId, adAccountId: adAccount.id },
    });
    if (!source) throw new NotFoundException('Source audience not found in your account');

    const accessToken = await this.facebookService.getDecryptedToken(adAccount.fbUser.id);
    const fbAccountId = adAccount.accountId.replace('act_', '');

    const ratio = Math.min(Math.max(dto.ratio || 1, 1), 10); // clamp 1-10%
    const result = await this.facebookService.createLookalikeAudience(fbAccountId, accessToken, {
      name: dto.name,
      sourceAudienceId: dto.sourceAudienceId,
      ratio,
    });

    const audience = await this.prisma.audience.create({
      data: {
        adAccountId: adAccount.id,
        fbAudienceId: result.id,
        name: dto.name,
        type: 'LOOKALIKE',
        subtype: 'LOOKALIKE',
        status: 'IS_LOOKALIKE',
        sourceAudienceId: dto.sourceAudienceId,
        lookalikeRatio: ratio,
      },
    });

    return {
      id: audience.id,
      fbAudienceId: audience.fbAudienceId,
      name: audience.name,
      type: audience.type,
      ratio,
      message: `Lookalike audience "${dto.name}" created (${ratio}% ratio)`,
    };
  }

  async remove(userId: string, id: string) {
    const audience = await this.prisma.audience.findFirst({
      where: { id, adAccount: { fbUser: { userId } } },
      include: { adAccount: { include: { fbUser: true } } },
    });
    if (!audience) throw new NotFoundException('Audience not found');

    // Optionally delete from Facebook
    try {
      const accessToken = await this.facebookService.getDecryptedToken(audience.adAccount.fbUser.id);
      await this.facebookService.deleteAudience(audience.fbAudienceId, accessToken);
    } catch (err: any) {
      this.logger.warn(`Failed to delete audience ${audience.fbAudienceId} from FB: ${err.message}`);
    }

    await this.prisma.audience.delete({ where: { id } });
    return { message: `Audience "${audience.name}" deleted` };
  }

  async uploadUsers(
    userId: string,
    id: string,
    file: any,
    schemaMapping: Record<string, string> | null,
    options: { consentConfirmed: boolean; ipAddress?: string },
  ) {
    if (!options.consentConfirmed) {
      throw new BadRequestException(
        'PDPA consent is required: confirm you have lawful basis to upload this customer data.',
      );
    }
    const audience = await this.prisma.audience.findFirst({
      where: { id, adAccount: { fbUser: { userId } } },
      include: { adAccount: { include: { fbUser: true } } },
    });
    if (!audience) throw new NotFoundException('Audience not found');
    if (audience.type !== 'CUSTOM') throw new BadRequestException('Only custom audiences support user upload');

    // Parse CSV
    const csvContent = file.buffer.toString('utf-8');
    const lines = csvContent.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
    if (lines.length < 2) throw new BadRequestException('CSV must have a header row and at least one data row');

    const headers = lines[0].split(',').map((h: string) => h.trim().replace(/^["']|["']$/g, ''));
    const rows = lines.slice(1).map((line: string) => {
      const vals: string[] = [];
      let inQuote = false;
      let cur = '';
      for (const ch of line) {
        if (ch === '"') { inQuote = !inQuote; continue; }
        if (ch === ',' && !inQuote) { vals.push(cur.trim()); cur = ''; continue; }
        cur += ch;
      }
      vals.push(cur.trim());
      return vals;
    }).filter((r: string[]) => r.length === headers.length && r.some((v: string) => v.length > 0));

    if (rows.length === 0) throw new BadRequestException('No valid data rows found in CSV');

    // Auto-detect schema if not provided
    const SCHEMA_KEYWORDS: Record<string, string[]> = {
      EMAIL: ['email', 'e-mail', 'mail', 'อีเมล'],
      PHONE: ['phone', 'mobile', 'tel', 'telephone', 'เบอร์', 'โทร'],
      MADID: ['madid', 'device_id', 'deviceid', 'advertising_id', 'adid'],
      EXTERN_ID: ['extern_id', 'external_id', 'ext_id', 'user_id', 'uid', 'id', 'customer_id'],
      WHATSAPP: ['whatsapp', 'wa_id'],
      GEN: ['gen', 'gender'],
      DOBY: ['doby', 'birth_year', 'year_of_birth'],
      DOBM: ['dobm', 'birth_month', 'month_of_birth'],
      DOBD: ['dobd', 'birth_day', 'day_of_birth'],
      FIRST_NAME: ['first_name', 'firstname', 'fname', 'ชื่อ'],
      LAST_NAME: ['last_name', 'lastname', 'lname', 'นามสกุล'],
      ZIP: ['zip', 'zipcode', 'postal', 'postcode', 'รหัสไปรษณีย์'],
      COUNTRY: ['country', 'ประเทศ'],
      CITY: ['city', 'town', 'เมือง'],
      CT_VALUE: ['ct_value', 'custom_value', 'value'],
    };

    const mapping: Record<string, string> = {};
    if (schemaMapping) {
      // Use explicit mapping from frontend
      for (const [col, schemaType] of Object.entries(schemaMapping)) {
        const idx = headers.indexOf(col);
        if (idx >= 0) mapping[col] = schemaType;
      }
    } else {
      // Auto-detect
      for (const h of headers) {
        const hl = h.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const [schema, keywords] of Object.entries(SCHEMA_KEYWORDS)) {
          if (keywords.some(k => hl === k.replace(/[^a-z0-9]/g, '') || hl.includes(k.replace(/[^a-z0-9]/g, '')))) {
            mapping[h] = schema;
            break;
          }
        }
      }
    }

    if (Object.keys(mapping).length === 0) {
      throw new BadRequestException(
        'Could not detect column types. Please specify schema mapping. Supported types: EMAIL, PHONE, MADID, EXTERN_ID, WHATSAPP, GEN, DOBY, DOBM, DOBD, FIRST_NAME, LAST_NAME, ZIP, COUNTRY, CITY',
      );
    }

    const schemaColumns = Object.keys(mapping);
    const schemaOrder = schemaColumns.map((col) => normalizeSchemaType(mapping[col]));
    const dataRows = rows
      .map((row: string[]) => {
        const rawValues = schemaColumns.map((col) => {
          const idx = headers.indexOf(col);
          return idx >= 0 ? row[idx] : '';
        });
        return hashAudienceDataRow(schemaOrder, rawValues);
      })
      .filter((r: string[]) => r.some((v: string) => v.length > 0));

    if (dataRows.length === 0) throw new BadRequestException('No data rows with mapped columns found');

    await this.prisma.activityLog.create({
      data: {
        userId,
        fbUserId: audience.adAccount.fbUser.id,
        action: 'AUDIENCE_UPLOAD_CONSENT',
        entityType: 'audience',
        entityId: audience.id,
        ipAddress: options.ipAddress || null,
        metadata: {
          audienceName: audience.name,
          fbAudienceId: audience.fbAudienceId,
          rowCount: dataRows.length,
          schema: schemaOrder,
          piiHashed: true,
          consentConfirmed: true,
        },
      },
    });

    // Send in batches of 10000 (Facebook limit)
    const BATCH_SIZE = 10000;
    let totalAdded = 0;
    let totalInvalid = 0;
    let totalRejected = 0;

    const accessToken = await this.facebookService.getDecryptedToken(audience.adAccount.fbUser.id);

    for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
      const batch = dataRows.slice(i, i + BATCH_SIZE);
      const result = await this.facebookService.addUsersToAudience(
        audience.fbAudienceId,
        schemaOrder,
        batch,
        accessToken,
      );
      totalAdded += batch.length - (result.numInvalidEntries || 0) - (result.numRejected || 0);
      totalInvalid += result.numInvalidEntries || 0;
      totalRejected += result.numRejected || 0;
    }

    return {
      message: `Uploaded ${dataRows.length} users to "${audience.name}" (PII hashed per PDPA/Meta)`,
      totalRows: dataRows.length,
      added: totalAdded,
      invalid: totalInvalid,
      rejected: totalRejected,
      mapping,
      piiHashed: true,
      preview: rows.slice(0, 5).map((row: string[]) =>
        schemaColumns.map((col) => {
          const idx = headers.indexOf(col);
          return idx >= 0 ? '[redacted]' : '';
        }),
      ),
    };
  }
}
