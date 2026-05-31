'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

// ─── Types ───

interface FbAccount { id: string; facebookUserId: string; facebookName: string; facebookEmail: string | null; tokenExpiresAt: string; status: string; createdAt: string }
interface FbStatus { connected: boolean; data: FbAccount | null }
interface SyncStatus { accounts: number; campaigns: number; adsets: number; ads: number; lastSync: string | null }
interface AdAccount { id: string; accountId: string; name: string; currency: string; timezone: string; status: string; balance: number; spentToday: number; isWarmingUp: boolean; warmupDay: number; createdAt: string; _count: { campaigns: number } }
interface Campaign { id: string; campaignId: string; name: string; objective: string; status: string; dailyBudget: number | null; lifetimeBudget: number | null; spent: number; impressions: number; clicks: number; createdAt: string }
interface InsightRow { id: string; date: string; impressions: number; clicks: number; spend: number; conversions: number; ctr: number; cpc: number; cpm?: number; reach?: number; frequency?: number; cpa?: number; roas?: number }
interface ChartData { date: string; spend: number; impressions: number; clicks: number; ctr: number }
interface WarmupStatus { id: string; name: string; day: number; totalDays: number; progress: number; targetBudget: number; currentBudget: number }

const objLabel = (o: string) => ({ OUTCOME_AWARENESS: 'Awareness', OUTCOME_ENGAGEMENT: 'Engagement', OUTCOME_TRAFFIC: 'Traffic', OUTCOME_LEADS: 'Leads', OUTCOME_SALES: 'Sales', OUTCOME_APP_PROMOTION: 'App Promotion' })[o] || o;
const fmtCurr = (val: number, cur: string) => new Intl.NumberFormat('en', { style: 'currency', currency: cur, minimumFractionDigits: 0 }).format(val);
const fmtNum = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString();

