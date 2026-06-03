// Typed API client — wraps the axios instance with typed return values
// All endpoints return the raw axios Response<data> so hooks can extract .data

import api from './api';

// ─── Campaigns ───

export interface AccountCampaign {
  id: string; campaignId: string; name: string; objective: string; status: string;
  dailyBudget: number | null; spent: number; impressions: number; clicks: number;
  conversions: number; ctr: number;
}

export interface AdAccountWithCampaigns {
  id: string; name: string; currency: string; campaigns: AccountCampaign[];
}

export const campaignsApi = {
  list: () => api.get<AdAccountWithCampaigns[]>('/api/campaigns/accounts'),
  uploadAdImage: (adAccountId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post<{ imageHash: string }>(
      `/api/campaigns/accounts/${adAccountId}/ad-image`,
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
  },
  create: (dto: Record<string, unknown>) => api.post('/api/campaigns', dto),
  remove: (id: string) => api.delete(`/api/campaigns/${id}`),
  clone: (id: string, name?: string) => api.post(`/api/campaigns/${id}/clone`, { name }),
  bulkPause: (ids: string[]) => api.post('/api/campaigns/bulk/pause', { ids }),
  bulkResume: (ids: string[]) => api.post('/api/campaigns/bulk/resume', { ids }),
  bulkDelete: (ids: string[]) => api.post('/api/campaigns/bulk/delete', { ids }),
};

// ─── AdSets ───

export interface AdSetItem {
  id: string; adsetId: string; name: string; status: string; dailyBudget: number;
  impressions: number; clicks: number; spend: number; conversions: number;
  ctr: number; optimizationGoal: string | null; bidStrategy: string | null; adCount: number;
}

export const adsetsApi = {
  byCampaign: (campaignId: string) => api.get<{ adsets: AdSetItem[] }>(`/api/adsets/campaign/${campaignId}`),
  pause: (id: string) => api.post(`/api/adsets/${id}/pause`),
  resume: (id: string) => api.post(`/api/adsets/${id}/resume`),
  updateBudget: (id: string, dailyBudget: number) => api.patch(`/api/adsets/${id}/budget`, { dailyBudget }),
};

// ─── Ad Accounts ───

export interface AdAccount {
  id: string; accountId: string; name: string; currency: string; timezone?: string;
  status: string; balance?: number; spentToday?: number; isWarmingUp?: boolean;
  warmupDay?: number; createdAt: string; _count?: { campaigns: number };
}

export const accountsApi = {
  list: () => api.get<AdAccount[]>('/api/adaccounts'),
};

// ─── Audiences ───

export interface Audience {
  id: string; adAccountId: string; accountName: string; fbAudienceId: string;
  name: string; type: string; subtype: string | null; description: string | null;
  approximateCount: number | null; status: string; sourceAudienceId: string | null;
  lookalikeRatio: number | null; createdAt: string;
}

export interface AutomationApproval {
  id: string;
  source: string;
  sourceId: string | null;
  action: string;
  payload: Record<string, unknown>;
  status: string;
  reason: string | null;
  createdAt: string;
}

export const approvalsApi = {
  list: (status = 'PENDING') =>
    api.get<AutomationApproval[]>('/api/approvals', { params: { status } }),
  approve: (id: string) => api.post(`/api/approvals/${id}/approve`),
  reject: (id: string, note?: string) => api.post(`/api/approvals/${id}/reject`, { note }),
};

export const audiencesApi = {
  list: () => api.get<Audience[]>('/api/audiences'),
  createCustom: (dto: { adAccountId: string; name: string; description?: string }) =>
    api.post('/api/audiences/create-custom', dto),
  createLookalike: (dto: { adAccountId: string; name: string; sourceAudienceId: string; ratio: number }) =>
    api.post('/api/audiences/create-lookalike', dto),
  delete: (id: string) => api.delete(`/api/audiences/${id}`),
  sync: (accountId: string) => api.get(`/api/audiences/sync/${accountId}`),
  uploadCsv: (id: string, formData: FormData) =>
    api.post(`/api/audiences/${id}/upload-users`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

// ─── Facebook ───

export interface FbAccount {
  id: string; facebookUserId: string; facebookName: string; facebookEmail: string | null;
  tokenExpiresAt: string; status: string; createdAt: string;
}

export const facebookApi = {
  getAuthUrl: () => api.get<{ url: string }>('/api/facebook/auth'),
  me: () => api.get<{ connected: boolean; data: FbAccount | null }>('/api/facebook/me'),
  disconnect: () => api.post('/api/facebook/disconnect'),
  syncPages: () => api.post('/api/facebook/sync-pages'),
};

// ─── Sync ───

export const syncApi = {
  trigger: () => api.post('/api/sync/trigger'),
  status: () =>
    api.get<{
      accounts: number;
      campaigns: number;
      adsets: number;
      ads: number;
      lastSync: string | null;
      lastSyncSource?: string | null;
    }>('/api/sync/status'),
};

// ─── Insights ───

export const insightsApi = {
  sync: () => api.post('/api/insights/sync'),
  syncAccount: (adAccountId: string) => api.post(`/api/insights/sync/${adAccountId}`),
  byAccount: (adAccountId: string, days: number) =>
    api.get(`/api/insights/accounts/${adAccountId}?days=${days}`),
  summary: () => api.get<{ accounts: number; totalCampaigns: number; activeCampaigns: number; totalSpend: number }>('/api/insights/summary'),
};

// ─── Warmup ───

export const warmupApi = {
  status: () => api.get('/api/warmup/status'),
  start: (id: string, targetDailyBudget: number) => api.post(`/api/warmup/start/${id}`, { targetDailyBudget }),
  stop: (id: string) => api.post(`/api/warmup/stop/${id}`),
  tick: () => api.post('/api/warmup/tick'),
};

// ─── Targeting ───

export const targetingApi = {
  interests: (query: string, adAccountId?: string) =>
    api.get(`/api/targeting/interests?q=${encodeURIComponent(query)}${adAccountId ? `&adAccountId=${adAccountId}` : ''}`),
  locations: (query: string) => api.get(`/api/targeting/locations?q=${encodeURIComponent(query)}`),
  demographics: (type: string, query?: string) =>
    api.get(`/api/targeting/demographics/${type}${query ? `?q=${encodeURIComponent(query)}` : ''}`),
  estimate: (targeting: Record<string, unknown>, adAccountId?: string) =>
    api.post('/api/targeting/estimate', { targeting, adAccountId }),
};

// ─── Templates ───

export interface CreateTemplatePayload {
  name: string;
  notes?: string;
  objective: string;
  dailyBudget?: number;
  targetSpec?: Record<string, unknown>;
  adSetName?: string;
  optimizationGoal?: string;
  billingEvent?: string;
  adName?: string;
  creativeConfig?: Record<string, unknown>;
}

export interface CampaignTemplate extends CreateTemplatePayload {
  id: string;
  useCount?: number;
  lastUsedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export const templatesApi = {
  list: () => api.get<CampaignTemplate[]>('/api/templates'),
  get: (id: string) => api.get<CampaignTemplate>(`/api/templates/${id}`),
  create: (dto: CreateTemplatePayload) => api.post('/api/templates', dto),
  update: (id: string, dto: Partial<CreateTemplatePayload>) => api.patch(`/api/templates/${id}`, dto),
  remove: (id: string) => api.delete(`/api/templates/${id}`),
  apply: (id: string) => api.post(`/api/templates/${id}/apply`),
};

// ─── Creatives ───

export interface CreativeItem {
  id: string;
  name: string;
  type: string;
  status: string;
  primaryText: string | null;
  headline: string | null;
  description: string | null;
  callToAction: string | null;
  linkUrl: string | null;
  imageUrl: string | null;
  fbCreativeId: string | null;
  usedCount: number;
  pageId: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  campaigns: { campaign: { id: string; name: string } }[];
}

export interface FbPageItem {
  id: string;
  pageId: string;
  name: string;
  category: string | null;
  tasks: string[];
}

export const creativesApi = {
  list: () => api.get<CreativeItem[]>('/api/creatives'),
  create: (dto: Record<string, unknown>) => api.post('/api/creatives', dto),
  update: (id: string, dto: Record<string, unknown>) => api.patch(`/api/creatives/${id}`, dto),
  remove: (id: string) => api.delete(`/api/creatives/${id}`),
  upload: (id: string, formData: FormData) =>
    api.post(`/api/creatives/${id}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  clone: (id: string, name?: string) => api.post(`/api/creatives/${id}/clone`, { name }),
  pages: () => api.get<FbPageItem[]>('/api/creatives/pages'),
  pagePosts: (pageId: string) => api.get(`/api/creatives/pages/${pageId}/posts`),
  importPost: (
    pageId: string,
    postId: string,
    body?: { message?: string; imageUrl?: string; permalinkUrl?: string },
  ) => api.post(`/api/creatives/import/${pageId}/${postId}`, body),
  fbCreate: (id: string, adAccountId: string) =>
    api.post<{ fbCreativeId: string }>(`/api/creatives/${id}/fb-create/${adAccountId}`),
  postToPage: (id: string, pageId: string) =>
    api.post(`/api/creatives/${id}/fb-post/${pageId}`),
};
