'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { audiencesApi } from '@/lib/api-client';

const CACHE_KEY = ['audiences'] as const;

// ─── Query ───

export function useAudiences() {
  return useQuery({
    queryKey: CACHE_KEY,
    queryFn: async () => {
      const { data } = await audiencesApi.list();
      return data;
    },
  });
}

// ─── Mutations ───

export function useCreateCustomAudience() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { adAccountId: string; name: string; description?: string }) =>
      audiencesApi.createCustom(dto).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: CACHE_KEY }); },
  });
}

export function useCreateLookalikeAudience() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { adAccountId: string; name: string; sourceAudienceId: string; ratio: number }) =>
      audiencesApi.createLookalike(dto).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: CACHE_KEY }); },
  });
}

export function useDeleteAudience() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => audiencesApi.delete(id).then(r => r.data),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: CACHE_KEY });
      const prev = qc.getQueryData(CACHE_KEY);
      qc.setQueryData(CACHE_KEY, (old: any) => (old || []).filter((a: any) => a.id !== id));
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(CACHE_KEY, ctx.prev);
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: CACHE_KEY }); },
  });
}

export function useSyncAudiences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => audiencesApi.sync(accountId).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: CACHE_KEY }); },
  });
}

export function useUploadAudienceCsv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: FormData }) =>
      audiencesApi.uploadCsv(id, formData).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: CACHE_KEY }); },
  });
}
