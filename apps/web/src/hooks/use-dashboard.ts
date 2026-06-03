'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { facebookApi, syncApi, insightsApi, warmupApi } from '@/lib/api-client';

// ─── Facebook Status ───

export function useFbStatus() {
  return useQuery({
    queryKey: ['facebook', 'me'],
    queryFn: async () => {
      const { data } = await facebookApi.me();
      return data;
    },
    refetchInterval: 5 * 60_000,
  });
}

export function useFbAuthUrl() {
  return useQuery({
    queryKey: ['facebook', 'auth'],
    queryFn: async () => {
      const { data } = await facebookApi.getAuthUrl();
      return data.url;
    },
    enabled: false, // manual trigger
  });
}

export function useFbDisconnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => facebookApi.disconnect().then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['facebook'] }); },
  });
}

// ─── Sync Status ───

export function useSyncStatus() {
  return useQuery({
    queryKey: ['sync', 'status'],
    queryFn: async () => {
      const { data } = await syncApi.status();
      return data;
    },
    refetchInterval: 60_000,
  });
}

export function useTriggerSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => syncApi.trigger().then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sync'] });
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      qc.invalidateQueries({ queryKey: ['adaccounts'] });
    },
  });
}

// ─── Insights ───

export function useInsights(adAccountId: string | null, days: number = 7) {
  return useQuery({
    queryKey: ['insights', adAccountId, days],
    queryFn: async () => {
      if (!adAccountId) return [];
      const { data } = await insightsApi.byAccount(adAccountId, days);
      return data;
    },
    enabled: !!adAccountId,
    refetchInterval: 3 * 60_000,
  });
}

export function useSyncInsights() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (adAccountId?: string) =>
      adAccountId
        ? insightsApi.sync().then(r => r.data)  // syncAll ignores body
        : insightsApi.sync().then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['insights'] }); },
    // Overload: pass adAccountId to sync specific account
  });
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['insights', 'summary'],
    queryFn: async () => {
      const { data } = await insightsApi.summary();
      return data;
    },
    refetchInterval: 30_000, // auto-refresh every 30s
  });
}

// ─── Warmup ───

export function useWarmupStatus() {
  return useQuery({
    queryKey: ['warmup', 'status'],
    queryFn: async () => {
      const { data } = await warmupApi.status();
      return data;
    },
  });
}

export function useWarmupActions() {
  const qc = useQueryClient();
  const start = useMutation({
    mutationFn: ({ id, targetDailyBudget }: { id: string; targetDailyBudget: number }) =>
      warmupApi.start(id, targetDailyBudget).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['warmup'] }); },
  });
  const stop = useMutation({
    mutationFn: (id: string) => warmupApi.stop(id).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['warmup'] }); },
  });
  const tick = useMutation({
    mutationFn: () => warmupApi.tick().then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['warmup'] }); },
  });
  return { start, stop, tick };
}
