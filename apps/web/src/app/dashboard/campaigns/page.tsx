'use client';

import { useState, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ClipboardList, RefreshCw, Sparkles, Pause, Play, Trash2, Download, Package, Shuffle, Save, X, Target, DollarSign, Palette, Rocket, BarChart3, Pencil } from 'lucide-react';
import Shell from '@/components/Shell';
import PageHeader from '@/components/PageHeader';
import Modal, { ConfirmModal } from '@/components/Modal';
import TargetingBuilder from '@/components/TargetingBuilder';
import { objLabel, fmtCurr, fmtPct, STATUS_COLORS } from '@/lib/utils';
import { useCampaigns, useCreateCampaign, useDeleteCampaign, useCloneCampaign, useSaveTemplate, useBulkAction } from '@/hooks/use-campaigns';
import { useAdSets, useToggleAdSet, useUpdateAdSetBudget } from '@/hooks/use-adsets';
import { useAdAccounts } from '@/hooks/use-accounts';
import type { AdSetItem } from '@/lib/api-client';

// ─── Types ───

interface BulkResult {
  id: string; name: string; success: boolean; error?: string; status?: string;
}

const AS_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'badge-success',
  PAUSED: 'badge-warning',
};

// ─── New Campaign Form Constants ───

const OBJECTIVES = [
  { key: 'OUTCOME_AWARENESS', label: <span className="inline-flex items-center gap-1"><Sparkles className="w-4 h-4" /> Awareness</span>, desc: 'Reach the most people' },
  { key: 'OUTCOME_TRAFFIC', label: <span className="inline-flex items-center gap-1"><Target className="w-4 h-4" /> Traffic</span>, desc: 'Drive visits to your website' },
  { key: 'OUTCOME_ENGAGEMENT', label: <span className="inline-flex items-center gap-1"><Sparkles className="w-4 h-4" /> Engagement</span>, desc: 'Get more likes, comments, shares' },
  { key: 'OUTCOME_LEADS', label: <span className="inline-flex items-center gap-1"><ClipboardList className="w-4 h-4" /> Leads</span>, desc: 'Collect leads and sign-ups' },
  { key: 'OUTCOME_SALES', label: <span className="inline-flex items-center gap-1"><DollarSign className="w-4 h-4" /> Sales</span>, desc: 'Drive conversions and sales' },
  { key: 'OUTCOME_APP_PROMOTION', label: <span className="inline-flex items-center gap-1"><Rocket className="w-4 h-4" /> App Promotion</span>, desc: 'Promote your app installs' },
];

type DrawerMode = 'wizard' | 'quick';

interface FormErrors {
  name?: string; dailyBudget?: string; adAccountId?: string; adName?: string;
}

