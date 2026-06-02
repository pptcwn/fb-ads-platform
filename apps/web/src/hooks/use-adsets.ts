'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adsetsApi } from '@/lib/api-client';

// ─── Query ───

export function useAdSets(campaignId: string | null) {
  return useQuery({
    queryKey: ['adsets', campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      const { data } = await adsetsApi.byCampaign(campaignId);
      return data.adsets || [];
    },
    enabled: !!campaignId,
  });
}

// ─── Mutations ───

export function useToggleAdSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'pause' | 'resume' }) =>
      action === 'pause' ? adsetsApi.pause(id).then(r => r.data) : adsetsApi.resume(id).then(r => r.data),
    onSuccess: (_data, { id, action }) => {
      qc.setQueriesData({ queryKey: ['adsets'] }, (old: any) =>
        (old || []).map((a: any) => a.id === id ? { ...a, status: action === 'pause' ? 'PAUSED' : 'ACTIVE' } : a)
      );
    },
  });
}

export function useUpdateAdSetBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dailyBudget }: { id: string; dailyBudget: number }) =>
      adsetsApi.updateBudget(id, dailyBudget).then(r => r.data),
    onSuccess: (_data, { id, dailyBudget }) => {
      qc.setQueriesData({ queryKey: ['adsets'] }, (old: any) =>
        (old || []).map((a: any) => a.id === id ? { ...a, dailyBudget } : a)
      );
    },
  });
}
