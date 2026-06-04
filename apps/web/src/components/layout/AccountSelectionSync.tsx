'use client';

import { useEffect } from 'react';
import { useAdAccounts } from '@/hooks/use-accounts';
import { useAccountContext } from '@/contexts/account-context';
import { canCreateAdsForAccount } from '@/lib/ad-account-utils';
import { isLegacyAllSelection } from '@/hooks/use-selected-ad-account';

/** Ensure a concrete ad account is always selected (including restricted — read-only). */
export default function AccountSelectionSync() {
  const { data: accounts = [] } = useAdAccounts();
  const { selectedAccountId, setSelectedAccountId } = useAccountContext();

  useEffect(() => {
    if (accounts.length === 0) return;

    const valid =
      !isLegacyAllSelection(selectedAccountId) &&
      accounts.some((a) => a.id === selectedAccountId);

    if (valid) return;

    const preferred =
      accounts.find((a) => canCreateAdsForAccount(a)) ?? accounts[0];
    if (preferred) setSelectedAccountId(preferred.id);
  }, [accounts, selectedAccountId, setSelectedAccountId]);

  return null;
}