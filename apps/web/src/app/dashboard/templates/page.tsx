'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { Package, Plus, Target, RefreshCw, Pencil, Trash2, Save, X } from 'lucide-react';
import Shell from '@/components/Shell';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/Modal';
import { ConfirmModal } from '@/components/Modal';
import { objLabel, fmtCurr } from '@/lib/utils';

// ─── Types ───

interface Template {
  id: string;
  name: string;
  notes: string | null;
  objective: string;
  dailyBudget: number | null;
  targetSpec: any;
  adSetName: string | null;
  optimizationGoal: string | null;
  billingEvent: string | null;
  adName: string | null;
  creativeConfig: any;
  useCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const OBJECTIVES = [
  'OUTCOME_AWARENESS', 'OUTCOME_TRAFFIC', 'OUTCOME_ENGAGEMENT',
  'OUTCOME_LEADS', 'OUTCOME_SALES', 'OUTCOME_APP_PROMOTION',
];

const OPT_GOALS = ['REACH', 'IMPRESSIONS', 'LINK_CLICKS', 'LANDING_PAGE_VIEWS', 'VALUE', 'CONVERSIONS'];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  // Edit / Create modal
  const [editModal, setEditModal] = useState<{ template?: Template } | null>(null);
  const [editForm, setEditForm] = useState({
    name: '', notes: '', objective: 'OUTCOME_TRAFFIC', dailyBudget: 0,
    adSetName: '', optimizationGoal: 'REACH', billingEvent: 'IMPRESSIONS', adName: '',
  });
  const [editSaving, setEditSaving] = useState(false);

