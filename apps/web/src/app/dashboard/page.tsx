'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import Link from 'next/link';
import PageLayout from '@/components/layout/PageLayout';
import ConnectionBanner from '@/components/ui/ConnectionBanner';
import Skeleton from '@/components/Skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { statusBadgeVariants } from '@/components/ui/StatusBadge';
import { toast } from '@/lib/toast';
import { cn, fmtCurr, fmtNum } from '@/lib/utils';
import { RefreshCw, BarChart3, Link as LinkIcon, Sparkles, ClipboardList, TrendingUp, Flame, SkipForward } from 'lucide-react';
import { useFbStatus, useFbAuthUrl, useFbDisconnect, useSyncStatus, useTriggerSync, useInsights, useSyncInsights, useDashboardSummary, useWarmupStatus, useWarmupActions } from '@/hooks/use-dashboard';
import { useAdAccounts } from '@/hooks/use-accounts';
import { partitionAccounts } from '@/lib/ad-account-utils';
import RestrictedAccountsPanel, { UsableAccountsSummary } from '@/components/dashboard/RestrictedAccountsPanel';
import { useRegisterDashboardSync } from '@/contexts/dashboard-sync-context';

// ─── Types ───

interface InsightRow { id: string; date: string; impressions: number; clicks: number; spend: number; conversions: number; ctr: number; cpc: number; cpm?: number; reach?: number; frequency?: number; cpa?: number; roas?: number }
interface ChartData { date: string; spend: number; impressions: number; clicks: number; ctr: number }

function syncAlertClassName(msg: string) {
  if (msg.includes('✅')) {
    return 'mb-4 border-success-border bg-success-muted text-success';
  }
  if (msg.includes('❌')) {
    return 'mb-4 border-danger-border bg-danger-muted text-danger';
  }
  return 'mb-4 border-brand-border bg-brand-muted text-brand';
}

