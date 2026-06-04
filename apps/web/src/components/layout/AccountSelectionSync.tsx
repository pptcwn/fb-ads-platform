'use client';

import { useEffect } from 'react';
import { useAdAccounts } from '@/hooks/use-accounts';
import { useAccountContext } from '@/contexts/account-context';
import { canCreateAdsForAccount } from '@/lib/ad-account-utils';

/** Reset stored selection if it points at a restricted account (read-only is ok for "all"). */
export default function AccountSelectionSync() {
  const { data: accounts = [] } = useAdAccounts();
  const { selectedAccountId, setSelectedAccountId } = useAccountContext();

  useEffect(() => {
    if (selectedAccountId === 'all') return;
    const selected = accounts.find((a) => a.id === selectedAccountId);
    if (!selected) {
      const firstUsable = accounts.find((a) => canCreateAdsForAccount(a));
      setSelectedAccountId(firstUsable?.id ?? 'all');
      return;
    }
    if (!canCreateAdsForAccount(selected)) {
      setSelectedAccountId('all');
    }
  }, [accounts, selectedAccountId, setSelectedAccountId]);

  return null;
}