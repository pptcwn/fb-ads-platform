'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import Shell from '@/components/Shell';
import PageHeader from '@/components/PageHeader';
import Skeleton from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { fmtCurr, fmtNum } from '@/lib/utils';
import { RefreshCw, BarChart3, Link, Sparkles, ClipboardList, TrendingUp, Flame, SkipForward } from 'lucide-react';
import { useFbStatus, useFbAuthUrl, useFbDisconnect, useSyncStatus, useTriggerSync, useInsights, useSyncInsights, useDashboardSummary, useWarmupStatus, useWarmupActions } from '@/hooks/use-dashboard';
import { useAdAccounts } from '@/hooks/use-accounts';

// ─── Types ───

interface InsightRow { id: string; date: string; impressions: number; clicks: number; spend: number; conversions: number; ctr: number; cpc: number; cpm?: number; reach?: number; frequency?: number; cpa?: number; roas?: number }
interface ChartData { date: string; spend: number; impressions: number; clicks: number; ctr: number }

export default function DashboardPage() {
  const toast = useToast();

  // ─── Queries ───
  const { data: fbStatus, isLoading: fbLoading } = useFbStatus();
  const { data: syncStatus } = useSyncStatus();
  const { data: accounts = [] } = useAdAccounts();
  const { data: summary } = useDashboardSummary();
  const { data: warmups = [] } = useWarmupStatus();

  // ─── Mutations ───
  const triggerSync = useTriggerSync();
  const syncInsightsMutation = useSyncInsights();
  const fbDisconnect = useFbDisconnect();
  const warmupActions = useWarmupActions();

  // ─── Facebook auth URL (manual fetch) ───
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const connectFacebook = async () => {
    try {
      const res = await import('@/lib/api-client').then(m => m.facebookApi.getAuthUrl());
      window.location.href = res.data.url;
    } catch (err: any) {
      toast.error(`Failed to get Facebook auth URL: ${err?.response?.data?.message || err.message}`);
    }
  };

  // ─── Insights (lazy — when account selected) ───
  const [insightAccountId, setInsightAccountId] = useState<string | null>(null);
  const [insightDays, setInsightDays] = useState(7);
  const { data: insights = [] } = useInsights(insightAccountId, insightDays);

  useEffect(() => {
    if (!insightAccountId && accounts.length > 0) {
      setInsightAccountId(accounts[0].id);
    }
  }, [accounts, insightAccountId]);

  // ─── UI state ───
  const [syncMsg, setSyncMsg] = useState('');

  // ─── Actions ───
  const handleSync = async () => {
    setSyncMsg('');
    try {
      const data = await triggerSync.mutateAsync();
      setSyncMsg(`✅ Synced ${data.accountsSynced} accounts, ${data.campaignsSynced} campaigns`);
    } catch (err: any) {
      setSyncMsg(`❌ Sync failed: ${err?.response?.data?.message || err.message}`);
    }
  };

  const handleSyncInsights = async () => {
    setSyncMsg('');
    try {
      const data = await syncInsightsMutation.mutateAsync(undefined as any);
      if (data?.queued) {
        setSyncMsg(`✅ ${data.message || 'Insights sync queued — updating in background.'}`);
      } else {
        setSyncMsg(
          `✅ Insights synced: ${data.campaignDays ?? 0} campaign-days, ${data.accountInsightDays ?? 0} account-days`,
        );
      }
    } catch (err: any) {
      setSyncMsg(`❌ Insights sync failed: ${err?.response?.data?.message || err.message}`);
    }
  };

  const handleLoadInsights = (accountId: string) => {
    setInsightAccountId(accountId);
  };

  const handleStopWarmup = async (accountId: string) => {
    try {
      await warmupActions.stop.mutateAsync(accountId);
      toast.success('Warmup stopped');
    } catch (err: any) {
      setSyncMsg(`❌ Warmup stop failed: ${err?.response?.data?.message || err.message}`);
    }
  };

  const handleWarmupTick = async () => {
    try {
      const data = await warmupActions.tick.mutateAsync();
      if (data.message) setSyncMsg(`ℹ️ ${data.message}`);
      else setSyncMsg(`✅ Warmup advanced — ${data.results?.map((r: any) => `${r.name}: ${r.status}`).join(', ') || 'done'}`);
    } catch (err: any) {
      setSyncMsg(`❌ Warmup tick failed: ${err?.response?.data?.message || err.message}`);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Facebook account? This will remove all synced accounts and pages.')) return;
    try {
      await fbDisconnect.mutateAsync();
      toast.success('Disconnected. Refresh to reconnect with new permissions.');
      setTimeout(() => { window.location.reload(); }, 1500);
    } catch (err: any) {
      setSyncMsg('❌ Disconnect failed: ' + (err?.response?.data?.message || err.message));
    }
  };

  // ─── Chart data ───
  const chartData: ChartData[] = (insights as any[]).map((r: any) => ({
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

  // ─── Loading skeleton ───
  if (fbLoading) return (
    <Shell>
      <div className="p-6">
        <PageHeader title="Dashboard" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 space-y-2">
              <Skeleton variant="text" count={2} />
            </div>
          ))}
        </div>
        <Skeleton variant="card" count={6} />
      </div>
    </Shell>
  );

  return (
    <Shell>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <PageHeader title="Dashboard" />
          {fbStatus?.connected && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-ink-300 bg-surface-100 border border-surface-300 rounded-lg px-2.5 py-1">
                Auto-sync: campaigns ~15m · insights yesterday ~1h · 30d ~6h · UI ~1–2m
              </span>
              <button onClick={handleSync} disabled={triggerSync.isPending}
                className="btn-secondary btn-sm">
                {triggerSync.isPending ? 'Syncing...' : <><RefreshCw className="w-4 h-4" /> Sync now</>}
              </button>
              <button onClick={handleSyncInsights} disabled={syncInsightsMutation.isPending}
                className="btn-ghost btn-sm">
                {syncInsightsMutation.isPending ? 'Loading...' : <><BarChart3 className="w-4 h-4" /> Insights 30d</>}
              </button>
            </div>
          )}
        </div>

        {syncMsg && (
          <div className={`mb-4 ${syncMsg.includes('✅') ? 'msg-success' : syncMsg.includes('❌') ? 'msg-error' : 'msg-info'}`}>
            {syncMsg}
          </div>
        )}

        {/* FB Connection */}
        <div className="card p-5 mb-6">
          <h3 className="text-sm font-semibold mb-4 text-ink">Facebook Connection</h3>
          {fbStatus?.connected ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-accent/10 text-accent">
                {fbStatus.data?.facebookName?.charAt(0) || '?'}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-ink">{fbStatus.data?.facebookName}</p>
                <p className="text-xs text-ink-200">{fbStatus.data?.facebookEmail || 'No email'}</p>
              </div>
              <span className="badge-success">Connected</span>
              <button onClick={handleDisconnect} className="btn-ghost btn-sm text-danger">
                Disconnect
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-sm text-ink-200">Connect Facebook to manage ad accounts.</p>
              <button onClick={connectFacebook} className="btn-primary btn-sm">
                <Link className="w-4 h-4" /> Connect Facebook
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

            {/* Quick Actions */}
            <div className="flex gap-3 mb-6">
              <a href="/dashboard/campaigns?new=1" className="btn-primary btn-sm">
                <Sparkles className="w-4 h-4" /> New Campaign
              </a>
              <a href="/dashboard/campaigns" className="btn-secondary btn-sm">
                <ClipboardList className="w-4 h-4" /> View Campaigns
              </a>
              <button onClick={handleSync} disabled={triggerSync.isPending}
                className="btn-secondary btn-sm disabled:opacity-50">
                {triggerSync.isPending ? 'Syncing...' : <><RefreshCw className="w-4 h-4" /> Sync Now</>}
              </button>
            </div>

            {/* Sync Status */}
            {syncStatus && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="card p-5">
                  <p className="text-xs text-ink-100 uppercase tracking-wider">Ad Sets</p>
                  <p className="text-3xl font-bold mt-1 text-ink">{syncStatus.adsets}</p>
                </div>
                <div className="card p-5">
                  <p className="text-xs text-ink-100 uppercase tracking-wider">Ads</p>
                  <p className="text-3xl font-bold mt-1 text-ink">{syncStatus.ads}</p>
                </div>
                {syncStatus.lastSync && (
                  <div className="card p-5 col-span-2">
                    <p className="text-xs text-ink-100 uppercase tracking-wider">Last Sync</p>
                    <p className="text-lg font-bold mt-1 text-ink">
                      {new Date(syncStatus.lastSync).toLocaleString('th', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                    {(syncStatus as { lastSyncSource?: string }).lastSyncSource && (
                      <p className="text-[10px] text-ink-300 mt-0.5">
                        source: {(syncStatus as { lastSyncSource?: string }).lastSyncSource}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Charts */}
            {insights.length > 0 && (
              <div className="card p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-ink"><TrendingUp className="w-4 h-4 inline" /> Performance (last {insightDays} days)</h3>
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

            {/* Warmup Section */}
            <div className="card mb-6">
              <div className="px-5 py-3.5 flex items-center justify-between border-b border-surface-300">
                <h3 className="text-sm font-semibold text-ink"><Flame className="w-4 h-4 inline" /> Account Warmup</h3>
                <div className="flex gap-2">
                  {warmups.length > 0 && (
                    <button onClick={handleWarmupTick} disabled={warmupActions.tick.isPending}
                      className="badge-info cursor-pointer disabled:opacity-50">
                      <SkipForward className="w-4 h-4" /> Advance Day (Manual)
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
                  {warmups.map((w: any) => (
                    <div key={w.id} className="px-5 py-4 border-b border-surface-300">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-medium text-ink">{w.name}</p>
                          <p className="text-xs text-ink-200 mt-0.5">Day {w.day}/{w.totalDays} · ${w.currentBudget}/day → Target ${w.targetBudget}/day</p>
                        </div>
                        <button onClick={() => handleStopWarmup(w.id)} disabled={warmupActions.stop.isPending}
                          className="btn-ghost btn-xs text-danger">
                          Stop Warmup
                        </button>
                      </div>
                      <div className="w-full rounded-full h-2 bg-surface-300">
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
          <div className="msg-info">
            <p className="text-sm font-medium">Getting Started</p>
            <p className="text-xs mt-1">Connect your Facebook account above to start managing ads.</p>
          </div>
        )}
      </div>
    </Shell>
  );
}
