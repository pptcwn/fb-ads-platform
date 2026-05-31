'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';

// ─── Types ───

interface CampaignItem {
  id: string;
  name: string;
  campaignId: string;
  objective: string;
  status: string;
  dailyBudget: number | null;
  spent: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
}

interface AdAccountWithCampaigns {
  id: string;
  name: string;
  currency: string;
  campaigns: CampaignItem[];
}

interface BulkResult {
  id: string;
  name: string;
  success: boolean;
  error?: string;
  status?: string;
}

interface AdSetItem {
  id: string; adsetId: string; name: string; status: string;
  dailyBudget: number; impressions: number; clicks: number;
  spend: number; conversions: number; ctr: number;
  optimizationGoal: string | null; bidStrategy: string | null;
  adCount: number;
}

// ─── Helpers ───

const objLabel = (o: string) =>
  ({ OUTCOME_AWARENESS: 'Awareness', OUTCOME_ENGAGEMENT: 'Engagement', OUTCOME_TRAFFIC: 'Traffic', OUTCOME_LEADS: 'Leads', OUTCOME_SALES: 'Sales', OUTCOME_APP_PROMOTION: 'App Promotion' }[o] || o);

const fmtCurr = (val: number, cur: string) =>
  new Intl.NumberFormat('en', { style: 'currency', currency: cur, minimumFractionDigits: 0 }).format(val);

const fmtNum = (n: number) =>
  n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString();

const fmtPct = (v: number) => (v * 100).toFixed(2) + '%';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  PAUSED: 'bg-yellow-100 text-yellow-700',
  DELETED: 'bg-red-100 text-red-700',
  ARCHIVED: 'bg-gray-100 text-gray-600',
};

const AS_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-50 text-green-700 border-green-200',
  PAUSED: 'bg-yellow-50 text-yellow-700 border-yellow-200',
};

// ─── Page ───