  // Delete
  const [deleteTpl, setDeleteTpl] = useState<Template | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    axios.defaults.withCredentials = true;
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true); setError('');
    try {
      const { data } = await axios.get('/api/templates');
      setTemplates(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load templates');
    } finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditForm({ name: '', notes: '', objective: 'OUTCOME_TRAFFIC', dailyBudget: 0, adSetName: '', optimizationGoal: 'REACH', billingEvent: 'IMPRESSIONS', adName: '' });
    setEditModal({});
  };

  const openEdit = (t: Template) => {
    setEditForm({
      name: t.name, notes: t.notes || '', objective: t.objective, dailyBudget: Number(t.dailyBudget || 0),
      adSetName: t.adSetName || '', optimizationGoal: t.optimizationGoal || 'REACH',
      billingEvent: t.billingEvent || 'IMPRESSIONS', adName: t.adName || '',
    });
    setEditModal({ template: t });
  };

  const saveTemplate = async () => {
    if (!editForm.name.trim()) { setError('Name is required'); return; }
    setEditSaving(true); setError(''); setMsg('');
    try {
      const body = {
        ...editForm,
        dailyBudget: editForm.dailyBudget > 0 ? editForm.dailyBudget : null,
        notes: editForm.notes || null,
      };
      if (editModal?.template) {
        await axios.patch(`/api/templates/${editModal.template.id}`, body);
        setMsg('✅ Template updated');
      } else {
        await axios.post('/api/templates', body);
        setMsg('✅ Template created');
      }
      setEditModal(null);
      fetchAll();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message);
    } finally { setEditSaving(false); }
  };

  const deleteTemplate = async () => {
    if (!deleteTpl) return;
    setDeleteBusy(true); setError(''); setMsg('');
    try {
      await axios.delete(`/api/templates/${deleteTpl.id}`);
      setMsg('✅ Template deleted');
      setDeleteTpl(null);
      fetchAll();
    } catch (err: any) { setError(err?.response?.data?.message || err.message); }
    finally { setDeleteBusy(false); }
  };

  const applyTemplate = async (t: Template) => {
    setMsg(''); setError('');
    try {
      await axios.post(`/api/templates/${t.id}/apply`);
      // Navigate to new campaign page with pre-filled params
      window.location.href = `/dashboard/campaigns?new=1&template=${t.id}`;
    } catch (err: any) { setError(err?.response?.data?.message || err.message); }
  };

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center min-h-[50vh]">
          <p className="text-ink-300 animate-pulse">Loading templates...</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="p-6">
        <PageHeader
          title="📦 Campaign Templates"
          subtitle={`${templates.length} template${templates.length !== 1 ? 's' : ''}`}
          actions={
            <button onClick={openCreate} className="btn-primary btn-sm inline-flex items-center gap-1"><Plus className="w-4 h-4" /> New Template</button>
          }
        />

        {/* Messages */}
        {msg && (
          <div className="msg-success mb-4">
            {msg}
            <button className="float-right" onClick={() => setMsg('')}><X className="w-4 h-4" /></button>
          </div>
        )}
        {error && (
          <div className="msg-error mb-4">
            {error}
            <button className="float-right" onClick={() => setError('')}><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Grid */}
        {templates.length === 0 ? (
          <div className="card p-12 text-center">
            <Package className="w-12 h-12 mx-auto mb-3 text-ink-200" />
            <p className="text-lg font-medium mb-1 text-ink">No templates yet</p>
            <p className="text-sm text-ink-300">Save your campaign settings as templates and reuse them instantly.</p>
            <button onClick={openCreate}
              className="mt-4 btn-primary inline-flex items-center gap-1"><Plus className="w-4 h-4" /> Create First Template</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((t) => (
              <div key={t.id} className="card p-5 hover:border-accent-border/30 transition-all group">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base text-ink truncate">{t.name}</h3>
                    {t.notes && <p className="text-xs text-ink-300 mt-1 line-clamp-2">{t.notes}</p>}
                  </div>
                </div>

                {/* Meta */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="badge-success text-[10px]">
                    {objLabel(t.objective)}
                  </span>
                  {t.dailyBudget && (
                    <span className="text-[10px] px-2 py-0.5 bg-success-muted text-success rounded-full font-medium border border-success-border">
                      {fmtCurr(Number(t.dailyBudget), 'THB')}/day
                    </span>
                  )}
                  {t.optimizationGoal && (
                    <span className="text-[10px] px-2 py-0.5 bg-accent-muted text-accent rounded-full border border-accent-border inline-flex items-center gap-1">
                      <Target className="w-3 h-3" /> {t.optimizationGoal}
                    </span>
                  )}
                  {t.adSetName && (
                    <span className="text-[10px] px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full border border-purple-200 inline-flex items-center gap-1">
                      <Package className="w-3 h-3" /> {t.adSetName}
                    </span>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-3 text-xs text-ink-300 mb-4">
                  <span className="inline-flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Used {t.useCount}x</span>
                  {t.lastUsedAt && (
                    <span>Last: {new Date(t.lastUsedAt).toLocaleDateString('th')}</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => applyTemplate(t)}
                    className="flex-1 text-xs px-3 py-1.5 rounded-lg font-medium bg-accent text-white hover:bg-accent/90 inline-flex items-center justify-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Apply
                  </button>
                  <button onClick={() => openEdit(t)}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium bg-accent-muted text-accent hover:bg-accent/20 inline-flex items-center gap-1">
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                  <button onClick={() => setDeleteTpl(t)}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium bg-danger-muted text-danger hover:bg-danger/20">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Create/Edit Modal ─── */}
      <Modal open={editModal !== null} onClose={() => setEditModal(null)} title={editModal?.template ? '✏️ Edit Template' : '➕ New Template'} maxWidth="max-w-lg">
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs font-medium text-ink-300 mb-1 block">Template Name *</label>
            <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g., Standard Traffic Campaign"
              className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 text-sm text-ink placeholder-ink-400 focus:outline-none focus:border-accent" />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-ink-300 mb-1 block">Notes (optional)</label>
            <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Describe when to use this template..."
              rows={3}
              className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 text-sm text-ink placeholder-ink-400 focus:outline-none focus:border-accent" />
          </div>

          {/* Objective */}
          <div>
            <label className="text-xs font-medium text-ink-300 mb-1 block">Objective</label>
            <select value={editForm.objective} onChange={e => setEditForm(f => ({ ...f, objective: e.target.value }))}
              className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent">
              {OBJECTIVES.map(o => <option key={o} value={o}>{objLabel(o)}</option>)}
            </select>
          </div>

          {/* Budget */}
          <div>
            <label className="text-xs font-medium text-ink-300 mb-1 block">Daily Budget (THB)</label>
            <input type="number" value={editForm.dailyBudget} onChange={e => setEditForm(f => ({ ...f, dailyBudget: Number(e.target.value) }))}
              min={0}
              className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent" />
          </div>

          {/* Ad Set */}
          <div>
            <label className="text-xs font-medium text-ink-300 mb-1 block">Ad Set Name (optional)</label>
            <input value={editForm.adSetName} onChange={e => setEditForm(f => ({ ...f, adSetName: e.target.value }))}
              placeholder="e.g., TH Traffic Ad Set"
              className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 text-sm text-ink placeholder-ink-400 focus:outline-none focus:border-accent" />
          </div>

          {/* Optimization Goal + Billing Event */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-ink-300 mb-1 block">Optimization Goal</label>
              <select value={editForm.optimizationGoal} onChange={e => setEditForm(f => ({ ...f, optimizationGoal: e.target.value }))}
                className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent">
                {OPT_GOALS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-ink-300 mb-1 block">Billing Event</label>
              <select value={editForm.billingEvent} onChange={e => setEditForm(f => ({ ...f, billingEvent: e.target.value }))}
                className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent">
                <option value="IMPRESSIONS">Impressions</option>
                <option value="LINK_CLICKS">Link Clicks</option>
              </select>
            </div>
          </div>

          {/* Ad Name */}
          <div>
            <label className="text-xs font-medium text-ink-300 mb-1 block">Ad Name (optional)</label>
            <input value={editForm.adName} onChange={e => setEditForm(f => ({ ...f, adName: e.target.value }))}
              placeholder="e.g., TH Traffic Ad"
              className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 text-sm text-ink placeholder-ink-400 focus:outline-none focus:border-accent" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4 pt-4 -mx-5 px-5 border-t border-surface-300">
          <button onClick={() => setEditModal(null)} className="btn-secondary btn-sm">Cancel</button>
          <button onClick={saveTemplate} disabled={editSaving}
            className="btn-primary btn-sm">
            {editSaving ? 'Saving...' : editModal?.template ? <><Save className="w-4 h-4" /> Update</> : <><Plus className="w-4 h-4" /> Create</>}
          </button>
        </div>
      </Modal>

      {/* ─── Delete Modal ─── */}
      <ConfirmModal
        open={!!deleteTpl}
        onClose={() => setDeleteTpl(null)}
        onConfirm={deleteTemplate}
        title="Delete Template"
        message={deleteTpl ? `Delete "${deleteTpl.name}"? This cannot be undone.` : ''}
        confirmLabel="Delete"
        danger
        busy={deleteBusy}
        icon="🗑"
      />
    </Shell>
  );
}
