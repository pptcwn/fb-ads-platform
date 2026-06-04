'use client';

import { useMemo } from 'react';
import { useAdAccounts } from './use-accounts';
import { filterUsableAccounts } from '@/lib/ad-account-utils';

/** Ad accounts that can create campaigns (ACTIVE / canCreateAds). */
export function useUsableAdAccounts() {
  const query = useAdAccounts();
  const usable = useMemo(
    () => filterUsableAccounts(query.data ?? []),
    [query.data],
  );
  return { ...query, data: usable, usable, all: query.data ?? [] };
}