'use client';

import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import Shell from '@/components/Shell';
import PageHeader from '@/components/PageHeader';
import { objLabel, fmtCurr, fmtNum } from '@/lib/utils';

// ─── Types ───

interface FbAccount { id: string; facebookUserId: string; facebookName: string; facebookEmail: string | null; tokenExpiresAt: string; status: string; createdAt: string }
interface FbStatus { connected: boolean; data: FbAccount | null }
interface SyncStatus { accounts: number; campaigns: number; adsets: number; ads: number; lastSync: string | null }
interface AdAccount { id: string; accountId: string; name: string; currency: string; timezone: string; status: string; balance: number; spentToday: number; isWarmingUp: boolean; warmupDay: number; createdAt: string; _count: { campaigns: number } }
interface Campaign { id: string; campaignId: string; name: string; objective: string; status: string; dailyBudget: number | null; lifetimeBudget: number | null; spent: number; impressions: number; clicks: number; createdAt: string }
interface InsightRow { id: string; date: string; impressions: number; clicks: number; spend: number; conversions: number; ctr: number; cpc: number; cpm?: number; reach?: number; frequency?: number; cpa?: number; roas?: number }
interface ChartData { date: string; spend: number; impressions: number; clicks: number; ctr: number }
interface WarmupStatus { id: string; name: string; day: number; totalDays: number; progress: number; targetBudget: number; currentBudget: number }

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

  if (loading) return (
    <Shell>
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-ink-200">Loading...</p>
      </div>
    </Shell>
  );

  return (
    <Shell>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <PageHeader title="Dashboard" />
          {fbStatus?.connected && (
            <div className="flex gap-2">
              <button onClick={triggerSync} disabled={syncing}
                className="btn-primary btn-sm">
                {syncing ? 'Syncing...' : '🔄 Sync Now'}
              </button>
              <button onClick={syncInsights} disabled={insightSyncing}
                className="btn-primary btn-sm" style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa', boxShadow: '0px 0px 0px 1px rgba(124,58,237,0.3)' }}>
                {insightSyncing ? 'Loading...' : '📊 Get Insights'}
              </button>
            </div>
          )}
        </div>
        {syncMsg && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${
            syncMsg.includes('✅') || syncMsg.includes('ℹ️')
              ? 'text-success' + (syncMsg.includes('ℹ️') ? ' text-ink-200' : '')
              : 'text-danger'
          }`}
            style={{
              background: syncMsg.includes('✅') || syncMsg.includes('ℹ️')
                ? 'rgba(34,197,94,0.08)'
                : syncMsg.includes('❌')
                  ? 'rgba(239,68,68,0.08)'
                  : 'rgba(255,255,255,0.05)',
              boxShadow: syncMsg.includes('✅')
                ? '0px 0px 0px 1px rgba(34,197,94,0.2)'
                : syncMsg.includes('❌')
                  ? '0px 0px 0px 1px rgba(239,68,68,0.2)'
                  : '0px 0px 0px 1px rgba(255,255,255,0.06)',
            }}
          >{syncMsg}</div>
        )}
        {error && <div className="mb-4 px-4 py-3 rounded-lg text-sm text-danger" style={{ background: 'rgba(239,68,68,0.08)', boxShadow: '0px 0px 0px 1px rgba(239,68,68,0.2)' }}>{error}</div>}

        {/* FB Connection */}
        <div className="card p-5 mb-6">
          <h3 className="text-sm font-semibold mb-4 text-ink">Facebook Connection</h3>
          {fbStatus?.connected ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                style={{ background: 'rgba(0,112,243,0.15)', color: '#0070f3' }}>
                {fbStatus.data?.facebookName?.charAt(0) || '?'}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-ink">{fbStatus.data?.facebookName}</p>
                <p className="text-xs text-ink-200">{fbStatus.data?.facebookEmail || 'No email'}</p>
              </div>
              <span className="badge-success">Connected</span>
              <button onClick={async () => {
                if (!confirm('Disconnect Facebook account? This will remove all synced accounts and pages.')) return;
                try {
                  await axios.post('/api/facebook/disconnect');
                  setSyncMsg('✅ Disconnected. Refresh to reconnect with new permissions.');
                  setTimeout(() => { window.location.reload(); }, 1500);
                } catch (err: any) {
                  setSyncMsg('❌ Disconnect failed: ' + (err?.response?.data?.message || err.message));
                }
              }} className="text-xs text-danger font-medium hover:opacity-80 border-none bg-transparent cursor-pointer ml-2"
                style={{ letterSpacing: '-0.01em' }}>
                Disconnect
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-sm text-ink-200">Connect Facebook to manage ad accounts.</p>
              <button onClick={connectFacebook} className="btn-primary btn-sm">
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
                {[
                  { label: 'Ad Accounts', value: summary.accounts.toString() },
                  { label: 'Campaigns', value: summary.totalCampaigns.toString() },
                  { label: 'Active', value: summary.activeCampaigns.toString() },
                  { label: 'Total Spend', value: `$${fmtNum(summary.totalSpend)}` },
                ].map(s => (
                  <div key={s.label} className="card p-5">
                    <p className="text-xs text-ink-200 uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>{s.label}</p>
                    <p className="text-2xl font-bold mt-1 text-ink">{s.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Sync Status */}
            {syncStatus && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="card p-5">
                  <p className="text-xs text-ink-200 uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>Ad Sets</p>
                  <p className="text-3xl font-bold mt-1 text-ink">{syncStatus.adsets}</p>
                </div>
                <div className="card p-5">
                  <p className="text-xs text-ink-200 uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>Ads</p>
                  <p className="text-3xl font-bold mt-1 text-ink">{syncStatus.ads}</p>
                </div>
                {syncStatus.lastSync && (
                  <div className="card p-5 col-span-2">
                    <p className="text-xs text-ink-200 uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>Last Sync</p>
                    <p className="text-lg font-bold mt-1 text-ink">
                      {new Date(syncStatus.lastSync).toLocaleString('th', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Charts */}
            {insights.length > 0 && (
              <div className="card p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-ink">📈 Performance (last {insightDays} days)</h3>
                  <div className="grid grid-cols-4 gap-6 text-center text-sm">
                    <div><p className="text-ink-200 text-xs">Spend</p><p className="font-semibold text-ink">${fmtNum(totals.spend)}</p></div>
                    <div><p className="text-ink-200 text-xs">Impressions</p><p className="font-semibold text-ink">{fmtNum(totals.impressions)}</p></div>
                    <div><p className="text-ink-200 text-xs">Clicks</p><p className="font-semibold text-ink">{fmtNum(totals.clicks)}</p></div>
                    <div><p className="text-ink-200 text-xs">CTR</p><p className="font-semibold text-ink">{totals.ctr.toFixed(2)}%</p></div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222222" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#888888' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#888888' }} />
                    <Tooltip
                      contentStyle={{ background: '#111111', border: '1px solid #222222', borderRadius: '8px', color: '#ededed' }}
                    />
                    <Legend formatter={(value) => <span style={{ color: '#ededed' }}>{value}</span>} />
                    <Line type="monotone" dataKey="spend" stroke="#3b82f6" strokeWidth={2} name="Spend" dot={false} />
                    <Line type="monotone" dataKey="impressions" stroke="#8b5cf6" strokeWidth={2} name="Impressions" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="mt-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222222" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#888888' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#888888' }} />
                      <Tooltip
                        contentStyle={{ background: '#111111', border: '1px solid #222222', borderRadius: '8px', color: '#ededed' }}
                      />
                      <Legend formatter={(value) => <span style={{ color: '#ededed' }}>{value}</span>} />
                      <Bar dataKey="clicks" fill="#10b981" name="Clicks" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="ctr" fill="#f59e0b" name="CTR %" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Ad Accounts + Campaigns */}
            <div className="card mb-6">
              <div className="px-5 py-3.5" style={{ boxShadow: 'inset 0 -1px 0 0 rgba(255,255,255,0.06)' }}>
                <h3 className="text-sm font-semibold text-ink">Ad Accounts</h3>
              </div>
              {accounts.length === 0 ? (
                <div className="px-5 py-8 text-center text-ink-300 text-sm">No ad accounts yet. Click "Sync Now" to import.</div>
              ) : (
                <div>
                  {accounts.map((acct) => (
                    <div key={acct.id}>
                      <div
                        className="px-5 py-3.5 cursor-pointer transition-colors hover:bg-surface-100"
                        onClick={() => loadCampaigns(acct.id)}
                        style={{ boxShadow: 'inset 0 -1px 0 0 rgba(255,255,255,0.06)' }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-ink">{acct.name}</p>
                            <p className="text-xs text-ink-200 mt-0.5">ID: {acct.accountId} · {acct.currency} · {fmtCurr(acct.balance, acct.currency)}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-ink-200">{acct._count.campaigns} campaigns</span>
                            <span className={`badge-${acct.status === 'ACTIVE' ? 'success' : 'warning'}`}>{acct.status}</span>
                            {acct.isWarmingUp ? (
                              <span className="text-xs px-2 py-0.5 rounded-full"
                                style={{ background: 'rgba(251,146,60,0.1)', color: '#fb923c', boxShadow: '0 0 0 1px rgba(251,146,60,0.25)' }}>
                                Warmup D{acct.warmupDay}
                              </span>
                            ) : (
                              <button onClick={(e) => { e.stopPropagation(); setWarmupStart({ accountId: acct.id, accountName: acct.name, currency: acct.currency }); setWarmupTarget(200); }}
                                className="text-xs font-medium px-2 py-0.5 rounded-full cursor-pointer"
                                style={{ background: 'rgba(251,146,60,0.08)', color: '#fb923c', boxShadow: '0 0 0 1px rgba(251,146,60,0.2)', letterSpacing: '-0.01em' }}>
                                🔥 Warmup
                              </button>
                            )}
                            <svg className={`w-4 h-4 text-ink-200 transition-transform ${selectedAccountId === acct.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          </div>
                        </div>
                      </div>
                      {selectedAccountId === acct.id && (
                        <div style={{ background: 'rgba(255,255,255,0.02)' }}>
                          {campaigns.length === 0 ? (
                            <div className="px-5 py-4 text-sm text-ink-200 text-center">No campaigns found</div>
                          ) : (
                            <div>
                              {campaigns.map((camp) => (
                                <div key={camp.id} className="px-5 py-3 ml-4" style={{ boxShadow: 'inset 0 -1px 0 0 rgba(255,255,255,0.04)' }}>
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm font-medium text-ink">{camp.name}</p>
                                      <p className="text-xs text-ink-200 mt-0.5">{objLabel(camp.objective)} · {camp.dailyBudget ? fmtCurr(camp.dailyBudget, acct.currency) + '/day' : 'No daily budget'}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className={`badge-${camp.status === 'ACTIVE' ? 'success' : camp.status === 'PAUSED' ? 'warning' : 'ink'}`}>{camp.status}</span>
                                      <button onClick={(e) => { e.stopPropagation(); openEdit(camp); }} className="text-xs text-accent font-medium hover:opacity-80 bg-transparent border-none cursor-pointer" style={{ letterSpacing: '-0.01em' }}>Edit</button>
                                      <button onClick={(e) => { e.stopPropagation(); setDeleteCamp(camp); }} className="text-xs text-danger font-medium hover:opacity-80 bg-transparent border-none cursor-pointer" style={{ letterSpacing: '-0.01em' }}>Del</button>
                                      <a href={`${axios.defaults.baseURL || ''}/api/reports/campaigns/${camp.id}/excel`} download onClick={(e) => e.stopPropagation()}
                                        className="text-xs font-medium" style={{ color: '#a78bfa', letterSpacing: '-0.01em' }}>📥 CSV</a>
                                      <a href={`${axios.defaults.baseURL || ''}/api/reports/campaigns/${camp.id}/html`} target="_blank" onClick={(e) => e.stopPropagation()}
                                        className="text-xs font-medium" style={{ color: '#a78bfa', letterSpacing: '-0.01em' }}>📄 HTML</a>
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
            <div className="card mb-6">
              <div className="px-5 py-3.5 flex items-center justify-between" style={{ boxShadow: 'inset 0 -1px 0 0 rgba(255,255,255,0.06)' }}>
                <h3 className="text-sm font-semibold text-ink">🔥 Account Warmup</h3>
                <div className="flex gap-2">
                  {warmups.length > 0 && (
                    <button onClick={warmupTick} disabled={warmupBusy}
                      className="text-xs font-medium px-3 py-1.5 rounded-full disabled:opacity-50 cursor-pointer"
                      style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa', boxShadow: '0 0 0 1px rgba(139,92,246,0.2)', letterSpacing: '-0.01em' }}>
                      ⏭️ Advance Day (Manual)
                    </button>
                  )}
                </div>
              </div>
              {warmups.length === 0 ? (
                <div className="px-5 py-6 text-center text-ink-200 text-sm">
                  No accounts warming up. Start a warmup on any ad account to gradually scale budget over 7 days.
                </div>
              ) : (
                <div>
                  {warmups.map((w) => (
                    <div key={w.id} className="px-5 py-4" style={{ boxShadow: 'inset 0 -1px 0 0 rgba(255,255,255,0.06)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-medium text-ink">{w.name}</p>
                          <p className="text-xs text-ink-200 mt-0.5">Day {w.day}/{w.totalDays} · ${w.currentBudget}/day → Target ${w.targetBudget}/day</p>
                        </div>
                        <button onClick={() => stopWarmup(w.id)} disabled={warmupBusy}
                          className="text-xs text-danger font-medium disabled:opacity-50 bg-transparent border-none cursor-pointer" style={{ letterSpacing: '-0.01em' }}>
                          Stop Warmup
                        </button>
                      </div>
                      <div className="w-full rounded-full h-2" style={{ background: '#222222' }}>
                        <div className="h-2 rounded-full transition-all duration-500"
                          style={{ width: `${w.progress}%`, background: 'linear-gradient(90deg, #fb923c, #ef4444)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
        {!fbStatus?.connected && (
          <div className="px-5 py-4 rounded-lg"
            style={{ background: 'rgba(0,112,243,0.08)', boxShadow: '0px 0px 0px 1px rgba(0,112,243,0.2)' }}>
            <p className="text-sm font-medium" style={{ color: '#0070f3' }}>Getting Started</p>
            <p className="text-xs mt-1" style={{ color: '#60a5fa' }}>Connect your Facebook account above to start managing ads.</p>
          </div>
        )}

        {/* Edit Modal */}
        {editCamp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setEditCamp(null)}>
            <div className="card p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-semibold text-ink mb-4">✏️ Edit Campaign</h3>
              {editError && (
                <div className="mb-3 px-3 py-2 rounded-lg text-sm text-danger"
                  style={{ background: 'rgba(239,68,68,0.08)', boxShadow: '0px 0px 0px 1px rgba(239,68,68,0.2)' }}>
                  {editError}
                </div>
              )}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-ink-200 mb-1">Name</label>
                  <input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})}
                    className="w-full" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-200 mb-1">Status</label>
                  <select value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})}
                    className="w-full">
                    <option value="ACTIVE">Active</option>
                    <option value="PAUSED">Paused</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-200 mb-1">Daily Budget</label>
                  <input type="number" value={editForm.dailyBudget} onChange={e => setEditForm({...editForm, dailyBudget: Number(e.target.value) || 0})}
                    className="w-full" min={1} />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setEditCamp(null)} className="btn-secondary btn-sm">Cancel</button>
                <button onClick={saveEdit} disabled={editSaving}
                  className="btn-primary btn-sm">
                  {editSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Modal */}
        {deleteCamp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setDeleteCamp(null)}>
            <div className="card p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-semibold text-ink mb-2">🗑️ Delete Campaign</h3>
              <p className="text-sm text-ink-200 mb-4">Are you sure you want to delete <strong className="text-ink">{deleteCamp.name}</strong>? This will also delete it on Facebook.</p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setDeleteCamp(null)} className="btn-secondary btn-sm">Cancel</button>
                <button onClick={confirmDelete} disabled={deleteSaving}
                  className="btn-sm font-medium cursor-pointer disabled:opacity-50"
                  style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', boxShadow: '0px 0px 0px 1px rgba(239,68,68,0.3)', borderRadius: '8px', padding: '6px 14px', letterSpacing: '-0.01em' }}>
                  {deleteSaving ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Warmup Start Modal */}
        {warmupStart && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setWarmupStart(null)}>
            <div className="card p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-semibold text-ink mb-2">🔥 Start Warmup</h3>
              <p className="text-sm text-ink-200 mb-4">
                Start 7-day warmup for <strong className="text-ink">{warmupStart.accountName}</strong>? Budget starts low and scales daily.
              </p>
              <div className="mb-4">
                <label className="block text-xs font-medium text-ink-200 mb-1">Target Daily Budget ({warmupStart.currency})</label>
                <input type="number" value={warmupTarget} onChange={e => setWarmupTarget(Number(e.target.value) || 0)}
                  className="w-full" min={1} />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setWarmupStart(null)} className="btn-secondary btn-sm">Cancel</button>
                <button onClick={startWarmup} disabled={warmupBusy}
                  className="btn-sm font-medium cursor-pointer disabled:opacity-50"
                  style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c', boxShadow: '0px 0px 0px 1px rgba(251,146,60,0.3)', borderRadius: '8px', padding: '6px 14px', letterSpacing: '-0.01em' }}>
                  {warmupBusy ? 'Starting...' : 'Start Warmup'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
