'use client';

import { useMemo } from 'react';
import { useAccountContext, type AccountSelection } from '@/contexts/account-context';
import {
  canCreateAdsForAccount,
  type AdAccountCapabilities,
} from '@/lib/ad-account-utils';
import { useAdAccounts } from './use-accounts';

export function isLegacyAllSelection(id: AccountSelection): boolean {
  return id === 'all' || id === '';
}

export function useSelectedAdAccount() {
  const { selectedAccountId, setSelectedAccountId } = useAccountContext();
  const { data: accounts = [], isLoading, ...query } = useAdAccounts();

  const selectedAccount = useMemo((): AdAccountCapabilities | null => {
    if (isLegacyAllSelection(selectedAccountId)) return null;
    return accounts.find((a) => a.id === selectedAccountId) ?? null;
  }, [accounts, selectedAccountId]);

  const canCreate = selectedAccount ? canCreateAdsForAccount(selectedAccount) : false;
  const isRestricted = selectedAccount != null && !canCreate;

  return {
    ...query,
    isLoading,
    accounts,
    selectedAccountId: selectedAccount?.id ?? null,
    selectedAccount,
    setSelectedAccountId,
    canCreate,
    isRestricted,
    isReady: !!selectedAccount,
  };
}

/** Filter rows that belong to the selected ad account (by internal id). */
export function filterBySelectedAccount<T extends { adAccountId: string }>(
  items: T[],
  accountId: string | null,
): T[] {
  if (!accountId) return [];
  return items.filter((item) => item.adAccountId === accountId);
}