export default function AllCampaignsPage() {
  const [accounts, setAccounts] = useState<AdAccountWithCampaigns[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [selectAll, setSelectAll] = useState(false);

  // Confirmation modal
  const [confirmAction, setConfirmAction] = useState<{ type: 'pause' | 'resume' | 'delete'; ids: string[] } | null>(null);

  // Ad Set modal
  const [adSetModal, setAdSetModal] = useState<{ campaignId: string; campaignName: string; currency: string } | null>(null);
  const [adSets, setAdSets] = useState<AdSetItem[]>([]);
  const [adSetLoading, setAdSetLoading] = useState(false);
  const [adSetBusy, setAdSetBusy] = useState<string | null>(null);
  const [editBudget, setEditBudget] = useState<{ id: string; name: string; budget: number } | null>(null);

  // Clone modal
  const [cloneModal, setCloneModal] = useState<{ id: string; name: string; type: 'campaign' | 'creative' } | null>(null);
  const [cloneName, setCloneName] = useState('');
  const [cloneBusy, setCloneBusy] = useState(false);

  // Save as Template
  const [saveTpl, setSaveTpl] = useState<{ id: string; name: string; objective: string; dailyBudget: number } | null>(null);
  const [tplName, setTplName] = useState('');
  const [tplNotes, setTplNotes] = useState('');
  const [tplBusy, setTplBusy] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/'; return; }
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.get('/api/campaigns/accounts');
      setAccounts(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  // Flatten all campaigns from all accounts into a single list
  const allCampaigns = accounts.flatMap((acct) =>
    acct.campaigns.map((camp) => ({ ...camp, _account: acct })),
  );

  type FlatCampaign = (typeof allCampaigns)[number];

  const toggleCheck = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (checked.size === allCampaigns.length) {
      setChecked(new Set());
      setSelectAll(false);
    } else {
      setChecked(new Set(allCampaigns.map((c) => c.id)));
      setSelectAll(true);
    }
  };

  const checkedIds = Array.from(checked);
  const hasChecked = checkedIds.length > 0;

  // ─── Bulk Actions ───

  const executeBulkAction = useCallback(
    async (type: 'pause' | 'resume' | 'delete') => {
      const ids = confirmAction?.ids || checkedIds;
      if (ids.length === 0) return;

      setBusy(true);
      setMsg('');
      setError('');
      setConfirmAction(null);

      const endpoints: Record<string, string> = {
        pause: '/api/campaigns/bulk/pause',
        resume: '/api/campaigns/bulk/resume',
        delete: '/api/campaigns/bulk/delete',
      };

      try {
        const { data } = await axios.post(endpoints[type], { ids });
        const succeeded = data.results.filter((r: BulkResult) => r.success).length;
        const failed = data.results.filter((r: BulkResult) => !r.success).length;
        setMsg(data.message || `${succeeded} campaigns ${type === 'delete' ? 'deleted' : type === 'pause' ? 'paused' : 'resumed'}`);
        if (failed > 0) {
          setMsg((prev) => `${prev} (${failed} failed)`);
        }
        setChecked(new Set());
        setSelectAll(false);
        fetchAll();
      } catch (err: any) {
        setError(err?.response?.data?.message || err.message || `Bulk ${type} failed`);
      } finally {
        setBusy(false);
      }
    },
    [confirmAction, checkedIds],
  );

  // ─── Ad Set Management ───

  const openAdSets = async (campaignId: string, campaignName: string, currency: string) => {
    setAdSetModal({ campaignId, campaignName, currency });
    setAdSetLoading(true);
    try {
      const { data } = await axios.get(`/api/adsets/campaign/${campaignId}`);
      setAdSets(data.adsets || []);
    } catch { setAdSets([]); }
    finally { setAdSetLoading(false); }
  };

  const cloneCampaign = async () => {
    if (!cloneModal || cloneModal.type !== 'campaign') return;
    setCloneBusy(true); setMsg(''); setError('');
    try {
      const { data } = await axios.post(`/api/campaigns/${cloneModal.id}/clone`, { name: cloneName || undefined });
      setMsg(data.message);
      setCloneModal(null);
      setCloneName('');
      fetchAll();
    } catch (err: any) { setError(err?.response?.data?.message || err.message); }
    finally { setCloneBusy(false); }
  };

  // ─── Save as Template ───

  const saveAsTemplate = async () => {
    if (!saveTpl || !tplName.trim()) return;
    setTplBusy(true); setMsg(''); setError('');
    try {
      await axios.post('/api/templates', { name: tplName, notes: tplNotes || null, objective: saveTpl.objective, dailyBudget: saveTpl.dailyBudget || null });
      setMsg('✅ Template saved');
      setSaveTpl(null);
      setTplName('');
      setTplNotes('');
    } catch (err: any) { setError(err?.response?.data?.message || err.message); }
    finally { setTplBusy(false); }
  };

  const toggleAdsetStatus = async (adset: AdSetItem, action: 'pause' | 'resume') => {
    setAdSetBusy(adset.id);
    try {
      await axios.post(`/api/adsets/${adset.id}/${action}`);
      setAdSets(prev => prev.map(a => a.id === adset.id ? { ...a, status: action === 'pause' ? 'PAUSED' : 'ACTIVE' } : a));
    } catch (err: any) { setError(err?.response?.data?.message || err.message); }
    finally { setAdSetBusy(null); }
  };

  const saveBudget = async () => {
    if (!editBudget) return;
    setAdSetBusy(editBudget.id);
    try {
      await axios.patch(`/api/adsets/${editBudget.id}/budget`, { dailyBudget: editBudget.budget });
      setAdSets(prev => prev.map(a => a.id === editBudget.id ? { ...a, dailyBudget: editBudget.budget } : a));
      setEditBudget(null);
      setMsg('✅ Budget updated');
    } catch (err: any) { setError(err?.response?.data?.message || err.message); }
    finally { setAdSetBusy(null); }
  };

  // ─── Export CSV ───

  const exportCsv = () => {
    const rows = allCampaigns.map((c) => [
      c.name, c._account.name, objLabel(c.objective), c.status,
      c.dailyBudget ? fmtCurr(c.dailyBudget, c._account.currency) : '-',
      c.spent ? fmtCurr(c.spent, c._account.currency) : '-',
      fmtPct(c.ctr), c.conversions || '0',
    ]);
    const csv = ['Name,Account,Objective,Status,Daily Budget,Spent,CTR,Conversions', ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campaigns-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Render ───

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b1120]">
        <p className="text-slate-400 animate-pulse">Loading campaigns...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-200">
      {/* Header */}
      <header className="bg-[#1e293b] border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold">FB Ads Platform</h1>
            <nav className="flex gap-4 text-sm">
              <a href="/dashboard" className="text-gray-400 hover:text-gray-200">Dashboard</a>
              <a href="/dashboard/all-campaigns" className="text-blue-400 font-medium hover:text-blue-300">📋 All Campaigns</a>
              <a href="/dashboard/campaigns/new" className="text-gray-400 hover:text-gray-200">🎯 New Campaign</a>
              <a href="/dashboard/rules" className="text-gray-400 hover:text-gray-200">⚡ Rules</a>
              <a href="/dashboard/analytics" className="text-gray-400 hover:text-gray-200">📊 Analytics</a>
              <a href="/dashboard/audiences" className="text-gray-400 hover:text-gray-200">🎯 Audiences</a>
              <a href="/dashboard/schedules" className="text-gray-400 hover:text-gray-200">📅 Schedules</a>
              <a href="/dashboard/templates" className="text-gray-400 hover:text-gray-200">📦 Templates</a>
              <a href="/dashboard/abtest" className="text-gray-400 hover:text-gray-200">🔁 A/B Test</a>
              <a href="/dashboard/budget" className="text-gray-400 hover:text-gray-200">💰 Budget</a>
              <a href="/dashboard/notifications" className="text-gray-400 hover:text-gray-200">🔔 Alerts</a>
              <a href="/dashboard/creatives" className="text-gray-400 hover:text-gray-200">🎨 Creatives</a>
            </nav>
          </div>
          <button onClick={() => { localStorage.removeItem('token'); window.location.href = '/'; }}
            className="text-sm text-gray-500 hover:text-red-400">Sign Out</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Title */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">📋 All Campaigns</h2>
            <p className="text-sm text-slate-500 mt-1">{allCampaigns.length} campaigns across {accounts.length} ad accounts</p>
          </div>
          <button onClick={fetchAll} disabled={loading}
            className="bg-[#1e293b] text-slate-300 px-4 py-2 rounded-lg hover:bg-[#293548] text-sm font-medium disabled:opacity-50 border border-slate-700/50">
            🔄 Refresh</button>
        </div>

        {/* Messages */}
        {msg && (
          <div className="mb-4 px-4 py-3 rounded-lg text-sm bg-green-900/30 text-green-400 border border-green-800/50">
            {msg}
            <button className="float-right" onClick={() => setMsg('')}>✕</button>
          </div>
        )}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg text-sm bg-red-900/30 text-red-400 border border-red-800/50">
            {error}
            <button className="float-right" onClick={() => setError('')}>✕</button>
          </div>
        )}

        {/* Bulk Action Bar */}
        {hasChecked && (
          <div className="bg-[#1e293b] border border-slate-700/50 rounded-xl px-5 py-3 mb-4 flex items-center justify-between">
            <span className="text-sm text-slate-400"><strong className="text-slate-200">{checkedIds.length}</strong> selected</span>
            <div className="flex gap-2">
              <button onClick={() => setConfirmAction({ type: 'pause', ids: checkedIds })} disabled={busy}
                className="px-4 py-1.5 bg-yellow-900/40 text-yellow-400 rounded-lg text-sm font-medium hover:bg-yellow-800/50 disabled:opacity-50">⏸ Pause</button>
              <button onClick={() => setConfirmAction({ type: 'resume', ids: checkedIds })} disabled={busy}
                className="px-4 py-1.5 bg-green-900/40 text-green-400 rounded-lg text-sm font-medium hover:bg-green-800/50 disabled:opacity-50">▶️ Resume</button>
              <button onClick={() => setConfirmAction({ type: 'delete', ids: checkedIds })} disabled={busy}
                className="px-4 py-1.5 bg-red-900/40 text-red-400 rounded-lg text-sm font-medium hover:bg-red-800/50 disabled:opacity-50">🗑 Delete</button>
              <button onClick={exportCsv}
                className="px-4 py-1.5 bg-purple-900/40 text-purple-400 rounded-lg text-sm font-medium hover:bg-purple-800/50">📥 CSV</button>
            </div>
          </div>
        )}

        {/* Table */}
        {allCampaigns.length === 0 ? (
          <div className="bg-[#1e293b] rounded-xl border border-slate-700/50 p-12 text-center">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-lg font-medium mb-1 text-slate-300">No campaigns found</p>
            <p className="text-sm text-slate-500">Sync your ad accounts from the Dashboard to import campaigns.</p>
          </div>
        ) : (
          <div className="bg-[#1e293b] rounded-xl border border-slate-700/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#0b1120]/50 border-b border-slate-700/50">
                    <th className="px-3 py-3 text-left w-10">
                      <input type="checkbox" checked={allCampaigns.length > 0 && checked.size === allCampaigns.length}
                        onChange={toggleSelectAll} className="rounded border-gray-600 bg-slate-700" />
                    </th>
                    <th className="px-3 py-3 text-left font-medium text-slate-500">Name</th>
                    <th className="px-3 py-3 text-left font-medium text-slate-500">Account</th>
                    <th className="px-3 py-3 text-left font-medium text-slate-500">Objective</th>
                    <th className="px-3 py-3 text-left font-medium text-slate-500">Status</th>
                    <th className="px-3 py-3 text-right font-medium text-slate-500">Budget</th>
                    <th className="px-3 py-3 text-right font-medium text-slate-500">Spent</th>
                    <th className="px-3 py-3 text-center font-medium text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((acct) =>
                    acct.campaigns.length === 0 ? null : (
                      acct.campaigns.map((camp) => {
                        const isChecked = checked.has(camp.id);
                        return (
                          <tr key={camp.id}
                            className={`border-t border-slate-800/50 hover:bg-slate-800/30 transition-colors ${isChecked ? 'bg-blue-900/20' : ''}`}>
                            <td className="px-3 py-3">
                              <input type="checkbox" checked={isChecked} onChange={() => toggleCheck(camp.id)} className="rounded border-gray-600 bg-slate-700" />
                            </td>
                            <td className="px-3 py-3"><span className="font-medium">{camp.name}</span></td>
                            <td className="px-3 py-3 text-slate-500 text-xs">{acct.name}</td>
                            <td className="px-3 py-3 text-xs text-slate-400">{objLabel(camp.objective)}</td>
                            <td className="px-3 py-3">
                              <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[camp.status] || 'bg-gray-100 text-gray-600'}`}>{camp.status}</span>
                            </td>
                            <td className="px-3 py-3 text-right text-sm font-medium">
                              {camp.dailyBudget ? fmtCurr(camp.dailyBudget, acct.currency) : '-'}
                            </td>
                            <td className="px-3 py-3 text-right text-sm">
                              {camp.spent ? fmtCurr(camp.spent, acct.currency) : '-'}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <div className="flex items-center justify-center gap-1 flex-wrap">
                                <button onClick={() => openAdSets(camp.id, camp.name, acct.currency)}
                                  className="text-xs px-2 py-1 rounded font-medium bg-indigo-900/40 text-indigo-400 hover:bg-indigo-800/50"
                                  title="Ad Sets">📦 Ad Sets</button>
                                <button onClick={() => { setCloneModal({ id: camp.id, name: camp.name, type: 'campaign' }); setCloneName(`Copy of ${camp.name}`); }}
                                  className="text-xs px-2 py-1 rounded font-medium bg-purple-900/40 text-purple-400 hover:bg-purple-800/50"
                                  title="Clone">🔀 Clone</button>
                                <button onClick={() => { setChecked(new Set([camp.id])); setConfirmAction({ type: camp.status === 'ACTIVE' ? 'pause' : 'resume', ids: [camp.id] }); }}
                                  className="text-xs px-2 py-1 rounded font-medium bg-blue-900/40 text-blue-400 hover:bg-blue-800/50"
                                  title={camp.status === 'ACTIVE' ? 'Pause' : 'Resume'}>{camp.status === 'ACTIVE' ? '⏸' : '▶️'}</button>
                                <button onClick={() => { setSaveTpl({ id: camp.id, name: camp.name, objective: camp.objective, dailyBudget: Number(camp.dailyBudget || 0) }); setTplName(`${camp.name} Template`); setTplNotes(''); }}
                                  className="text-xs px-2 py-1 rounded font-medium bg-teal-900/40 text-teal-400 hover:bg-teal-800/50" title="Save as Template">💾 Tpl</button>
                                <button onClick={() => { setChecked(new Set([camp.id])); setConfirmAction({ type: 'delete', ids: [camp.id] }); }}
                                  className="text-xs px-2 py-1 rounded font-medium bg-red-900/40 text-red-400 hover:bg-red-800/50" title="Delete">🗑</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ),
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-slate-700/50 bg-[#0b1120]/50 text-xs text-slate-500 flex items-center justify-between">
              <span>Showing {allCampaigns.length} campaign{allCampaigns.length !== 1 ? 's' : ''} from {accounts.length} account{accounts.length !== 1 ? 's' : ''}</span>
              <button onClick={exportCsv} className="text-purple-400 hover:text-purple-300 font-medium">📥 Export CSV</button>
            </div>
          </div>
        )}
      </main>

      {/* ─── Confirmation Modal ─── */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setConfirmAction(null)}>
          <div className="bg-[#1e293b] rounded-xl shadow-xl p-6 w-full max-w-sm mx-4 border border-slate-700/50" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">
              {confirmAction.type === 'pause' ? '⏸ Pause Campaigns' : confirmAction.type === 'resume' ? '▶️ Resume Campaigns' : '🗑 Delete Campaigns'}
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              {confirmAction.type === 'delete'
                ? `Are you sure you want to delete ${confirmAction.ids.length} campaign${confirmAction.ids.length > 1 ? 's' : ''}?`
                : `Are you sure you want to ${confirmAction.type} ${confirmAction.ids.length} campaign${confirmAction.ids.length > 1 ? 's' : ''}?`}
            </p>
            {confirmAction.type === 'delete' && <p className="text-xs text-red-400 mb-4 font-medium">⚠ This cannot be undone.</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmAction(null)} className="px-4 py-2 border border-slate-600 rounded-lg text-sm hover:bg-slate-700 text-slate-300">Cancel</button>
              <button onClick={() => executeBulkAction(confirmAction.type)} disabled={busy}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 ${
                  confirmAction.type === 'delete' ? 'bg-red-600 hover:bg-red-700' : confirmAction.type === 'pause' ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'
                }`}>
                {busy ? 'Processing...' : confirmAction.type === 'pause' ? '⏸ Pause' : confirmAction.type === 'resume' ? '▶️ Resume' : '🗑 Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Ad Sets Modal ─── */}
      {adSetModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => { setAdSetModal(null); setEditBudget(null); }}>
          <div className="bg-[#1e293b] rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[80vh] flex flex-col border border-slate-700/50" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="p-4 border-b border-slate-700/50 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-semibold">📦 Ad Sets</h3>
                <p className="text-sm text-slate-400">{adSetModal.campaignName}</p>
              </div>
              <button onClick={() => { setAdSetModal(null); setEditBudget(null); }}
                className="text-slate-400 hover:text-slate-200 text-xl">✕</button>
            </div>

            {/* Body */}
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {adSetLoading ? (
                <p className="text-center text-slate-400 py-8 animate-pulse">Loading ad sets...</p>
              ) : adSets.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <p className="text-3xl mb-2">📦</p>
                  <p>No ad sets found for this campaign</p>
                </div>
              ) : (
                adSets.map(as => (
                  <div key={as.id} className="bg-[#0b1120] rounded-lg p-3 border border-slate-700/30">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{as.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${AS_STATUS_COLORS[as.status] || 'bg-gray-900/40 text-gray-400 border-gray-700'}`}>{as.status}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {as.status === 'ACTIVE' ? (
                          <button onClick={() => toggleAdsetStatus(as, 'pause')} disabled={adSetBusy === as.id}
                            className="text-xs px-2 py-1 rounded bg-yellow-900/40 text-yellow-400 hover:bg-yellow-800/50 disabled:opacity-50">
                            {adSetBusy === as.id ? '...' : '⏸ Pause'}
                          </button>
                        ) : (
                          <button onClick={() => toggleAdsetStatus(as, 'resume')} disabled={adSetBusy === as.id}
                            className="text-xs px-2 py-1 rounded bg-green-900/40 text-green-400 hover:bg-green-800/50 disabled:opacity-50">
                            {adSetBusy === as.id ? '...' : '▶️ Resume'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-2 text-xs mb-2">
                      <div><span className="text-slate-500">Budget</span>
                        <p className="font-mono text-slate-200">
                          {as.dailyBudget > 0 ? fmtCurr(as.dailyBudget, adSetModal.currency) : '-'}
                        </p>
                      </div>
                      <div><span className="text-slate-500">Spend</span>
                        <p className="font-mono text-slate-200">{fmtCurr(as.spend, adSetModal.currency)}</p>
                      </div>
                      <div><span className="text-slate-500">CTR</span>
                        <p className="font-mono text-slate-200">{fmtPct(as.ctr)}</p>
                      </div>
                      <div><span className="text-slate-500">Conv.</span>
                        <p className="font-mono text-slate-200">{as.conversions}</p>
                      </div>
                    </div>

                    {/* Meta */}
                    <div className="flex flex-wrap gap-2 text-[10px] text-slate-500">
                      <span>📎 {as.adCount} ads</span>
                      {as.optimizationGoal && <span>🎯 {as.optimizationGoal}</span>}
                      {as.bidStrategy && <span>💵 {as.bidStrategy}</span>}
                    </div>

                    {/* Edit Budget Button */}
                    <div className="mt-2">
                      {editBudget?.id === as.id ? (
                        <div className="flex items-center gap-2">
                          <input type="number" value={editBudget.budget} min={1}
                            onChange={e => setEditBudget({ ...editBudget, budget: Number(e.target.value) || 0 })}
                            className="w-32 bg-[#1e293b] border border-slate-600 rounded px-2 py-1 text-xs text-slate-200" />
                          <button onClick={saveBudget} disabled={adSetBusy === as.id}
                            className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                            {adSetBusy === as.id ? '...' : 'Save'}
                          </button>
                          <button onClick={() => setEditBudget(null)}
                            className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setEditBudget({ id: as.id, name: as.name, budget: as.dailyBudget })}
                          className="text-xs px-2 py-1 rounded bg-blue-900/40 text-blue-400 hover:bg-blue-800/50">✏️ Edit Budget</button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-700/50 text-center text-xs text-slate-500 shrink-0">
              {adSets.length} ad set{adSets.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      )}

      {/* ─── Save as Template Modal ─── */}
      {saveTpl && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setSaveTpl(null)}>
          <div className="bg-[#1e293b] rounded-xl shadow-xl w-full max-w-md mx-4 border border-slate-700/50" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">💾 Save as Template</h3>
                <p className="text-sm text-slate-400">{saveTpl.name}</p>
              </div>
              <button onClick={() => setSaveTpl(null)} className="text-slate-400 hover:text-slate-200 text-xl">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <label className="block text-xs text-slate-400 mb-1">Template Name *</label>
              <input type="text" value={tplName} onChange={e => setTplName(e.target.value)}
                className="w-full bg-[#0b1120] border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200" />
              <label className="block text-xs text-slate-400 mb-1">Notes (optional)</label>
              <textarea value={tplNotes} onChange={e => setTplNotes(e.target.value)} rows={3} placeholder="When to use this template..."
                className="w-full bg-[#0b1120] border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500" />
            </div>
            <div className="p-4 border-t border-slate-700/50 flex justify-end gap-2">
              <button onClick={() => setSaveTpl(null)}
                className="px-4 py-2 border border-slate-600 rounded-lg text-sm text-slate-300 hover:bg-slate-700">Cancel</button>
              <button onClick={saveAsTemplate} disabled={tplBusy || !tplName.trim()}
                className="px-4 py-2 bg-teal-600 rounded-lg text-sm text-white hover:bg-teal-700 disabled:opacity-50">
                {tplBusy ? 'Saving...' : '💾 Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Clone Campaign Modal ─── */}
      {cloneModal && cloneModal.type === 'campaign' && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setCloneModal(null)}>
          <div className="bg-[#1e293b] rounded-xl shadow-xl w-full max-w-md mx-4 border border-slate-700/50" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">🔀 Clone Campaign</h3>
                <p className="text-sm text-slate-400">{cloneModal.name}</p>
              </div>
              <button onClick={() => setCloneModal(null)} className="text-slate-400 hover:text-slate-200 text-xl">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <label className="block text-xs text-slate-400 mb-1">New Campaign Name</label>
              <input type="text" value={cloneName}
                onChange={e => setCloneName(e.target.value)}
                className="w-full bg-[#0b1120] border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200" />
              <p className="text-xs text-slate-500">The cloned campaign will start in <strong className="text-yellow-400">PAUSED</strong> status.</p>
            </div>
            <div className="p-4 border-t border-slate-700/50 flex justify-end gap-2">
              <button onClick={() => setCloneModal(null)}
                className="px-4 py-2 border border-slate-600 rounded-lg text-sm text-slate-300 hover:bg-slate-700">Cancel</button>
              <button onClick={cloneCampaign} disabled={cloneBusy || !cloneName.trim()}
                className="px-4 py-2 bg-purple-600 rounded-lg text-sm text-white hover:bg-purple-700 disabled:opacity-50">
                {cloneBusy ? 'Cloning...' : '🔀 Clone'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
