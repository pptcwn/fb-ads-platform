export type AdAccountStatus = 'ACTIVE' | 'LIMITED' | 'DISABLED' | 'BANNED' | string;

export interface AdAccountCapabilities {
  id: string;
  name: string;
  currency: string;
  status: AdAccountStatus;
  canCreateAds?: boolean;
  restrictionMessage?: string | null;
  statusLabelTh?: string | null;
}

export function canCreateAdsForAccount(account: AdAccountCapabilities): boolean {
  if (account.canCreateAds != null) return account.canCreateAds;
  return account.status === 'ACTIVE';
}

export function filterUsableAccounts<T extends AdAccountCapabilities>(accounts: T[]): T[] {
  return accounts.filter(canCreateAdsForAccount);
}

export function partitionAccounts<T extends AdAccountCapabilities>(accounts: T[]) {
  const usable: T[] = [];
  const restricted: T[] = [];
  for (const a of accounts) {
    if (canCreateAdsForAccount(a)) usable.push(a);
    else restricted.push(a);
  }
  return { usable, restricted };
}

export function statusBadgeClass(status: AdAccountStatus): string {
  switch (status) {
    case 'ACTIVE':
      return 'badge-success';
    case 'LIMITED':
      return 'badge-warning';
    case 'DISABLED':
      return 'badge-warning';
    case 'BANNED':
      return 'badge-danger';
    default:
      return 'badge';
  }
}