export default function DashboardPage() {
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

  const { usable: usableAccounts, restricted: restrictedAccounts } = useMemo(
    () => partitionAccounts(accounts),
    [accounts],
  );

  useEffect(() => {
    if (insightAccountId) return;
    const pick = usableAccounts[0] ?? accounts[0];
    if (pick) setInsightAccountId(pick.id);
  }, [accounts, usableAccounts, insightAccountId]);

  // ─── UI state ───
  const [syncMsg, setSyncMsg] = useState('');

  // ─── Actions ───
  const handleSync = useCallback(async () => {
    setSyncMsg('');
    try {
      const data = await triggerSync.mutateAsync();
      setSyncMsg(`✅ Synced ${data.accountsSynced} accounts, ${data.campaignsSynced} campaigns`);
    } catch (err: any) {
      setSyncMsg(`❌ Sync failed: ${err?.response?.data?.message || err.message}`);
    }
  }, [triggerSync]);

  useRegisterDashboardSync({
    onSync: fbStatus?.connected ? handleSync : undefined,
    syncing: triggerSync.isPending,
  });

  const handleSyncInsights = async (accountId?: string) => {
    setSyncMsg('');
    try {
      const data = await syncInsightsMutation.mutateAsync(accountId as any);
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
    <PageLayout title="ภาพรวม">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} size="sm">
              <CardContent className="space-y-2 pt-4">
                <Skeleton variant="text" count={2} />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton variant="card" count={6} />
      </PageLayout>
    );

  const checklist = [
    { done: !!fbStatus?.connected, label: 'เชื่อมต่อ Meta', href: '/dashboard' },
    { done: (summary?.totalCampaigns ?? 0) > 0, label: 'ซิงค์แคมเปญ', href: '/dashboard' },
    {
      done: (summary?.totalCampaigns ?? 0) > 0,
      label: 'สร้างแคมเปญแรก',
      href: usableAccounts.length > 0 ? '/dashboard/campaigns/create' : '/dashboard/campaigns',
    },
  ];

  return (
    <PageLayout title="ภาพรวม" subtitle="สถานะบัญชีและ KPI หลัก">
        <ConnectionBanner connected={!!fbStatus?.connected} />

        <Card className="mb-6">
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-semibold text-ink">เริ่มต้นใช้งาน</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {checklist.map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <span className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                    item.done ? 'bg-success-muted text-success' : 'bg-surface-200 text-ink-300',
                  )}>
                    {item.done ? '✓' : i + 1}
                  </span>
                  <Link href={item.href} className={item.done ? 'text-ink-200 line-through' : 'text-ink hover:text-brand'}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          {fbStatus?.connected && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-ink-300 bg-surface-100 border border-surface-300 rounded-lg px-2.5 py-1">
                Auto-sync: campaigns ~15m · insights yesterday ~1h · 30d ~6h · UI ~1–2m
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleSync}
                disabled={triggerSync.isPending}
              >
                {triggerSync.isPending ? 'Syncing...' : <><RefreshCw className="w-4 h-4" /> Sync now</>}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleSyncInsights(insightAccountId ?? undefined)}
                disabled={syncInsightsMutation.isPending}
              >
                {syncInsightsMutation.isPending ? 'Loading...' : <><BarChart3 className="w-4 h-4" /> Sync insights</>}
              </Button>
            </div>
          )}
        </div>

        {syncMsg && (
          <Alert className={syncAlertClassName(syncMsg)}>
            <AlertDescription>{syncMsg}</AlertDescription>
          </Alert>
        )}

        {/* FB Connection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-ink">Facebook Connection</CardTitle>
          </CardHeader>
          <CardContent>
            {fbStatus?.connected ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-brand/10 text-brand">
                  {fbStatus.data?.facebookName?.charAt(0) || '?'}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink">{fbStatus.data?.facebookName}</p>
                  <p className="text-xs text-ink-200">{fbStatus.data?.facebookEmail || 'No email'}</p>
                </div>
                <Badge variant="outline" className={statusBadgeVariants({ tone: 'success' })}>
                  Connected
                </Badge>
                <Button type="button" variant="ghost" size="sm" className="text-danger" onClick={handleDisconnect}>
                  Disconnect
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <p className="text-sm text-ink-200">Connect Facebook to manage ad accounts.</p>
                <Button type="button" size="sm" onClick={connectFacebook}>
                  <LinkIcon className="w-4 h-4" aria-hidden /> เชื่อมต่อ Meta
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {fbStatus?.connected && (
          <>
            <RestrictedAccountsPanel accounts={restrictedAccounts} />
            <UsableAccountsSummary count={usableAccounts.length} />

            {/* Summary Stats */}
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Ad Accounts', value: summary.accounts.toString() },
                  { label: 'Campaigns', value: summary.totalCampaigns.toString() },
                  { label: 'Active', value: summary.activeCampaigns.toString() },
                  { label: 'Total Spend', value: `$${fmtNum(summary.totalSpend)}` },
                ].map(s => (
                  <Card key={s.label}>
                    <CardContent>
                      <p className="text-xs text-ink-200 uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>{s.label}</p>
                      <p className="text-2xl font-bold mt-1 text-ink">{s.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Quick Actions */}
            <div className="flex gap-3 mb-6 flex-wrap">
              {usableAccounts.length > 0 ? (
                <Button render={<Link href="/dashboard/campaigns/create" />} size="sm" nativeButton={false}>
                  <Sparkles className="w-4 h-4" /> สร้างแคมเปญ
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled
                  title="ไม่มีบัญชีที่ใช้งานได้ — แก้บัญชีในส่วนบัญชีต้องแก้ไขด้านบน"
                >
                  <Sparkles className="w-4 h-4" /> สร้างแคมเปญ
                </Button>
              )}
              <Button
                render={<Link href="/dashboard/campaigns" />}
                variant="secondary"
                size="sm"
                nativeButton={false}
              >
                <ClipboardList className="w-4 h-4" /> View Campaigns
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleSync}
                disabled={triggerSync.isPending}
              >
                {triggerSync.isPending ? 'Syncing...' : <><RefreshCw className="w-4 h-4" /> Sync Now</>}
              </Button>
            </div>

            {/* Sync Status */}
            {syncStatus && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card>
                  <CardContent>
                    <p className="text-xs text-ink-100 uppercase tracking-wider">Ad Sets</p>
                    <p className="text-3xl font-bold mt-1 text-ink">{syncStatus.adsets}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <p className="text-xs text-ink-100 uppercase tracking-wider">Ads</p>
                    <p className="text-3xl font-bold mt-1 text-ink">{syncStatus.ads}</p>
                  </CardContent>
                </Card>
                {syncStatus.lastSync && (
                  <Card className="col-span-2">
                    <CardContent>
                      <p className="text-xs text-ink-100 uppercase tracking-wider">Last Sync</p>
                      <p className="text-lg font-bold mt-1 text-ink">
                        {new Date(syncStatus.lastSync).toLocaleString('th', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                      {(syncStatus as { lastSyncSource?: string }).lastSyncSource && (
                        <p className="text-[10px] text-ink-300 mt-0.5">
                          source: {(syncStatus as { lastSyncSource?: string }).lastSyncSource}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Charts */}
            {accounts.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <label className="text-xs text-ink-300">Chart account</label>
                <select
                  value={insightAccountId ?? ''}
                  onChange={e => setInsightAccountId(e.target.value || null)}
                  className="text-sm rounded-lg border border-surface-300 bg-surface-100 text-ink px-3 py-1.5"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {!a.canCreateAds && a.canCreateAds !== undefined ? ' (จำกัด)' : ''}
                    </option>
                  ))}
                </select>
                <label className="text-xs text-ink-300">Days</label>
                <select
                  value={insightDays}
                  onChange={e => setInsightDays(parseInt(e.target.value, 10))}
                  className="text-sm rounded-lg border border-surface-300 bg-surface-100 text-ink px-3 py-1.5"
                >
                  <option value={7}>7</option>
                  <option value={14}>14</option>
                  <option value={30}>30</option>
                </select>
              </div>
            )}
            {insights.length > 0 && (
              <Card className="mb-6">
                <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
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
                </CardContent>
              </Card>
            )}

            {/* Warmup Section */}
            <Card className="mb-6 gap-0 py-0">
              <CardHeader className="flex-row items-center justify-between border-b border-surface-300 py-3.5">
                <CardTitle className="text-sm font-semibold text-ink">
                  <Flame className="w-4 h-4 inline" /> Account Warmup
                </CardTitle>
                <div className="flex gap-2">
                  {warmups.length > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={cn(statusBadgeVariants({ tone: 'info' }), 'cursor-pointer')}
                      onClick={handleWarmupTick}
                      disabled={warmupActions.tick.isPending}
                    >
                      <SkipForward className="w-4 h-4" /> Advance Day (Manual)
                    </Button>
                  )}
                </div>
              </CardHeader>
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
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          className="text-danger"
                          onClick={() => handleStopWarmup(w.id)}
                          disabled={warmupActions.stop.isPending}
                        >
                          Stop Warmup
                        </Button>
                      </div>
                      <div className="w-full rounded-full h-2 bg-surface-300">
                        <div className="h-2 rounded-full transition-all duration-500"
                          style={{ width: `${w.progress}%`, background: 'linear-gradient(90deg, #fb923c, #ef4444)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
        {!fbStatus?.connected && (
          <Alert className="border-brand-border bg-brand-muted text-brand">
            <AlertTitle>Getting Started</AlertTitle>
            <AlertDescription>
              Connect your Facebook account above to start managing ads.
            </AlertDescription>
          </Alert>
        )}
      </PageLayout>
    );
}
