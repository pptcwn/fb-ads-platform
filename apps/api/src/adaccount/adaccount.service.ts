import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { enrichAdAccountCapabilities } from './ad-account-capabilities';

export { enrichAdAccountCapabilities, canCreateAds } from './ad-account-capabilities';

@Injectable()
export class AdAccountService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly accountSelect = {
    id: true,
    accountId: true,
    name: true,
    currency: true,
    timezone: true,
    status: true,
    accountStatusCode: true,
    disableReason: true,
    statusLabelTh: true,
    balance: true,
    spentToday: true,
    spendCap: true,
    isWarmingUp: true,
    warmupDay: true,
    createdAt: true,
    _count: { select: { campaigns: true } },
  } satisfies Prisma.AdAccountSelect;

  async listForUser(userId: string, options?: { usableOnly?: boolean }) {
    const where: Prisma.AdAccountWhereInput = {
      fbUser: { userId },
      ...(options?.usableOnly ? { status: 'ACTIVE' as AccountStatus } : {}),
    };

    const accounts = await this.prisma.adAccount.findMany({
      where,
      select: this.accountSelect,
      orderBy: { createdAt: 'desc' },
    });

    return accounts.map((a) =>
      enrichAdAccountCapabilities({
        ...a,
        balance: a.balance ? Number(a.balance) : 0,
        spentToday: a.spentToday ? Number(a.spentToday) : 0,
        spendCap: a.spendCap ? Number(a.spendCap) : null,
      }),
    );
  }

  async findOwnedAccount(adAccountId: string, userId: string) {
    return this.prisma.adAccount.findFirst({
      where: { id: adAccountId, fbUser: { userId } },
    });
  }

  async assertCanCreateAds(adAccountId: string, userId: string): Promise<void> {
    const account = await this.findOwnedAccount(adAccountId, userId);
    if (!account) throw new NotFoundException('Ad account not found');
    assertCanCreateAds(account);
  }
}

/** Throws BadRequestException with structured body when account cannot create ads. */
export function assertCanCreateAds(account: {
  status: AccountStatus;
  disableReason?: number | null;
  name?: string;
}): void {
  const enriched = enrichAdAccountCapabilities({
    status: account.status,
    disableReason: account.disableReason,
  });
  if (enriched.canCreateAds) return;

  throw new BadRequestException({
    message: enriched.restrictionMessage || 'บัญชีโฆษณานี้ถูกจำกัด ไม่สามารถสร้างแคมเปญได้',
    code: 'AD_ACCOUNT_RESTRICTED',
    status: account.status,
    disableReason: account.disableReason ?? null,
    accountName: account.name,
  });
}