export default function DashboardPage() {
  const [fbStatus, setFbStatus] = useState<FbStatus | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [insightSyncing, setInsightSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [error, setError] = useState('');

  // Insight data
  const [insights, setInsights] = useState<InsightRow[]>([]);
  const [insightAccountId, setInsightAccountId] = useState<string | null>(null);
  const [insightDays, setInsightDays] = useState(7);

  // Summary
  const [summary, setSummary] = useState<{ accounts: number; totalCampaigns: number; activeCampaigns: number; totalSpend: number } | null>(null);

  // Edit/Delete
  const [editCamp, setEditCamp] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: '', status: 'PAUSED', dailyBudget: 0 });
  const [editSaving, setEditSaving] = useState(false);
  const [deleteCamp, setDeleteCamp] = useState<any>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Warmup
  const [warmups, setWarmups] = useState<WarmupStatus[]>([]);
  const [warmupStart, setWarmupStart] = useState<{ accountId: string; accountName: string; currency: string } | null>(null);
  const [warmupTarget, setWarmupTarget] = useState(200);
  const [warmupBusy, setWarmupBusy] = useState(false);

  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const refreshRef = useRef<NodeJS.Timeout | null>(null);
  const [refreshCountdown, setRefreshCountdown] = useState(30);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/'; return; }
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    // Handle Facebook OAuth redirect result
    const params = new URLSearchParams(window.location.search);
    const fbResult = params.get('fb');
    if (fbResult === 'success') {
      setSyncMsg('✅ Facebook account connected successfully!');
      window.history.replaceState({}, '', '/dashboard');
    } else if (fbResult === 'error') {
      const reason = params.get('reason') || 'Unknown error';
      setSyncMsg(`❌ Facebook connection failed: ${reason}`);
      window.history.replaceState({}, '', '/dashboard');
    }

    fetchAll();
    
    // Auto-refresh every 30 seconds
    const refreshData = () => {
      if (autoRefresh) {
        fetchAll();
        setLastUpdated(new Date().toLocaleTimeString('th', { hour: '2-digit', minute: '2-digit' }));
      }
    };
    const interval = setInterval(refreshData, 30000);
    const countdown = setInterval(() => {
      setRefreshCountdown(c => (c <= 1 ? 30 : c - 1));
    }, 1000);
    return () => { clearInterval(interval); clearInterval(countdown); };
  }, [autoRefresh]);

  const connectFacebook = async () => {
    try {
      const { data } = await axios.get('/api/facebook/auth');
      window.location.href = data.url;
    } catch (err: any) {
      setError(`Failed to get Facebook auth URL: ${err?.response?.data?.message || err.message}`);
    }
  };

  const fetchAll = async () => {
    try {
      const [fb, sync, accts, summ, warm] = await Promise.all([
        axios.get('/api/facebook/me'),
        axios.get('/api/sync/status').catch(() => ({ data: null })),
        axios.get('/api/adaccounts').catch(() => ({ data: [] })),
        axios.get('/api/insights/summary').catch(() => ({ data: null })),
        axios.get('/api/warmup/status').catch(() => ({ data: [] })),
      ]);
      setFbStatus(fb.data);
      setSyncStatus(sync.data);
      setAccounts(accts.data);
      setSummary(summ.data);
      setWarmups(warm.data);
    } catch { setError('Failed to load data'); }
    finally { setLoading(false); }
  };

  const triggerSync = async () => {
    setSyncing(true); setSyncMsg('');
    try {
      const { data } = await axios.post('/api/sync/trigger');
      setSyncMsg(`✅ Synced ${data.accountsSynced} accounts, ${data.campaignsSynced} campaigns`);
      await fetchAll();
    } catch (err: any) {
      setSyncMsg(`❌ Sync failed: ${err?.response?.data?.message || err.message}`);
    } finally { setSyncing(false); }
  };

  const syncInsights = async () => {
    setInsightSyncing(true); setSyncMsg('');
    try {
      const { data } = await axios.post('/api/insights/sync');
      setSyncMsg(`✅ Insights synced: ${data.campaignDays} campaign-days, ${data.accountInsightDays} account-days`);
      if (insightAccountId) await loadInsights(insightAccountId);
      await fetchAll();
    } catch (err: any) {
      setSyncMsg(`❌ Insights sync failed: ${err?.response?.data?.message || err.message}`);
    } finally { setInsightSyncing(false); }
  };

  const loadCampaigns = async (accountId: string) => {
    setSelectedAccountId(accountId);
    try { const { data } = await axios.get(`/api/adaccounts/${accountId}/campaigns`); setCampaigns(data); }
    catch { setCampaigns([]); }
    await loadInsights(accountId);
  };

  const loadInsights = async (accountId: string) => {
    setInsightAccountId(accountId);
    try {
      const { data } = await axios.get(`/api/insights/accounts/${accountId}?days=${insightDays}`);
      setInsights(data);
    } catch { setInsights([]); }
  };

  const openEdit = (camp: any) => {
    setEditCamp(camp);
    setEditForm({ name: camp.name, status: camp.status, dailyBudget: camp.dailyBudget || 0 });
    setEditError('');
  };

  const saveEdit = async () => {
    if (!editCamp) return;
    setEditSaving(true); setEditError('');
    try {
      const payload: any = {};
      if (editForm.name !== editCamp.name) payload.name = editForm.name;
      if (editForm.status !== editCamp.status) payload.status = editForm.status;
      if (Number(editForm.dailyBudget) !== Number(editCamp.dailyBudget)) payload.dailyBudget = Number(editForm.dailyBudget);
      if (Object.keys(payload).length === 0) { setEditCamp(null); return; }
      await axios.patch(`/api/campaigns/${editCamp.id}`, payload);
      setEditCamp(null);
      if (selectedAccountId) loadCampaigns(selectedAccountId);
    } catch (err: any) {
      setEditError(err?.response?.data?.message || err.message);
    } finally { setEditSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteCamp) return;
    setDeleteSaving(true);
    try {
      await axios.delete(`/api/campaigns/${deleteCamp.id}`);
      setDeleteCamp(null);
      if (selectedAccountId) loadCampaigns(selectedAccountId);
    } catch (err: any) {
      setDeleteCamp(null);
      setSyncMsg(`❌ Delete failed: ${err?.response?.data?.message || err.message}`);
    } finally { setDeleteSaving(false); }
  };

  // ─── Warmup actions ───

  const startWarmup = async () => {
    if (!warmupStart) return;
    setWarmupBusy(true);
    try {
      const { data } = await axios.post(`/api/warmup/start/${warmupStart.accountId}`, { targetDailyBudget: warmupTarget });
      setSyncMsg(`✅ ${data.message} — budget: ${data.budget}`);
      setWarmupStart(null);
      await fetchAll();
    } catch (err: any) {
      setSyncMsg(`❌ Warmup start failed: ${err?.response?.data?.message || err.message}`);
    } finally { setWarmupBusy(false); }
  };

  const stopWarmup = async (accountId: string) => {
    setWarmupBusy(true);
    try {
      await axios.post(`/api/warmup/stop/${accountId}`);
      setSyncMsg('✅ Warmup stopped');
      await fetchAll();
    } catch (err: any) {
      setSyncMsg(`❌ Warmup stop failed: ${err?.response?.data?.message || err.message}`);
    } finally { setWarmupBusy(false); }
  };

  const warmupTick = async () => {
    setWarmupBusy(true);
    try {
      const { data } = await axios.post('/api/warmup/tick');
      if (data.message) { setSyncMsg(`ℹ️ ${data.message}`); }
      else { setSyncMsg(`✅ Warmup advanced — ${data.results?.map((r: any) => `${r.name}: ${r.status}`).join(', ') || 'done'}`); }
      await fetchAll();
    } catch (err: any) {
      setSyncMsg(`❌ Warmup tick failed: ${err?.response?.data?.message || err.message}`);
    } finally { setWarmupBusy(false); }
  };

  const chartData: ChartData[] = insights.map(r => ({
    date: new Date(r.date).toLocaleDateString('th', { month: 'short', day: 'numeric' }),
    spend: Number(r.spend),
    impressions: r.impressions,
    clicks: r.clicks,
    ctr: Number(r.ctr) * 100,
  }));

  const totals = chartData.reduce((acc, d) => ({
    spend: acc.spend + d.spend,
    impressions: acc.impressions + d.impressions,
    clicks: acc.clicks + d.clicks,
    ctr: chartData.length > 0 ? chartData.reduce((s, d) => s + d.ctr, 0) / chartData.length : 0,
  }), { spend: 0, impressions: 0, clicks: 0, ctr: 0 });

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><p className="text-gray-500">Loading...</p></div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold">FB Ads Platform</h1>
            <nav className="flex gap-4 text-sm">
              <a href="/dashboard" className="text-blue-600 font-medium hover:text-blue-800">Dashboard</a>
              <a href="/dashboard/all-campaigns" className="text-gray-500 hover:text-gray-800">📋 All Campaigns</a>
              <a href="/dashboard/campaigns/new" className="text-gray-500 hover:text-gray-800">🎯 New Campaign</a>
              <a href="/dashboard/rules" className="text-gray-500 hover:text-gray-800">⚡ Rules</a>
              <a href="/dashboard/schedules" className="text-gray-500 hover:text-gray-800">📅 Schedules</a>
              <a href="/dashboard/templates" className="text-gray-500 hover:text-gray-800">📦 Templates</a>
              <a href="/dashboard/analytics" className="text-gray-500 hover:text-gray-800">📊 Analytics</a>
              <a href="/dashboard/audiences" className="text-gray-500 hover:text-gray-800">🎯 Audiences</a>
              <a href="/dashboard/abtest" className="text-gray-500 hover:text-gray-800">🔁 A/B Test</a>
              <a href="/dashboard/budget" className="text-gray-500 hover:text-gray-800">💰 Budget</a>
              <a href="/dashboard/notifications" className="text-gray-500 hover:text-gray-800">🔔 Alerts</a>
              <a href="/dashboard/creatives" className="text-gray-500 hover:text-gray-800">🎨 Creatives</a>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => { localStorage.removeItem('token'); window.location.href = '/'; }}
              className="text-sm text-gray-500 hover:text-red-600">Sign Out</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Dashboard</h2>
          {fbStatus?.connected && (
            <div className="flex gap-2">
              <button onClick={triggerSync} disabled={syncing}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                {syncing ? 'Syncing...' : '🔄 Sync Now'}
              </button>
              <button onClick={syncInsights} disabled={insightSyncing}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium">
                {insightSyncing ? 'Loading...' : '📊 Get Insights'}
              </button>
            </div>
          )}
        </div>
        {syncMsg && <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${syncMsg.includes('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{syncMsg}</div>}
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">{error}</div>}

        {/* FB Connection */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Facebook Connection</h3>
          {fbStatus?.connected ? (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg">{fbStatus.data?.facebookName?.charAt(0) || '?'}</div>
              <div className="flex-1"><p className="font-medium">{fbStatus.data?.facebookName}</p><p className="text-sm text-gray-500">{fbStatus.data?.facebookEmail || 'No email'}</p></div>
              <span className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded-full">Connected</span>
              <button onClick={async () => {
                if (!confirm('Disconnect Facebook account? This will remove all synced accounts and pages.')) return;
                try {
                  await axios.post('/api/facebook/disconnect');
                  setSyncMsg('✅ Disconnected. Refresh to reconnect with new permissions.');
                  setTimeout(() => { window.location.reload(); }, 1500);
                } catch (err: any) {
                  setSyncMsg('❌ Disconnect failed: ' + (err?.response?.data?.message || err.message));
                }
              }} className="text-xs text-red-500 hover:text-red-700 font-medium border border-red-200 px-3 py-1 rounded-lg hover:bg-red-50 ml-2">
                Disconnect
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-gray-500">Connect Facebook to manage ad accounts.</p>
              <button onClick={connectFacebook}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
                🔗 Connect Facebook
              </button>
            </div>
          )}
        </div>

        {fbStatus?.connected && (
          <>
            {/* Summary Stats */}
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl shadow-sm border p-5"><p className="text-xs text-gray-500 uppercase">Ad Accounts</p><p className="text-2xl font-bold">{summary.accounts}</p></div>
                <div className="bg-white rounded-xl shadow-sm border p-5"><p className="text-xs text-gray-500 uppercase">Campaigns</p><p className="text-2xl font-bold">{summary.totalCampaigns}</p></div>
                <div className="bg-white rounded-xl shadow-sm border p-5"><p className="text-xs text-gray-500 uppercase">Active</p><p className="text-2xl font-bold">{summary.activeCampaigns}</p></div>
                <div className="bg-white rounded-xl shadow-sm border p-5"><p className="text-xs text-gray-500 uppercase">Total Spend</p><p className="text-2xl font-bold">${fmtNum(summary.totalSpend)}</p></div>
              </div>
            )}

            {/* Sync Status */}
            {syncStatus && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl shadow-sm border p-5"><p className="text-xs text-gray-500 uppercase">Ad Sets</p><p className="text-3xl font-bold">{syncStatus.adsets}</p></div>
                <div className="bg-white rounded-xl shadow-sm border p-5"><p className="text-xs text-gray-500 uppercase">Ads</p><p className="text-3xl font-bold">{syncStatus.ads}</p></div>
                {syncStatus.lastSync && <div className="bg-white rounded-xl shadow-sm border p-5 col-span-2"><p className="text-xs text-gray-500 uppercase">Last Sync</p><p className="text-lg font-bold text-gray-600">{new Date(syncStatus.lastSync).toLocaleString('th', { dateStyle: 'medium', timeStyle: 'short' })}</p></div>}
              </div>
            )}

            {/* Charts — visible when insights loaded */}
            {insights.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">📈 Performance (last {insightDays} days)</h3>
                  <div className="grid grid-cols-4 gap-4 text-center text-sm">
                    <div><p className="text-gray-500 text-xs">Spend</p><p className="font-semibold">${fmtNum(totals.spend)}</p></div>
                    <div><p className="text-gray-500 text-xs">Impressions</p><p className="font-semibold">{fmtNum(totals.impressions)}</p></div>
                    <div><p className="text-gray-500 text-xs">Clicks</p><p className="font-semibold">{fmtNum(totals.clicks)}</p></div>
                    <div><p className="text-gray-500 text-xs">CTR</p><p className="font-semibold">{totals.ctr.toFixed(2)}%</p></div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="spend" stroke="#3b82f6" strokeWidth={2} name="Spend" dot={false} />
                    <Line type="monotone" dataKey="impressions" stroke="#8b5cf6" strokeWidth={2} name="Impressions" dot={false} yAxisId={0} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="mt-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="clicks" fill="#10b981" name="Clicks" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="ctr" fill="#f59e0b" name="CTR %" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Ad Accounts + Campaigns */}
            <div className="bg-white rounded-xl shadow-sm border mb-6">
              <div className="px-6 py-4 border-b"><h3 className="text-lg font-semibold">Ad Accounts</h3></div>
              {accounts.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-400">No ad accounts yet. Click &quot;Sync Now&quot; to import.</div>
              ) : (
                <div className="divide-y">
                  {accounts.map((acct) => (
                    <div key={acct.id}>
                      <div className="px-6 py-4 hover:bg-slate-50 cursor-pointer" onClick={() => loadCampaigns(acct.id)}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{acct.name}</p>
                            <p className="text-sm text-gray-500">ID: {acct.accountId} · {acct.currency} · {fmtCurr(acct.balance, acct.currency)}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-500">{acct._count.campaigns} campaigns</span>
                            <span className={`px-2 py-0.5 text-xs rounded-full ${acct.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{acct.status}</span>
                            {acct.isWarmingUp ? (
                              <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full">Warmup D{acct.warmupDay}</span>
                            ) : (
                              <button onClick={(e) => { e.stopPropagation(); setWarmupStart({ accountId: acct.id, accountName: acct.name, currency: acct.currency }); setWarmupTarget(200); }}
                                className="px-2 py-0.5 text-xs bg-orange-50 text-orange-600 rounded-full hover:bg-orange-100 font-medium">
                                🔥 Warmup
                              </button>
                            )}
                            <svg className={`w-4 h-4 text-gray-400 transition-transform ${selectedAccountId === acct.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          </div>
                        </div>
                      </div>
                      {selectedAccountId === acct.id && (
                        <div className="bg-slate-50 border-t">
                          {campaigns.length === 0 ? (
                            <div className="px-6 py-4 text-sm text-gray-400 text-center">No campaigns found</div>
                          ) : (
                            <div className="divide-y">
                              {campaigns.map((camp) => (
                                <div key={camp.id} className="px-6 py-3 ml-4">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm font-medium">{camp.name}</p>
                                      <p className="text-xs text-gray-400">{objLabel(camp.objective)} · {camp.dailyBudget ? fmtCurr(camp.dailyBudget, acct.currency) + '/day' : 'No daily budget'}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className={`px-2 py-0.5 text-xs rounded-full ${camp.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : camp.status === 'PAUSED' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>{camp.status}</span>
                                      <button onClick={(e) => { e.stopPropagation(); openEdit(camp); }} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                                      <button onClick={(e) => { e.stopPropagation(); setDeleteCamp(camp); }} className="text-xs text-red-500 hover:text-red-700 font-medium">Del</button>
                                      <a href={`${axios.defaults.baseURL || ''}/api/reports/campaigns/${camp.id}/excel`} download onClick={(e) => e.stopPropagation()}
                                        className="text-xs text-purple-500 hover:text-purple-700 font-medium">📥 CSV</a>
                                      <a href={`${axios.defaults.baseURL || ''}/api/reports/campaigns/${camp.id}/html`} target="_blank" onClick={(e) => e.stopPropagation()}
                                        className="text-xs text-purple-500 hover:text-purple-700 font-medium">📄 HTML</a>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Warmup Section */}
            <div className="bg-white rounded-xl shadow-sm border mb-6">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h3 className="text-lg font-semibold">🔥 Account Warmup</h3>
                <div className="flex gap-2">
                  {warmups.length > 0 && (
                    <button onClick={warmupTick} disabled={warmupBusy}
                      className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full hover:bg-purple-200 disabled:opacity-50 font-medium">
                      ⏭️ Advance Day (Manual)
                    </button>
                  )}
                </div>
              </div>
              {warmups.length === 0 ? (
                <div className="px-6 py-6 text-center text-gray-400 text-sm">
                  No accounts warming up. Start a warmup on any ad account to gradually scale budget over 7 days.
                </div>
              ) : (
                <div className="divide-y">
                  {warmups.map((w) => (
                    <div key={w.id} className="px-6 py-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium">{w.name}</p>
                          <p className="text-xs text-gray-500">Day {w.day}/{w.totalDays} · ${w.currentBudget}/day → Target ${w.targetBudget}/day</p>
                        </div>
                        <button onClick={() => stopWarmup(w.id)} disabled={warmupBusy}
                          className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50">
                          Stop Warmup
                        </button>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-gradient-to-r from-orange-400 to-red-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${w.progress}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
        {!fbStatus?.connected && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-6 py-4 rounded-lg">
            <p className="font-medium">Getting Started</p>
            <p className="text-sm mt-1">Connect your Facebook account above to start managing ads.</p>
          </div>
        )}
      </main>

      {/* Edit Modal */}
      {editCamp && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setEditCamp(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">✏️ Edit Campaign</h3>
            {editError && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-3">{editError}</div>}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">Name</label>
                <input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Status</label>
                <select value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="ACTIVE">Active</option>
                  <option value="PAUSED">Paused</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Daily Budget</label>
                <input type="number" value={editForm.dailyBudget} onChange={e => setEditForm({...editForm, dailyBudget: Number(e.target.value) || 0})}
                  className="w-full border rounded-lg px-3 py-2 text-sm" min={1} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEditCamp(null)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={saveEdit} disabled={editSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                {editSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