function estimateBudgetBreakdown(budget: number) {
  const estimatedDailyReach = Math.round(budget * 120);
  const estimatedCpc = budget > 0 ? (budget / (estimatedDailyReach * 0.05)).toFixed(2) : '0.00';
  const estimatedCpm = budget > 0 ? (budget / (estimatedDailyReach / 1000)).toFixed(2) : '0.00';
  return { dailySpend: Math.round(budget * 100) / 100, estimatedDailyReach, estimatedCpc, estimatedCpm };
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

// ─── Inner page (needs searchParams) ───

function CampaignsPageInner() {
  const searchParams = useSearchParams();

  // ─── React Query hooks ───
  const { data: accounts = [], isLoading, error: queryError, refetch } = useCampaigns();
  const { data: adAccounts = [] } = useAdAccounts();
  const createCampaignMutation = useCreateCampaign();
  const deleteCampaignMutation = useDeleteCampaign();
  const cloneCampaignMutation = useCloneCampaign();
  const saveTemplateMutation = useSaveTemplate();
  const bulkActionMutation = useBulkAction();

  // AdSet hooks (lazy — only when modal open)
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const { data: adSets = [], isLoading: adSetLoading } = useAdSets(activeCampaignId);
  const toggleAdSetMutation = useToggleAdSet();
  const updateBudgetMutation = useUpdateAdSetBudget();

  // ─── UI-only state ───
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'pause' | 'resume' | 'delete'; ids: string[] } | null>(null);

  const [adSetModal, setAdSetModal] = useState<{ campaignId: string; campaignName: string; currency: string } | null>(null);
  const [editBudget, setEditBudget] = useState<{ id: string; name: string; budget: number } | null>(null);

  const [cloneModal, setCloneModal] = useState<{ id: string; name: string; type: 'campaign' | 'creative' } | null>(null);
  const [cloneName, setCloneName] = useState('');

  const [saveTpl, setSaveTpl] = useState<{ id: string; name: string; objective: string; dailyBudget: number } | null>(null);
  const [tplName, setTplName] = useState('');
  const [tplNotes, setTplNotes] = useState('');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('wizard');
  const [drawerStep, setDrawerStep] = useState(1);
  const [drawerMsg, setDrawerMsg] = useState('');
  const [drawerError, setDrawerError] = useState('');
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({
    adAccountId: '',
    name: '', objective: 'OUTCOME_TRAFFIC', dailyBudget: 300,
    status: 'PAUSED', adSetName: '', optimizationGoal: 'REACH',
    billingEvent: 'IMPRESSIONS', adName: '', creativeMessage: '',
    creativeLink: '', pageId: '', createAd: false,
    targeting: {} as Record<string, any>,
  });

  // Init ad account from query data
  useState(() => {
    if (adAccounts.length > 0 && !form.adAccountId) {
      setForm(f => ({ ...f, adAccountId: adAccounts[0].id }));
    }
  });

  // Open drawer from URL param
  useState(() => {
    if (searchParams.get('new') === '1') setDrawerOpen(true);
  });

  // ─── Derived ───
  const allCampaigns = accounts.flatMap((acct) =>
    acct.campaigns.map((camp) => ({ ...camp, _account: acct })),
  );

  const toggleCheck = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (checked.size === allCampaigns.length) {
      setChecked(new Set()); setSelectAll(false);
    } else {
      setChecked(new Set(allCampaigns.map((c) => c.id))); setSelectAll(true);
    }
  };

  const checkedIds = Array.from(checked);
  const hasChecked = checkedIds.length > 0;

  // ─── Bulk Action ───
  const executeBulkAction = useCallback(async (type: 'pause' | 'resume' | 'delete') => {
    const ids = confirmAction?.ids || checkedIds;
    if (ids.length === 0) return;
    setConfirmAction(null);
    setMsg(''); setError('');
    try {
      const data = await bulkActionMutation.mutateAsync({ action: type, ids });
      const succeeded = data.results?.filter((r: BulkResult) => r.success).length ?? 0;
      const failed = (data.results?.length ?? 0) - succeeded;
      setMsg(`${succeeded} campaigns ${type === 'delete' ? 'deleted' : type === 'pause' ? 'paused' : 'resumed'}${failed > 0 ? ` (${failed} failed)` : ''}`);
      setChecked(new Set()); setSelectAll(false);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || `Bulk ${type} failed`);
    }
  }, [confirmAction, checkedIds, bulkActionMutation]);

  // ─── AdSet actions ───
  const openAdSets = (campaignId: string, campaignName: string, currency: string) => {
    setAdSetModal({ campaignId, campaignName, currency });
    setActiveCampaignId(campaignId);
  };

  const toggleAdsetStatus = async (adset: AdSetItem, action: 'pause' | 'resume') => {
    try {
      await toggleAdSetMutation.mutateAsync({ id: adset.id, action });
    } catch (err: any) { setError(err?.response?.data?.message || err.message); }
  };

  const saveBudget = async () => {
    if (!editBudget) return;
    try {
      await updateBudgetMutation.mutateAsync({ id: editBudget.id, dailyBudget: editBudget.budget });
      setEditBudget(null); setMsg('Budget updated');
    } catch (err: any) { setError(err?.response?.data?.message || err.message); }
  };

  // ─── Clone ───
  const cloneCampaign = async () => {
    if (!cloneModal || cloneModal.type !== 'campaign') return;
    setMsg(''); setError('');
    try {
      const data = await cloneCampaignMutation.mutateAsync({ id: cloneModal.id, name: cloneName || undefined });
      setMsg(data.message); setCloneModal(null); setCloneName('');
    } catch (err: any) { setError(err?.response?.data?.message || err.message); }
  };

  // ─── Save template ───
  const saveAsTemplate = async () => {
    if (!saveTpl || !tplName.trim()) return;
    setMsg(''); setError('');
    try {
      await saveTemplateMutation.mutateAsync({ name: tplName, notes: tplNotes || undefined, objective: saveTpl.objective, dailyBudget: saveTpl.dailyBudget || undefined });
      setMsg('Template saved'); setSaveTpl(null); setTplName(''); setTplNotes('');
    } catch (err: any) { setError(err?.response?.data?.message || err.message); }
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
    const a = document.createElement('a'); a.href = url;
    a.download = `campaigns-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // ─── Drawer ───
  const openDrawer = () => {
    setDrawerOpen(true);
    setDrawerStep(1); setDrawerMode('wizard');
    setDrawerMsg(''); setDrawerError('');
    setFormErrors({}); setTouched({});
    setForm(f => ({ ...f, name: '', objective: 'OUTCOME_TRAFFIC', dailyBudget: 300, status: 'PAUSED', adSetName: '', adName: '', creativeMessage: '', creativeLink: '', createAd: false }));
  };

  const validate = (): FormErrors => {
    const errs: FormErrors = {};
    if (!form.name.trim()) errs.name = 'Campaign name is required';
    else if (form.name.trim().length < 2) errs.name = 'Name must be at least 2 characters';
    if (!form.dailyBudget || form.dailyBudget < 10) errs.dailyBudget = 'Daily budget must be at least 10';
    if (!form.adAccountId) errs.adAccountId = 'Please select an ad account';
    if (form.createAd && !form.adName.trim()) errs.adName = 'Ad name is required';
    return errs;
  };

  const validateStep = (s: number): boolean => {
    const errs = validate();
    const stepErrs: FormErrors = {};
    if (s === 1) { if (errs.name) stepErrs.name = errs.name; if (errs.adAccountId) stepErrs.adAccountId = errs.adAccountId; }
    if (s === 2) { if (errs.dailyBudget) stepErrs.dailyBudget = errs.dailyBudget; }
    if (s === 3) { if (errs.adName) stepErrs.adName = errs.adName; }
    setFormErrors(errs);
    setTouched(prev => ({ ...prev, ...Object.keys(stepErrs).reduce((a, k) => ({ ...a, [k]: true }), {}) }));
    return Object.keys(stepErrs).length === 0;
  };

  const createCampaign = async () => {
    const allErrs = validate();
    setFormErrors(allErrs);
    setTouched({ name: true, dailyBudget: true, adAccountId: true, adName: true });
    if (Object.keys(allErrs).length > 0) return;
    setDrawerError(''); setDrawerMsg('');
    try {
      const dto: any = { adAccountId: form.adAccountId, name: form.name, objective: form.objective, dailyBudget: form.dailyBudget, status: form.status };
      if (form.adSetName) { dto.adSetName = form.adSetName; dto.optimizationGoal = form.optimizationGoal; dto.billingEvent = form.billingEvent; dto.targeting = form.targeting; }
      if (form.createAd && form.adName) { dto.adName = form.adName; dto.creativeMessage = form.creativeMessage || 'Check this out!'; dto.creativeLink = form.creativeLink || 'https://example.com'; }
      await createCampaignMutation.mutateAsync(dto);
      setDrawerMsg('Campaign created!');
      setTimeout(() => { setDrawerOpen(false); }, 1200);
    } catch (err: any) {
      setDrawerError(err?.response?.data?.message || err.message);
    }
  };

  const budgetPreview = useMemo(() => estimateBudgetBreakdown(form.dailyBudget), [form.dailyBudget]);

  // ─── Render helpers ───
  const renderDrawerNameField = () => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-ink mb-1">Campaign Name <span className="text-danger">*</span></label>
      <input value={form.name} onChange={e => { setForm({ ...form, name: e.target.value }); setTouched({ ...touched, name: true }); }}
        className={`w-full px-3 py-2 text-sm rounded-lg border bg-surface-100 text-ink placeholder-ink-200 transition-colors ${formErrors.name && touched.name ? 'border-danger' : 'border-surface-300'}`}
        placeholder="e.g. Summer Sale 2026" />
      {formErrors.name && touched.name && <p className="text-danger text-xs mt-1">{formErrors.name}</p>}
    </div>
  );

  const renderDrawerAccountField = () => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-ink mb-1">Ad Account</label>
      <select value={form.adAccountId} onChange={e => setForm({ ...form, adAccountId: e.target.value })}
        className={`w-full px-3 py-2 text-sm rounded-lg border bg-surface-100 text-ink transition-colors ${formErrors.adAccountId && touched.adAccountId ? 'border-danger' : 'border-surface-300'}`}>
        <option value="">Select an account...</option>
        {adAccounts.map((a: any) => <option key={a.id} value={a.id}>{a.name} ({a.accountId})</option>)}
      </select>
      {formErrors.adAccountId && touched.adAccountId && <p className="text-danger text-xs mt-1">{formErrors.adAccountId}</p>}
    </div>
  );

  const renderDrawerBudgetField = () => (
    <div>
      <label className="block text-sm font-medium text-ink mb-1">Daily Budget <span className="text-danger">*</span></label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-200 text-sm">฿</span>
        <input type="number" value={form.dailyBudget}
          onChange={e => { setForm({ ...form, dailyBudget: parseInt(e.target.value) || 0 }); setTouched({ ...touched, dailyBudget: true }); }}
          className={`w-full pl-7 pr-3 py-2 text-sm rounded-lg border bg-surface-100 text-ink transition-colors ${formErrors.dailyBudget && touched.dailyBudget ? 'border-danger' : 'border-surface-300'}`}
          min={10} placeholder="300" />
      </div>
      {formErrors.dailyBudget && touched.dailyBudget && <p className="text-danger text-xs mt-1">{formErrors.dailyBudget}</p>}
    </div>
  );

  const confirmLabel = confirmAction?.type === 'pause' ? 'Pause' : confirmAction?.type === 'resume' ? 'Resume' : 'Delete';
  const confirmVariant = (confirmAction?.type === 'delete' ? 'danger' : confirmAction?.type === 'pause' ? 'warning' : 'primary') as 'danger' | 'warning' | 'primary';

  // ─── Query-derived error ───
  const displayError = error || (queryError ? 'Failed to load campaigns' : '');

  if (isLoading) {
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
        <PageHeader
          title={<><ClipboardList className="w-4 h-4 inline mr-1" />Campaigns</>}
          subtitle={`${allCampaigns.length} campaigns across ${accounts.length} ad accounts`}
          actions={
            <div className="flex gap-2">
              <button onClick={() => refetch()} disabled={isLoading} className="btn-secondary btn-sm disabled:opacity-50 inline-flex items-center gap-1"><RefreshCw className="w-4 h-4" /> Refresh</button>
              <button onClick={openDrawer} className="btn-primary btn-sm inline-flex items-center gap-1"><Sparkles className="w-4 h-4" /> New Campaign</button>
            </div>
          }
        />

        {msg && <div className="msg-success mb-4">{msg}<button className="float-right font-bold" onClick={() => setMsg('')}><X className="w-4 h-4" /></button></div>}
        {displayError && <div className="msg-error mb-4">{displayError}<button className="float-right font-bold" onClick={() => { setError(''); }}><X className="w-4 h-4" /></button></div>}

        {hasChecked && (
          <div className="card px-5 py-3 mb-4 flex items-center justify-between">
            <span className="text-sm text-ink-200"><strong className="text-ink">{checkedIds.length}</strong> selected</span>
            <div className="flex gap-2">
              <button onClick={() => setConfirmAction({ type: 'pause', ids: checkedIds })} disabled={bulkActionMutation.isPending} className="btn bg-warning-muted text-warning border border-warning-border hover:bg-warning/20 text-sm font-medium disabled:opacity-50 px-4 py-1.5 rounded-lg inline-flex items-center gap-1"><Pause className="w-4 h-4" /> Pause</button>
              <button onClick={() => setConfirmAction({ type: 'resume', ids: checkedIds })} disabled={bulkActionMutation.isPending} className="btn bg-success-muted text-success border border-success-border hover:bg-success/20 text-sm font-medium disabled:opacity-50 px-4 py-1.5 rounded-lg inline-flex items-center gap-1"><Play className="w-4 h-4" /> Resume</button>
              <button onClick={() => setConfirmAction({ type: 'delete', ids: checkedIds })} disabled={bulkActionMutation.isPending} className="btn bg-danger-muted text-danger border border-danger-border hover:bg-danger/20 text-sm font-medium disabled:opacity-50 px-4 py-1.5 rounded-lg inline-flex items-center gap-1"><Trash2 className="w-4 h-4" /> Delete</button>
              <button onClick={exportCsv} className="btn bg-accent-muted text-accent border border-accent-border hover:bg-accent/20 text-sm font-medium px-4 py-1.5 rounded-lg inline-flex items-center gap-1"><Download className="w-4 h-4" /> CSV</button>
            </div>
          </div>
        )}

        {allCampaigns.length === 0 ? (
          <div className="card p-12 text-center">
            <ClipboardList className="w-8 h-8 mx-auto mb-3 text-ink-200" />
            <p className="text-lg font-medium mb-1 text-ink">No campaigns found</p>
            <p className="text-sm text-ink-300">Sync your ad accounts from the Dashboard or create a new campaign.</p>
            <button onClick={openDrawer} className="btn-primary mt-4"><Sparkles className="w-3.5 h-3.5 mr-1" />New Campaign</button>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-200/50 border-b border-surface-300">
                    <th className="px-3 py-3 text-left w-10">
                      <input type="checkbox" checked={allCampaigns.length > 0 && checked.size === allCampaigns.length} onChange={toggleSelectAll} className="rounded border-ink-200 bg-surface-200" />
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
                    acct.campaigns.map((camp) => {
                      const isChecked = checked.has(camp.id);
                      return (
                        <tr key={camp.id} className={`hover:bg-surface-200/30 transition-colors border-b border-surface-300 ${isChecked ? 'bg-accent-muted/30' : ''}`}>
                          <td className="px-3 py-3"><input type="checkbox" checked={isChecked} onChange={() => toggleCheck(camp.id)} className="rounded border-ink-200 bg-surface-200" /></td>
                          <td className="px-3 py-3"><span className="font-medium text-ink">{camp.name}</span></td>
                          <td className="px-3 py-3 text-ink-200 text-xs">{acct.name}</td>
                          <td className="px-3 py-3 text-xs text-ink-200">{objLabel(camp.objective)}</td>
                          <td className="px-3 py-3"><span className={STATUS_COLORS[camp.status] || 'badge-ink'}>{camp.status}</span></td>
                          <td className="px-3 py-3 text-right text-sm font-medium text-ink">{camp.dailyBudget ? fmtCurr(camp.dailyBudget, acct.currency) : '-'}</td>
                          <td className="px-3 py-3 text-right text-sm text-ink">{camp.spent ? fmtCurr(camp.spent, acct.currency) : '-'}</td>
                          <td className="px-3 py-3 text-center">
                            <div className="flex items-center justify-center gap-1 flex-wrap">
                              <button onClick={() => openAdSets(camp.id, camp.name, acct.currency)} className="text-xs px-2 py-1 rounded font-medium bg-accent-muted text-accent hover:bg-accent/20"><Package className="w-3 h-3 mr-0.5 inline" />Ad Sets</button>
                              <button onClick={() => { setCloneModal({ id: camp.id, name: camp.name, type: 'campaign' }); setCloneName(`Copy of ${camp.name}`); }} className="text-xs px-2 py-1 rounded font-medium bg-accent-muted text-accent hover:bg-accent/20"><Shuffle className="w-3 h-3 mr-0.5 inline" />Clone</button>
                              <button onClick={() => { setChecked(new Set([camp.id])); setConfirmAction({ type: camp.status === 'ACTIVE' ? 'pause' : 'resume', ids: [camp.id] }); }} className="text-xs px-2 py-1 rounded font-medium bg-accent-muted text-accent hover:bg-accent/20">{camp.status === 'ACTIVE' ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}</button>
                              <button onClick={() => { setSaveTpl({ id: camp.id, name: camp.name, objective: camp.objective, dailyBudget: Number(camp.dailyBudget || 0) }); setTplName(`${camp.name} Template`); setTplNotes(''); }} className="text-xs px-2 py-1 rounded font-medium bg-success-muted text-success hover:bg-success/20"><Save className="w-3 h-3" /></button>
                              <button onClick={() => { setChecked(new Set([camp.id])); setConfirmAction({ type: 'delete', ids: [camp.id] }); }} className="text-xs px-2 py-1 rounded font-medium bg-danger-muted text-danger hover:bg-danger/20"><Trash2 className="w-3 h-3" /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 bg-surface-200/50 text-xs text-ink-300 flex items-center justify-between border-t border-surface-300">
              <span>Showing {allCampaigns.length} campaign{allCampaigns.length !== 1 ? 's' : ''} from {accounts.length} account{accounts.length !== 1 ? 's' : ''}</span>
              <button onClick={exportCsv} className="text-accent hover:text-accent/80 font-medium"><Download className="w-3.5 h-3.5 mr-1 inline" />Export CSV</button>
            </div>
          </div>
        )}
      </div>

      {/* ─── New Campaign Drawer ─── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="relative w-[480px] h-full bg-surface-50 border-l border-surface-300 flex flex-col shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-300 shrink-0">
              <h2 className="text-lg font-semibold text-ink flex items-center gap-2" style={{ letterSpacing: '-0.02em' }}><Sparkles className="w-4 h-4" />New Campaign</h2>
              <button onClick={() => setDrawerOpen(false)} className="text-ink-200 hover:text-ink transition-colors text-xl leading-none">✕</button>
            </div>
            <div className="flex-1 px-6 py-4">
              {drawerError && <div className="msg-error mb-4">{drawerError}</div>}
              {drawerMsg && <div className="msg-success mb-4">{drawerMsg}</div>}

              <div className="flex items-center gap-1 bg-surface-200 p-1 rounded-lg mb-6 w-fit">
                <button onClick={() => setDrawerMode('wizard')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${drawerMode === 'wizard' ? 'bg-surface-100 text-accent' : 'text-ink-200 hover:text-ink'}`}><ClipboardList className="w-3.5 h-3.5 mr-0.5 inline" />Wizard</button>
                <button onClick={() => setDrawerMode('quick')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${drawerMode === 'quick' ? 'bg-surface-100 text-accent' : 'text-ink-200 hover:text-ink'}`}><Sparkles className="w-3.5 h-3.5 mr-0.5 inline" />Quick</button>
              </div>

              {drawerMode === 'quick' && (
                <div>
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {OBJECTIVES.map(obj => (
                      <button key={obj.key} onClick={() => setForm({ ...form, objective: obj.key })} className={`text-left p-3 rounded-xl border-2 transition-all ${form.objective === obj.key ? 'border-accent bg-accent-muted' : 'border-surface-300 hover:border-surface-400'}`}>
                        <p className="font-semibold text-ink text-sm">{obj.label}</p>
                        <p className="text-xs text-ink-200 mt-0.5">{obj.desc}</p>
                      </button>
                    ))}
                  </div>
                  {renderDrawerAccountField()}
                  {renderDrawerNameField()}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {renderDrawerBudgetField()}
                    <div>
                      <label className="block text-sm font-medium text-ink mb-1">Status</label>
                      <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-surface-300 bg-surface-100 text-ink">
                        <option value="PAUSED">Paused</option>
                        <option value="ACTIVE">Active</option>
                      </select>
                    </div>
                  </div>
                  <div className="card p-4 mb-4">
                    <h3 className="text-xs font-semibold text-accent uppercase tracking-wide mb-2 flex items-center gap-1"><BarChart3 className="w-3 h-3" />Budget Preview</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><p className="text-ink-200 text-xs">Daily Spend</p><p className="font-bold text-ink">฿{budgetPreview.dailySpend.toLocaleString()}</p></div>
                      <div><p className="text-ink-200 text-xs">Est. Daily Reach</p><p className="font-bold text-ink">{budgetPreview.estimatedDailyReach.toLocaleString()}</p></div>
                      <div><p className="text-ink-200 text-xs">Est. CPC</p><p className="font-bold text-ink">฿{budgetPreview.estimatedCpc}</p></div>
                      <div><p className="text-ink-200 text-xs">Est. CPM</p><p className="font-bold text-ink">฿{budgetPreview.estimatedCpm}</p></div>
                    </div>
                  </div>
                  <TargetingBuilder value={form.targeting || {}} onChange={(v: Record<string, any>) => setForm({ ...form, targeting: v })} adAccountId={form.adAccountId} />
                  <button onClick={createCampaign} disabled={createCampaignMutation.isPending} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
                    {createCampaignMutation.isPending ? <><Spinner /> Creating...</> : <><Rocket className="w-3.5 h-3.5 mr-1" />Launch Campaign</>}
                  </button>
                </div>
              )}

              {drawerMode === 'wizard' && (
                <div>
                  <div className="flex items-center justify-between mb-6 px-1">
                    {[{ step: 1, label: 'Objective', icon: Target }, { step: 2, label: 'Budget', icon: DollarSign }, { step: 3, label: 'Creative', icon: Palette }].map((item, i) => {
                      const isActive = drawerStep === item.step;
                      const isComplete = drawerStep > item.step;
                      const Icon = item.icon;
                      return (
                        <div key={item.step} className="flex items-center flex-1">
                          <div className="flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${isComplete ? 'bg-success text-white' : isActive ? 'bg-accent text-white ring-4 ring-accent-muted' : 'bg-surface-200 text-ink-200'}`}>
                              {isComplete ? (<span>✓</span>) : (<Icon className="w-4 h-4" />)}
                            </div>
                            <span className={`text-xs mt-1 font-medium ${isActive ? 'text-accent' : isComplete ? 'text-success' : 'text-ink-200'}`}>{item.label}</span>
                          </div>
                          {i < 2 && <div className={`flex-1 h-0.5 mx-2 mt-[-1rem] ${isComplete ? 'bg-success' : 'bg-surface-300'}`} />}
                        </div>
                      );
                    })}
                  </div>

                  {drawerStep === 1 && (
                    <div>
                      <h3 className="text-sm font-semibold text-ink mb-3">Choose Objective</h3>
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        {OBJECTIVES.map(obj => (
                          <button key={obj.key} onClick={() => setForm({ ...form, objective: obj.key })} className={`text-left p-3 rounded-xl border-2 transition-all ${form.objective === obj.key ? 'border-accent bg-accent-muted' : 'border-surface-300 hover:border-surface-400'}`}>
                            <p className="font-semibold text-ink text-sm">{obj.label}</p>
                            <p className="text-xs text-ink-200 mt-0.5">{obj.desc}</p>
                          </button>
                        ))}
                      </div>
                      {renderDrawerAccountField()}
                      {renderDrawerNameField()}
                      <button onClick={() => validateStep(1) && setDrawerStep(2)} className="btn-primary w-full">Next: Budget →</button>
                    </div>
                  )}

                  {drawerStep === 2 && (
                    <div>
                      <h3 className="text-sm font-semibold text-ink mb-3">Budget & Status</h3>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        {renderDrawerBudgetField()}
                        <div>
                          <label className="block text-sm font-medium text-ink mb-1">Status</label>
                          <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-surface-300 bg-surface-100 text-ink">
                            <option value="PAUSED">Paused</option>
                            <option value="ACTIVE">Active</option>
                          </select>
                        </div>
                      </div>
                      <div className="card p-4 mb-4">
                        <h3 className="text-xs font-semibold text-accent uppercase tracking-wide mb-2 flex items-center gap-1"><BarChart3 className="w-3 h-3" />Budget Preview</h3>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div><p className="text-ink-200 text-xs">Daily Spend</p><p className="font-bold text-ink">฿{budgetPreview.dailySpend.toLocaleString()}</p></div>
                          <div><p className="text-ink-200 text-xs">Est. Reach</p><p className="font-bold text-ink">{budgetPreview.estimatedDailyReach.toLocaleString()}</p></div>
                          <div><p className="text-ink-200 text-xs">Est. CPC</p><p className="font-bold text-ink">฿{budgetPreview.estimatedCpc}</p></div>
                          <div><p className="text-ink-200 text-xs">Est. CPM</p><p className="font-bold text-ink">฿{budgetPreview.estimatedCpm}</p></div>
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-sm font-medium text-ink mb-3">
                        <input type="checkbox" checked={!!form.adSetName}
                          onChange={e => setForm({ ...form, adSetName: e.target.checked ? 'Ad Set 1' : '', optimizationGoal: e.target.checked ? (form.optimizationGoal || 'REACH') : '' })} />
                        Create Ad Set with targeting
                      </label>
                      {form.adSetName && (
                        <div className="mb-4">
                          <TargetingBuilder value={form.targeting || {}} onChange={(v: Record<string, any>) => setForm({ ...form, targeting: v })} adAccountId={form.adAccountId} />
                        </div>
                      )}
                      <div className="flex gap-3">
                        <button onClick={() => setDrawerStep(1)} className="btn-secondary flex-1">← Back</button>
                        <button onClick={() => validateStep(2) && setDrawerStep(3)} className="btn-primary flex-1">Next: Creative →</button>
                      </div>
                    </div>
                  )}

                  {drawerStep === 3 && (
                    <div>
                      <h3 className="text-sm font-semibold text-ink mb-3">Ad Creative (optional)</h3>
                      <label className="flex items-center gap-2 text-sm font-medium text-ink mb-4">
                        <input type="checkbox" checked={form.createAd} onChange={e => setForm({ ...form, createAd: e.target.checked })} />
                        Create an Ad now
                      </label>
                      {form.createAd && (
                        <div className="space-y-3 mb-4">
                          <div>
                            <label className="block text-sm font-medium text-ink mb-1">Ad Name</label>
                            <input value={form.adName} onChange={e => { setForm({ ...form, adName: e.target.value }); setTouched({ ...touched, adName: true }); }}
                              className={`w-full px-3 py-2 text-sm rounded-lg border bg-surface-100 text-ink placeholder-ink-200 ${formErrors.adName && touched.adName ? 'border-danger' : 'border-surface-300'}`}
                              placeholder="e.g. Summer Sale Ad 1" />
                            {formErrors.adName && touched.adName && <p className="text-danger text-xs mt-1">{formErrors.adName}</p>}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-ink mb-1">Message</label>
                            <textarea value={form.creativeMessage} onChange={e => setForm({ ...form, creativeMessage: e.target.value })} rows={2}
                              className="w-full px-3 py-2 text-sm rounded-lg border border-surface-300 bg-surface-100 text-ink placeholder-ink-200" placeholder="Your ad text..." />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-ink mb-1">Destination URL</label>
                            <input value={form.creativeLink} onChange={e => setForm({ ...form, creativeLink: e.target.value })}
                              className="w-full px-3 py-2 text-sm rounded-lg border border-surface-300 bg-surface-100 text-ink placeholder-ink-200" placeholder="https://..." />
                          </div>
                        </div>
                      )}
                      <div className="flex gap-3">
                        <button onClick={() => setDrawerStep(2)} className="btn-secondary flex-1">← Back</button>
                        <button onClick={createCampaign} disabled={createCampaignMutation.isPending} className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
                          {createCampaignMutation.isPending ? <><Spinner /> Creating...</> : <><Rocket className="w-3.5 h-3.5 mr-1" />Launch</>}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => executeBulkAction(confirmAction!.type)}
        title={<>{confirmAction?.type === 'pause' ? <Pause className="w-4 h-4 inline mr-1" /> : confirmAction?.type === 'resume' ? <Play className="w-4 h-4 inline mr-1" /> : <Trash2 className="w-4 h-4 inline mr-1" />}{confirmLabel} Campaigns</>}
        message={confirmAction?.type === 'delete'
          ? `Delete ${confirmAction.ids.length} campaign${confirmAction.ids.length > 1 ? 's' : ''}?`
          : `${confirmAction?.type === 'pause' ? 'Pause' : 'Resume'} ${confirmAction?.ids.length} campaign${(confirmAction?.ids.length ?? 0) > 1 ? 's' : ''}?`}
        confirmLabel={confirmLabel}
        confirmVariant={confirmVariant}
        busy={bulkActionMutation.isPending}
        icon={confirmAction?.type === 'pause' ? <Pause className="w-4 h-4" /> : confirmAction?.type === 'resume' ? <Play className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
        danger={confirmAction?.type === 'delete'}
      />

      <Modal open={!!adSetModal} onClose={() => { setAdSetModal(null); setEditBudget(null); }} title="Ad Sets" icon={<Package className="w-4 h-4" />} maxWidth="max-w-3xl">
        <p className="text-sm text-ink-200 mb-3">{adSetModal?.campaignName}</p>
        <div className="space-y-3 max-h-[50vh] overflow-y-auto">
          {adSetLoading ? <p className="text-center text-ink-300 py-8 animate-pulse">Loading...</p> : adSets.length === 0 ? (
            <div className="text-center py-8 text-ink-300"><Package className="w-6 h-6 mx-auto mb-2 text-ink-300" /><p>No ad sets found</p></div>
          ) : adSets.map(as => (
            <div key={as.id} className="bg-surface-200 rounded-lg p-3 border border-surface-border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-ink">{as.name}</span>
                  <span className={AS_STATUS_COLORS[as.status] || 'badge-ink'}>{as.status}</span>
                </div>
                <div className="flex gap-1">
                  {as.status === 'ACTIVE'
                    ? <button onClick={() => toggleAdsetStatus(as, 'pause')} disabled={toggleAdSetMutation.isPending} className="text-xs px-2 py-1 rounded bg-warning-muted text-warning hover:bg-warning/20 disabled:opacity-50">{toggleAdSetMutation.isPending ? '...' : <><Pause className="w-3 h-3 mr-0.5 inline" />Pause</>}</button>
                    : <button onClick={() => toggleAdsetStatus(as, 'resume')} disabled={toggleAdSetMutation.isPending} className="text-xs px-2 py-1 rounded bg-success-muted text-success hover:bg-success/20 disabled:opacity-50">{toggleAdSetMutation.isPending ? '...' : <><Play className="w-3 h-3 mr-0.5 inline" />Resume</>}</button>}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs mb-2">
                <div><span className="text-ink-300">Budget</span><p className="font-mono text-ink">{as.dailyBudget > 0 ? fmtCurr(as.dailyBudget, adSetModal!.currency) : '-'}</p></div>
                <div><span className="text-ink-300">Spend</span><p className="font-mono text-ink">{fmtCurr(as.spend, adSetModal!.currency)}</p></div>
                <div><span className="text-ink-300">CTR</span><p className="font-mono text-ink">{fmtPct(as.ctr)}</p></div>
                <div><span className="text-ink-300">Conv.</span><p className="font-mono text-ink">{as.conversions}</p></div>
              </div>
              <div className="mt-2">
                {editBudget?.id === as.id ? (
                  <div className="flex items-center gap-2">
                    <input type="number" value={editBudget.budget} min={1} onChange={e => setEditBudget({ ...editBudget, budget: Number(e.target.value) || 0 })} className="w-32 bg-surface-100 border border-ink-200 rounded px-2 py-1 text-xs text-ink" />
                    <button onClick={saveBudget} disabled={updateBudgetMutation.isPending} className="btn-primary btn-xs disabled:opacity-50">{updateBudgetMutation.isPending ? '...' : 'Save'}</button>
                    <button onClick={() => setEditBudget(null)} className="btn-secondary btn-xs">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setEditBudget({ id: as.id, name: as.name, budget: as.dailyBudget })} className="text-xs px-2 py-1 rounded bg-accent-muted text-accent hover:bg-accent/20"><Pencil className="w-3 h-3 mr-0.5 inline" />Edit Budget</button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="text-center text-xs text-ink-300 mt-3 pt-3 border-t border-surface-300">{adSets.length} ad set{adSets.length !== 1 ? 's' : ''}</div>
      </Modal>

      <Modal open={!!saveTpl} onClose={() => setSaveTpl(null)} title="Save as Template" icon={<Save className="w-4 h-4" />}>
        <p className="text-sm text-ink-200 mb-3">{saveTpl?.name}</p>
        <div className="space-y-3">
          <div><label className="block text-xs text-ink-300 mb-1">Template Name *</label><input type="text" value={tplName} onChange={e => setTplName(e.target.value)} className="w-full bg-surface-200 border border-ink-200 rounded-lg px-3 py-2 text-sm text-ink" /></div>
          <div><label className="block text-xs text-ink-300 mb-1">Notes (optional)</label><textarea value={tplNotes} onChange={e => setTplNotes(e.target.value)} rows={3} className="w-full bg-surface-200 border border-ink-200 rounded-lg px-3 py-2 text-sm text-ink placeholder-ink-300" /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-surface-300">
          <button onClick={() => setSaveTpl(null)} className="btn-secondary btn-sm">Cancel</button>
          <button onClick={saveAsTemplate} disabled={saveTemplateMutation.isPending || !tplName.trim()} className="btn-success btn-sm disabled:opacity-50">{saveTemplateMutation.isPending ? 'Saving...' : <><Save className="w-3 h-3 mr-0.5 inline" />Save Template</>}</button>
        </div>
      </Modal>

      <Modal open={!!(cloneModal && cloneModal.type === 'campaign')} onClose={() => setCloneModal(null)} title="Clone Campaign" icon={<Shuffle className="w-4 h-4" />}>
        <p className="text-sm text-ink-200 mb-3">{cloneModal?.name}</p>
        <div className="space-y-3">
          <div><label className="block text-xs text-ink-300 mb-1">New Campaign Name</label><input type="text" value={cloneName} onChange={e => setCloneName(e.target.value)} className="w-full bg-surface-200 border border-ink-200 rounded-lg px-3 py-2 text-sm text-ink" /></div>
          <p className="text-xs text-ink-300">The cloned campaign will start in <strong className="text-warning">PAUSED</strong> status.</p>
        </div>
        <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-surface-300">
          <button onClick={() => setCloneModal(null)} className="btn-secondary btn-sm">Cancel</button>
          <button onClick={cloneCampaign} disabled={cloneCampaignMutation.isPending || !cloneName.trim()} className="btn-primary btn-sm disabled:opacity-50">{cloneCampaignMutation.isPending ? 'Cloning...' : <><Shuffle className="w-3 h-3 mr-0.5 inline" />Clone</>}</button>
        </div>
      </Modal>
    </Shell>
  );
}

export default function CampaignsPage() {
  return (
    <Suspense fallback={<Shell><div className="flex items-center justify-center py-24"><p className="text-ink-300 animate-pulse">Loading...</p></div></Shell>}>
      <CampaignsPageInner />
    </Suspense>
  );
}
