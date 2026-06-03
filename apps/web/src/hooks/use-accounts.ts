'use client';

import { useQuery } from '@tanstack/react-query';
import { accountsApi } from '@/lib/api-client';

export function useAdAccounts() {
  return useQuery({
    queryKey: ['adaccounts'],
    queryFn: async () => {
      const { data } = await accountsApi.list();
      return data;
    },
    staleTime: 30 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });
}
