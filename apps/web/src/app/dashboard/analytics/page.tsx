'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, AreaChart, Area } from 'recharts';

// ─── Types ───

interface Overview {
  connected: boolean;
  summary: { totalSpend: number; totalImpressions: number; totalClicks: number; totalConversions: number; totalReach: number; totalCampaigns: number; activeCampaigns: number };
  rates: { ctr: number; cpc: number; cpm: number; cpa: number; roas: number; frequency: number };
  budget: { totalMonthly: number; spent: number; usagePercent: number };
  objectives: { objective: string; count: number }[];
}

interface TrendPoint { date: string; impressions: number; clicks: number; spend: number; conversions: number; reach: number; ctr: number; cpc: number; cpm: number }
interface TrendData { from: string; to: string; granularity: string; series: TrendPoint[] }

interface CampaignRank { id: string; name: string; objective: string; status: string; accountName: string; currency: string; totalSpend: number; impressions: number; clicks: number; conversions: number; ctr: number; cpc: number; cpm: number; roas: number }

interface Comparison { period: string; current: { impressions: number; clicks: number; spend: number; conversions: number }; previous: { impressions: number; clicks: number; spend: number; conversions: number }; changes: { impressions: number; clicks: number; spend: number; conversions: number } }

interface AccountSummary { id: string; name: string; currency: string; status: string; balance: number; spentToday: number; campaignCount: number; latestInsight: { impressions: number; clicks: number; spend: number; conversions: number; ctr: number; cpc: number } | null }

const fmtCurr = (val: number, cur: string = 'USD') => new Intl.NumberFormat('en', { style: 'currency', currency: cur, minimumFractionDigits: 0 }).format(val);
const fmtNum = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString();
const daysAgo = (d: number) => { const dt = new Date(); dt.setDate(dt.getDate() - d); return dt.toISOString().slice(0, 10); };

const DAY_OPTIONS = [
  { label: '7D', days: 7 }, { label: '30D', days: 30 },
  { label: '60D', days: 60 }, { label: '90D', days: 90 },
];

