'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import Shell from '@/components/Shell';
import PageHeader from '@/components/PageHeader';
import Modal, { ConfirmModal } from '@/components/Modal';
import { objLabel, fmtCurr, fmtNum, fmtPct, STATUS_COLORS } from '@/lib/utils';

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

const AS_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'badge-success',
  PAUSED: 'badge-warning',
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

  const confirmIcon = confirmAction?.type === 'pause' ? '⏸' : confirmAction?.type === 'resume' ? '▶️' : '🗑';
  const confirmLabel = confirmAction?.type === 'pause' ? 'Pause' : confirmAction?.type === 'resume' ? 'Resume' : 'Delete';
  const confirmVariant = confirmAction?.type === 'delete' ? 'danger' : confirmAction?.type === 'pause' ? 'warning' : 'primary';

  // ─── Render ───

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-24">
          <p className="text-ink-300 animate-pulse">Loading campaigns...</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="px-6 py-6">
        {/* Title */}
        <PageHeader
          title="📋 All Campaigns"
          subtitle={`${allCampaigns.length} campaigns across ${accounts.length} ad accounts`}
          actions={
            <button onClick={fetchAll} disabled={loading}
              className="btn-secondary btn-sm disabled:opacity-50">
              🔄 Refresh
            </button>
          }
        />

        {/* Messages */}
        {msg && (
          <div className="msg-success mb-4">
            {msg}
            <button className="float-right font-bold" onClick={() => setMsg('')}>✕</button>
          </div>
        )}
        {error && (
          <div className="msg-error mb-4">
            {error}
            <button className="float-right font-bold" onClick={() => setError('')}>✕</button>
          </div>
        )}

        {/* Bulk Action Bar */}
        {hasChecked && (
          <div className="card px-5 py-3 mb-4 flex items-center justify-between">
            <span className="text-sm text-ink-200"><strong className="text-ink">{checkedIds.length}</strong> selected</span>
            <div className="flex gap-2">
              <button onClick={() => setConfirmAction({ type: 'pause', ids: checkedIds })} disabled={busy}
                className="btn bg-warning-muted text-warning border border-warning-border hover:bg-warning/20 text-sm font-medium disabled:opacity-50 px-4 py-1.5 rounded-lg">⏸ Pause</button>
              <button onClick={() => setConfirmAction({ type: 'resume', ids: checkedIds })} disabled={busy}
                className="btn bg-success-muted text-success border border-success-border hover:bg-success/20 text-sm font-medium disabled:opacity-50 px-4 py-1.5 rounded-lg">▶️ Resume</button>
              <button onClick={() => setConfirmAction({ type: 'delete', ids: checkedIds })} disabled={busy}
                className="btn bg-danger-muted text-danger border border-danger-border hover:bg-danger/20 text-sm font-medium disabled:opacity-50 px-4 py-1.5 rounded-lg">🗑 Delete</button>
              <button onClick={exportCsv}
                className="btn bg-accent-muted text-accent border border-accent-border hover:bg-accent/20 text-sm font-medium px-4 py-1.5 rounded-lg">📥 CSV</button>
            </div>
          </div>
        )}

        {/* Table */}
        {allCampaigns.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-lg font-medium mb-1 text-ink">No campaigns found</p>
            <p className="text-sm text-ink-300">Sync your ad accounts from the Dashboard to import campaigns.</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-200/50 border-b border-surface-300">
                    <th className="px-3 py-3 text-left w-10">
                      <input type="checkbox" checked={allCampaigns.length > 0 && checked.size === allCampaigns.length}
                        onChange={toggleSelectAll} className="rounded border-ink-200 bg-surface-200" />
                    </th>
                    <th className="px-3 py-3 text-left font-medium text-ink-300">Name</th>
                    <th className="px-3 py-3 text-left font-medium text-ink-300">Account</th>
                    <th className="px-3 py-3 text-left font-medium text-ink-300">Objective</th>
                    <th className="px-3 py-3 text-left font-medium text-ink-300">Status</th>
                    <th className="px-3 py-3 text-right font-medium text-ink-300">Budget</th>
                    <th className="px-3 py-3 text-right font-medium text-ink-300">Spent</th>
                    <th className="px-3 py-3 text-center font-medium text-ink-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((acct) =>
                    acct.campaigns.length === 0 ? null : (
                      acct.campaigns.map((camp) => {
                        const isChecked = checked.has(camp.id);
                        return (
                          <tr key={camp.id}
                            className={`hover:bg-surface-200/30 transition-colors border-b border-surface-300 ${isChecked ? 'bg-accent-muted/30' : ''}`}>
                            <td className="px-3 py-3">
                              <input type="checkbox" checked={isChecked} onChange={() => toggleCheck(camp.id)} className="rounded border-ink-200 bg-surface-200" />
                            </td>
                            <td className="px-3 py-3"><span className="font-medium text-ink">{camp.name}</span></td>
                            <td className="px-3 py-3 text-ink-200 text-xs">{acct.name}</td>
                            <td className="px-3 py-3 text-xs text-ink-200">{objLabel(camp.objective)}</td>
                            <td className="px-3 py-3">
                              <span className={STATUS_COLORS[camp.status] || 'badge-ink'}>{camp.status}</span>
                            </td>
                            <td className="px-3 py-3 text-right text-sm font-medium text-ink">
                              {camp.dailyBudget ? fmtCurr(camp.dailyBudget, acct.currency) : '-'}
                            </td>
                            <td className="px-3 py-3 text-right text-sm text-ink">
                              {camp.spent ? fmtCurr(camp.spent, acct.currency) : '-'}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <div className="flex items-center justify-center gap-1 flex-wrap">
                                <button onClick={() => openAdSets(camp.id, camp.name, acct.currency)}
                                  className="text-xs px-2 py-1 rounded font-medium bg-accent-muted text-accent hover:bg-accent/20"
                                  title="Ad Sets">📦 Ad Sets</button>
                                <button onClick={() => { setCloneModal({ id: camp.id, name: camp.name, type: 'campaign' }); setCloneName(`Copy of ${camp.name}`); }}
                                  className="text-xs px-2 py-1 rounded font-medium bg-accent-muted text-accent hover:bg-accent/20"
                                  title="Clone">🔀 Clone</button>
                                <button onClick={() => { setChecked(new Set([camp.id])); setConfirmAction({ type: camp.status === 'ACTIVE' ? 'pause' : 'resume', ids: [camp.id] }); }}
                                  className="text-xs px-2 py-1 rounded font-medium bg-accent-muted text-accent hover:bg-accent/20"
                                  title={camp.status === 'ACTIVE' ? 'Pause' : 'Resume'}>{camp.status === 'ACTIVE' ? '⏸' : '▶️'}</button>
                                <button onClick={() => { setSaveTpl({ id: camp.id, name: camp.name, objective: camp.objective, dailyBudget: Number(camp.dailyBudget || 0) }); setTplName(`${camp.name} Template`); setTplNotes(''); }}
                                  className="text-xs px-2 py-1 rounded font-medium bg-success-muted text-success hover:bg-success/20" title="Save as Template">💾 Tpl</button>
                                <button onClick={() => { setChecked(new Set([camp.id])); setConfirmAction({ type: 'delete', ids: [camp.id] }); }}
                                  className="text-xs px-2 py-1 rounded font-medium bg-danger-muted text-danger hover:bg-danger/20" title="Delete">🗑</button>
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
            <div className="px-4 py-3 bg-surface-200/50 text-xs text-ink-300 flex items-center justify-between border-t border-surface-300">
              <span>Showing {allCampaigns.length} campaign{allCampaigns.length !== 1 ? 's' : ''} from {accounts.length} account{accounts.length !== 1 ? 's' : ''}</span>
              <button onClick={exportCsv} className="text-accent hover:text-accent/80 font-medium">📥 Export CSV</button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Confirmation Modal ─── */}
      <ConfirmModal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => executeBulkAction(confirmAction!.type)}
        title={`${confirmIcon} ${confirmLabel} Campaigns`}
        message={
          confirmAction?.type === 'delete'
            ? `Are you sure you want to delete ${confirmAction.ids.length} campaign${confirmAction.ids.length > 1 ? 's' : ''}?`
            : `Are you sure you want to ${confirmAction?.type} ${confirmAction?.ids.length} campaign${confirmAction?.ids.length > 1 ? 's' : ''}?`
        }
        confirmLabel={confirmLabel}
        confirmVariant={confirmVariant}
        busy={busy}
        icon={confirmIcon}
        danger={confirmAction?.type === 'delete'}
      />

      {/* ─── Ad Sets Modal ─── */}
      <Modal
        open={!!adSetModal}
        onClose={() => { setAdSetModal(null); setEditBudget(null); }}
        title="Ad Sets"
        icon="📦"
        maxWidth="max-w-3xl"
      >
        <p className="text-sm text-ink-200 mb-3">{adSetModal?.campaignName}</p>

        <div className="space-y-3 max-h-[50vh] overflow-y-auto">
          {adSetLoading ? (
            <p className="text-center text-ink-300 py-8 animate-pulse">Loading ad sets...</p>
          ) : adSets.length === 0 ? (
            <div className="text-center py-8 text-ink-300">
              <p className="text-3xl mb-2">📦</p>
              <p>No ad sets found for this campaign</p>
            </div>
          ) : (
            adSets.map(as => (
              <div key={as.id} className="bg-surface-200 rounded-lg p-3 border border-surface-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-ink">{as.name}</span>
                    <span className={AS_STATUS_COLORS[as.status] || 'badge-ink'}>{as.status}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {as.status === 'ACTIVE' ? (
                      <button onClick={() => toggleAdsetStatus(as, 'pause')} disabled={adSetBusy === as.id}
                        className="text-xs px-2 py-1 rounded bg-warning-muted text-warning hover:bg-warning/20 disabled:opacity-50">
                        {adSetBusy === as.id ? '...' : '⏸ Pause'}
                      </button>
                    ) : (
                      <button onClick={() => toggleAdsetStatus(as, 'resume')} disabled={adSetBusy === as.id}
                        className="text-xs px-2 py-1 rounded bg-success-muted text-success hover:bg-success/20 disabled:opacity-50">
                        {adSetBusy === as.id ? '...' : '▶️ Resume'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-2 text-xs mb-2">
                  <div><span className="text-ink-300">Budget</span>
                    <p className="font-mono text-ink">
                      {as.dailyBudget > 0 ? fmtCurr(as.dailyBudget, adSetModal!.currency) : '-'}
                    </p>
                  </div>
                  <div><span className="text-ink-300">Spend</span>
                    <p className="font-mono text-ink">{fmtCurr(as.spend, adSetModal!.currency)}</p>
                  </div>
                  <div><span className="text-ink-300">CTR</span>
                    <p className="font-mono text-ink">{fmtPct(as.ctr)}</p>
                  </div>
                  <div><span className="text-ink-300">Conv.</span>
                    <p className="font-mono text-ink">{as.conversions}</p>
                  </div>
                </div>

                {/* Meta */}
                <div className="flex flex-wrap gap-2 text-[10px] text-ink-300">
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
                        className="w-32 bg-surface-100 border border-ink-200 rounded px-2 py-1 text-xs text-ink" />
                      <button onClick={saveBudget} disabled={adSetBusy === as.id}
                        className="btn-primary btn-xs disabled:opacity-50">
                        {adSetBusy === as.id ? '...' : 'Save'}
                      </button>
                      <button onClick={() => setEditBudget(null)}
                        className="btn-secondary btn-xs">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setEditBudget({ id: as.id, name: as.name, budget: as.dailyBudget })}
                      className="text-xs px-2 py-1 rounded bg-accent-muted text-accent hover:bg-accent/20">✏️ Edit Budget</button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-ink-300 mt-3 pt-3 border-t border-surface-300">
          {adSets.length} ad set{adSets.length !== 1 ? 's' : ''}
        </div>
      </Modal>

      {/* ─── Save as Template Modal ─── */}
      <Modal
        open={!!saveTpl}
        onClose={() => setSaveTpl(null)}
        title="Save as Template"
        icon="💾"
      >
        <p className="text-sm text-ink-200 mb-3">{saveTpl?.name}</p>
        <div className="space-y-3">
          <label className="block text-xs text-ink-300 mb-1">Template Name *</label>
          <input type="text" value={tplName} onChange={e => setTplName(e.target.value)}
            className="w-full bg-surface-200 border border-ink-200 rounded-lg px-3 py-2 text-sm text-ink" />
          <label className="block text-xs text-ink-300 mb-1">Notes (optional)</label>
          <textarea value={tplNotes} onChange={e => setTplNotes(e.target.value)} rows={3} placeholder="When to use this template..."
            className="w-full bg-surface-200 border border-ink-200 rounded-lg px-3 py-2 text-sm text-ink placeholder-ink-300" />
        </div>
        <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-surface-300">
          <button onClick={() => setSaveTpl(null)}
            className="btn-secondary btn-sm">Cancel</button>
          <button onClick={saveAsTemplate} disabled={tplBusy || !tplName.trim()}
            className="btn-success btn-sm disabled:opacity-50">
            {tplBusy ? 'Saving...' : '💾 Save Template'}
          </button>
        </div>
      </Modal>

      {/* ─── Clone Campaign Modal ─── */}
      <Modal
        open={!!(cloneModal && cloneModal.type === 'campaign')}
        onClose={() => setCloneModal(null)}
        title="Clone Campaign"
        icon="🔀"
      >
        <p className="text-sm text-ink-200 mb-3">{cloneModal?.name}</p>
        <div className="space-y-3">
          <label className="block text-xs text-ink-300 mb-1">New Campaign Name</label>
          <input type="text" value={cloneName}
            onChange={e => setCloneName(e.target.value)}
            className="w-full bg-surface-200 border border-ink-200 rounded-lg px-3 py-2 text-sm text-ink" />
          <p className="text-xs text-ink-300">The cloned campaign will start in <strong className="text-warning">PAUSED</strong> status.</p>
        </div>
        <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-surface-300">
          <button onClick={() => setCloneModal(null)}
            className="btn-secondary btn-sm">Cancel</button>
          <button onClick={cloneCampaign} disabled={cloneBusy || !cloneName.trim()}
            className="btn-primary btn-sm disabled:opacity-50">
            {cloneBusy ? 'Cloning...' : '🔀 Clone'}
          </button>
        </div>
      </Modal>
    </Shell>
  );
}
