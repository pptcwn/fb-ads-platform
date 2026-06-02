'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { campaignsApi, type AccountCampaign } from '@/lib/api-client';

const CACHE_KEY = ['campaigns'] as const;

// ─── Queries ───

/** Fetch all ad accounts with their campaigns */
export function useCampaigns() {
  return useQuery({
    queryKey: CACHE_KEY,
    queryFn: async () => {
      const { data } = await campaignsApi.list();
      return data;
    },
  });
}

// ─── Mutations ───

/** Create a new campaign — invalidates the campaigns list on success */
export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: Record<string, unknown>) => campaignsApi.create(dto).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: CACHE_KEY }); },
  });
}

/** Delete a campaign — optimistic removal + rollback */
export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => campaignsApi.remove(id).then(r => r.data),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: CACHE_KEY });
      const prev = qc.getQueryData(CACHE_KEY);
      qc.setQueryData(CACHE_KEY, (old: any) =>
        (old || []).map((acct: any) => ({
          ...acct,
          campaigns: acct.campaigns.filter((c: AccountCampaign) => c.id !== id),
        }))
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(CACHE_KEY, ctx.prev);
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: CACHE_KEY }); },
  });
}

/** Clone a campaign */
export function useCloneCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name?: string }) => campaignsApi.clone(id, name).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: CACHE_KEY }); },
  });
}

/** Save campaign as template */
export function useSaveTemplate() {
  return useMutation({
    mutationFn: (dto: { name: string; notes?: string; objective: string; dailyBudget?: number }) =>
      import('@/lib/api-client').then(m => m.templatesApi.create(dto).then(r => r.data)),
  });
}

// ─── Bulk Mutations (optimistic) ───

type BulkAction = 'pause' | 'resume' | 'delete';

function bulkStatusMap(action: BulkAction) {
  if (action === 'pause') return 'PAUSED';
  if (action === 'resume') return 'ACTIVE';
  return null;
}

export function useBulkAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, ids }: { action: BulkAction; ids: string[] }) => {
      const api = action === 'pause' ? campaignsApi.bulkPause
                : action === 'resume' ? campaignsApi.bulkResume
                : campaignsApi.bulkDelete;
      const { data } = await api(ids);
      return data;
    },
    onMutate: async ({ action, ids }) => {
      await qc.cancelQueries({ queryKey: CACHE_KEY });
      const prev = qc.getQueryData(CACHE_KEY);
      const idSet = new Set(ids);

      qc.setQueryData(CACHE_KEY, (old: any) =>
        (old || []).map((acct: any) => ({
          ...acct,
          campaigns: action === 'delete'
            ? acct.campaigns.filter((c: AccountCampaign) => !idSet.has(c.id))
            : acct.campaigns.map((c: AccountCampaign) =>
                idSet.has(c.id) ? { ...c, status: bulkStatusMap(action)! } : c
              ),
        }))
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(CACHE_KEY, ctx.prev);
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: CACHE_KEY }); },
  });
}