export default function AnalyticsPage() {
  const [range, setRange] = useState(30);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRank[]>([]);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('spend');
  const [granularity, setGranularity] = useState('day');

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/'; return; }
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    const from = daysAgo(range);
    const to = daysAgo(0);

    try {
      const [ov, tr, cmp, acc] = await Promise.all([
        axios.get('/api/analytics/overview', { params: { from, to } }).catch(() => ({ data: { connected: false } })),
        axios.get('/api/analytics/trends', { params: { from, to, granularity } }).catch(() => ({ data: { series: [] } })),
        axios.get('/api/analytics/comparison', { params: { period: `${range}d` } }).catch(() => ({ data: null })),
        axios.get('/api/analytics/accounts').catch(() => ({ data: [] })),
      ]);
      setOverview(ov.data);
      setTrends((tr.data as TrendData)?.series || []);
      setComparison(cmp.data);
      setAccounts(acc.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [range, granularity]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Fetch campaign ranking separately when sort changes
  useEffect(() => {
    const from = daysAgo(range);
    const to = daysAgo(0);
    axios.get('/api/analytics/campaigns', { params: { from, to, sort: sortBy, limit: 20 } })
      .then(r => setCampaigns(r.data))
      .catch(() => {});
  }, [sortBy, range]);

  if (loading) return (
    <div className="min-h-screen bg-[#0b1120] flex items-center justify-center">
      <p className="text-slate-400 text-lg animate-pulse">Loading analytics...</p>
    </div>
  );

  if (!overview?.connected) return (
    <div className="min-h-screen bg-[#0b1120] flex items-center justify-center">
      <div className="text-center">
        <p className="text-slate-300 text-lg mb-2">Connect your Facebook account first</p>
        <a href="/dashboard" className="text-blue-400 hover:text-blue-300">← Back to Dashboard</a>
      </div>
    </div>
  );

  const o = overview;
  const objLabel = (o: string) => ({ OUTCOME_AWARENESS: 'Awareness', OUTCOME_ENGAGEMENT: 'Engagement', OUTCOME_TRAFFIC: 'Traffic', OUTCOME_LEADS: 'Leads', OUTCOME_SALES: 'Sales', OUTCOME_APP_PROMOTION: 'App Promotion' } as any)[o] || o;

  const trendOpt = <T>(a: T, b: T) => a ?? b;

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-200">
      {/* Navbar */}
      <header className="bg-[#1e293b] border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold">FB Ads Platform</h1>
            <nav className="flex gap-4 text-sm">
              <a href="/dashboard" className="text-gray-400 hover:text-gray-200">Dashboard</a>
              <a href="/dashboard/analytics" className="text-blue-400 font-medium hover:text-blue-300">📊 Analytics</a>
              <a href="/dashboard/audiences" className="text-gray-400 hover:text-gray-200">🎯 Audiences</a>
              <a href="/dashboard/all-campaigns" className="text-gray-400 hover:text-gray-200">📋 All Campaigns</a>
              <a href="/dashboard/abtest" className="text-gray-400 hover:text-gray-200">🔁 A/B Test</a>
              <a href="/dashboard/rules" className="text-gray-400 hover:text-gray-200">⚡ Rules</a>
              <a href="/dashboard/budget" className="text-gray-400 hover:text-gray-200">💰 Budget</a>
              <a href="/dashboard/notifications" className="text-gray-400 hover:text-gray-200">🔔 Alerts</a>
              <a href="/dashboard/creatives" className="text-gray-400 hover:text-gray-200">🎨 Creatives</a>
            </nav>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header + Date Range */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">📊 Analytics</h2>
          <div className="flex gap-2">
            {DAY_OPTIONS.map(opt => (
              <button key={opt.days} onClick={() => setRange(opt.days)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  range === opt.days ? 'bg-blue-600 text-white' : 'bg-[#1e293b] text-slate-400 hover:bg-[#293548]'
                }`}>{opt.label}</button>
            ))}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'Total Spend', value: fmtCurr(o.summary.totalSpend, 'USD'), color: 'from-blue-600 to-blue-400' },
            { label: 'Impressions', value: fmtNum(o.summary.totalImpressions), color: 'from-purple-600 to-purple-400' },
            { label: 'Clicks', value: fmtNum(o.summary.totalClicks), color: 'from-cyan-600 to-cyan-400' },
            { label: 'CTR', value: `${o.rates.ctr}%`, color: 'from-green-600 to-green-400' },
            { label: 'CPC', value: fmtCurr(o.rates.cpc), color: 'from-orange-600 to-orange-400' },
            { label: 'Conversions', value: fmtNum(o.summary.totalConversions), color: 'from-emerald-600 to-emerald-400' },
            { label: 'ROAS', value: `${o.rates.roas}x`, color: 'from-rose-600 to-rose-400' },
          ].map((card, i) => (
            <div key={i} className="bg-[#1e293b] rounded-xl p-4 border border-slate-700/50">
              <p className="text-xs text-slate-500 mb-1">{card.label}</p>
              <p className={`text-lg font-bold bg-gradient-to-r ${card.color} bg-clip-text text-transparent`}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Budget + Active */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#1e293b] rounded-xl p-4 border border-slate-700/50">
            <p className="text-xs text-slate-500 mb-2">Budget Usage</p>
            <div className="flex items-end gap-2 mb-1">
              <span className="text-lg font-bold">{fmtCurr(o.budget.spent)}</span>
              <span className="text-xs text-slate-500 mb-0.5">/ {fmtCurr(o.budget.totalMonthly)}</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div className="bg-gradient-to-r from-blue-500 to-blue-400 h-2 rounded-full transition-all" style={{ width: `${Math.min(o.budget.usagePercent, 100)}%` }} />
            </div>
            <p className="text-xs text-slate-500 mt-1">{o.budget.usagePercent}% used</p>
          </div>
          <div className="bg-[#1e293b] rounded-xl p-4 border border-slate-700/50">
            <p className="text-xs text-slate-500 mb-2">Campaigns</p>
            <p className="text-2xl font-bold text-blue-400">{o.summary.activeCampaigns}</p>
            <p className="text-xs text-slate-500">Active of {o.summary.totalCampaigns} total</p>
            <div className="w-full bg-slate-700 rounded-full h-2 mt-1">
              <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${o.summary.totalCampaigns > 0 ? (o.summary.activeCampaigns / o.summary.totalCampaigns) * 100 : 0}%` }} />
            </div>
          </div>
          <div className="bg-[#1e293b] rounded-xl p-4 border border-slate-700/50">
            <p className="text-xs text-slate-500 mb-2">Objectives Breakdown</p>
            <div className="space-y-1">
              {o.objectives.map((obj, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-slate-400">{objLabel(obj.objective)}</span>
                  <span className="text-slate-200 font-medium">{obj.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Comparison */}
        {comparison && (
          <div className="bg-[#1e293b] rounded-xl p-4 border border-slate-700/50">
            <h3 className="text-sm font-semibold mb-3 text-slate-300">📈 Period Comparison (vs previous {comparison.period})</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Spend', curVal: fmtCurr(comparison.current.spend), prevVal: fmtCurr(comparison.previous.spend), change: comparison.changes.spend, color: comparison.changes.spend > 0 ? 'text-red-400' : 'text-green-400' },
                { label: 'Impressions', curVal: fmtNum(comparison.current.impressions), prevVal: fmtNum(comparison.previous.impressions), change: comparison.changes.impressions, color: comparison.changes.impressions > 0 ? 'text-green-400' : 'text-red-400' },
                { label: 'Clicks', curVal: fmtNum(comparison.current.clicks), prevVal: fmtNum(comparison.previous.clicks), change: comparison.changes.clicks, color: comparison.changes.clicks > 0 ? 'text-green-400' : 'text-red-400' },
                { label: 'Conversions', curVal: fmtNum(comparison.current.conversions), prevVal: fmtNum(comparison.previous.conversions), change: comparison.changes.conversions, color: comparison.changes.conversions > 0 ? 'text-green-400' : 'text-red-400' },
              ].map((c, i) => (
                <div key={i} className="bg-[#0b1120] rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">{c.label}</p>
                  <p className="text-sm font-bold">{c.curVal}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-[10px] text-slate-600">prev: {c.prevVal}</span>
                    <span className={`text-xs font-medium ${c.color}`}>
                      {c.change > 0 ? '↑' : '↓'} {Math.abs(c.change)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trend Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Spend Trend */}
          <div className="bg-[#1e293b] rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-300">💰 Spend Trend</h3>
              <select value={granularity} onChange={e => setGranularity(e.target.value)}
                className="bg-[#0b1120] text-slate-300 border border-slate-600 rounded px-2 py-1 text-xs">
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
              </select>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends}>
                  <defs>
                    <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => fmtNum(v)} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0', fontSize: '12px' }} formatter={(v: any) => fmtCurr(Number(v))} />
                  <Area type="monotone" dataKey="spend" stroke="#3b82f6" fill="url(#spendGrad)" strokeWidth={2} name="Spend" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Impressions + Clicks */}
          <div className="bg-[#1e293b] rounded-xl p-4 border border-slate-700/50">
            <h3 className="text-sm font-semibold mb-3 text-slate-300">👁️ Impressions & Clicks</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => fmtNum(v)} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0', fontSize: '12px' }} formatter={(v: any) => fmtNum(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="impressions" fill="#8b5cf6" name="Impressions" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="clicks" fill="#06b6d4" name="Clicks" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* CTR Trend */}
          <div className="bg-[#1e293b] rounded-xl p-4 border border-slate-700/50">
            <h3 className="text-sm font-semibold mb-3 text-slate-300">📈 CTR Trend (%)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} domain={['auto', 'auto']} tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0', fontSize: '12px' }} formatter={(v: any) => `${Number(v).toFixed(2)}%`} />
                  <Line type="monotone" dataKey="ctr" stroke="#10b981" strokeWidth={2} dot={false} name="CTR" />
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* CPC Trend */}
          <div className="bg-[#1e293b] rounded-xl p-4 border border-slate-700/50">
            <h3 className="text-sm font-semibold mb-3 text-slate-300">💵 CPC Trend</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => fmtCurr(v)} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0', fontSize: '12px' }} formatter={(v: any) => fmtCurr(Number(v))} />
                  <Line type="monotone" dataKey="cpc" stroke="#f97316" strokeWidth={2} dot={false} name="CPC" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Campaign Ranking */}
        <div className="bg-[#1e293b] rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-300">🏆 Campaign Ranking</h3>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className="bg-[#0b1120] text-slate-300 border border-slate-600 rounded px-2 py-1 text-xs">
              <option value="spend">By Spend</option>
              <option value="impressions">By Impressions</option>
              <option value="clicks">By Clicks</option>
              <option value="ctr">By CTR</option>
              <option value="cpc">By CPC</option>
              <option value="conversions">By Conversions</option>
              <option value="roas">By ROAS</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#0b1120]/50 text-slate-500">
                  <th className="text-left px-4 py-2">#</th>
                  <th className="text-left px-3 py-2">Campaign</th>
                  <th className="text-left px-3 py-2">Account</th>
                  <th className="text-right px-3 py-2">Spend</th>
                  <th className="text-right px-3 py-2">Impr.</th>
                  <th className="text-right px-3 py-2">Clicks</th>
                  <th className="text-right px-3 py-2">CTR</th>
                  <th className="text-right px-3 py-2">CPC</th>
                  <th className="text-right px-3 py-2">Conv.</th>
                  <th className="text-right px-3 py-2">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c, i) => (
                  <tr key={c.id} className="border-t border-slate-800/50 hover:bg-[#0b1120]/30 transition-colors">
                    <td className="px-4 py-2 text-slate-500">{i + 1}</td>
                    <td className="px-3 py-2">
                      <p className="text-slate-200 font-medium truncate max-w-[160px]">{c.name}</p>
                      <p className="text-slate-500">{objLabel(c.objective)} · {c.status}</p>
                    </td>
                    <td className="px-3 py-2 text-slate-400">{c.accountName}</td>
                    <td className="px-3 py-2 text-right text-blue-400 font-mono">{fmtCurr(c.totalSpend)}</td>
                    <td className="px-3 py-2 text-right text-slate-300 font-mono">{fmtNum(c.impressions)}</td>
                    <td className="px-3 py-2 text-right text-slate-300 font-mono">{fmtNum(c.clicks)}</td>
                    <td className="px-3 py-2 text-right text-emerald-400 font-mono">{c.ctr}%</td>
                    <td className="px-3 py-2 text-right text-orange-400 font-mono">{fmtCurr(c.cpc)}</td>
                    <td className="px-3 py-2 text-right text-slate-300 font-mono">{fmtNum(c.conversions)}</td>
                    <td className="px-3 py-2 text-right text-rose-400 font-mono">{c.roas.toFixed(1)}x</td>
                  </tr>
                ))}
                {campaigns.length === 0 && (
                  <tr><td colSpan={10} className="text-center py-8 text-slate-500">No campaign data for this period</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Account Summary */}
        <div className="bg-[#1e293b] rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="p-4 border-b border-slate-700/50">
            <h3 className="text-sm font-semibold text-slate-300">🏦 Account Summary</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
            {accounts.map(acc => (
              <div key={acc.id} className="bg-[#0b1120] rounded-lg p-3 border border-slate-700/30">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-slate-200 truncate">{acc.name}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${acc.status === 'ACTIVE' ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>{acc.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-slate-500">Balance</p>
                    <p className="text-slate-200 font-mono">{fmtCurr(acc.balance, acc.currency)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Spent Today</p>
                    <p className="text-slate-200 font-mono">{fmtCurr(acc.spentToday, acc.currency)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Campaigns</p>
                    <p className="text-slate-200">{acc.campaignCount}</p>
                  </div>
                  {acc.latestInsight && (
                    <>
                      <div>
                        <p className="text-slate-500">CTR / CPC</p>
                        <p className="text-slate-200 font-mono">{Number(acc.latestInsight.ctr).toFixed(2)}% / {fmtCurr(Number(acc.latestInsight.cpc))}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
            {accounts.length === 0 && (
              <div className="col-span-full text-center py-6 text-slate-500 text-sm">No accounts found</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
