'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';

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

const objLabel = (o: string) =>
  ({ OUTCOME_AWARENESS: 'Awareness', OUTCOME_ENGAGEMENT: 'Engagement', OUTCOME_TRAFFIC: 'Traffic', OUTCOME_LEADS: 'Leads', OUTCOME_SALES: 'Sales', OUTCOME_APP_PROMOTION: 'App Promotion' }[o] || o);

const fmtCurr = (v: number, cur = 'THB') =>
  new Intl.NumberFormat('en', { style: 'currency', currency: cur, minimumFractionDigits: 0 }).format(v);

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
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/'; return; }
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
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
      window.location.href = `/dashboard/campaigns/new?template=${t.id}`;
    } catch (err: any) { setError(err?.response?.data?.message || err.message); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b1120]">
        <p className="text-slate-400 animate-pulse">Loading templates...</p>
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
              <a href="/dashboard/all-campaigns" className="text-gray-400 hover:text-gray-200">📋 All Campaigns</a>
              <a href="/dashboard/campaigns/new" className="text-gray-400 hover:text-gray-200">🎯 New Campaign</a>
              <a href="/dashboard/rules" className="text-gray-400 hover:text-gray-200">⚡ Rules</a>
              <a href="/dashboard/schedules" className="text-gray-400 hover:text-gray-200">📅 Schedules</a>
              <a href="/dashboard/templates" className="text-blue-400 font-medium hover:text-blue-300">📦 Templates</a>
              <a href="/dashboard/analytics" className="text-gray-400 hover:text-gray-200">📊 Analytics</a>
              <a href="/dashboard/audiences" className="text-gray-400 hover:text-gray-200">🎯 Audiences</a>
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
            <h2 className="text-2xl font-bold">📦 Campaign Templates</h2>
            <p className="text-sm text-slate-500 mt-1">{templates.length} template{templates.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={openCreate}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
            ➕ New Template
          </button>
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

        {/* Grid */}
        {templates.length === 0 ? (
          <div className="bg-[#1e293b] rounded-xl border border-slate-700/50 p-12 text-center">
            <p className="text-4xl mb-3">📦</p>
            <p className="text-lg font-medium mb-1 text-slate-300">No templates yet</p>
            <p className="text-sm text-slate-500">Save your campaign settings as templates and reuse them instantly.</p>
            <button onClick={openCreate}
              className="mt-4 bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
              ➕ Create First Template
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((t) => (
              <div key={t.id} className="bg-[#1e293b] rounded-xl border border-slate-700/50 p-5 hover:border-blue-500/30 transition-all group">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base truncate">{t.name}</h3>
                    {t.notes && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{t.notes}</p>}
                  </div>
                </div>

                {/* Meta */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="text-[10px] px-2 py-0.5 bg-blue-900/40 text-blue-400 rounded-full font-medium">
                    {objLabel(t.objective)}
                  </span>
                  {t.dailyBudget && (
                    <span className="text-[10px] px-2 py-0.5 bg-green-900/40 text-green-400 rounded-full font-medium">
                      {fmtCurr(Number(t.dailyBudget))}/day
                    </span>
                  )}
                  {t.optimizationGoal && (
                    <span className="text-[10px] px-2 py-0.5 bg-purple-900/40 text-purple-400 rounded-full">
                      🎯 {t.optimizationGoal}
                    </span>
                  )}
                  {t.adSetName && (
                    <span className="text-[10px] px-2 py-0.5 bg-indigo-900/40 text-indigo-400 rounded-full">
                      📦 {t.adSetName}
                    </span>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-3 text-xs text-slate-500 mb-4">
                  <span>🔄 Used {t.useCount}x</span>
                  {t.lastUsedAt && (
                    <span>Last: {new Date(t.lastUsedAt).toLocaleDateString('th')}</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => applyTemplate(t)}
                    className="flex-1 text-xs px-3 py-1.5 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700">
                    🔄 Apply
                  </button>
                  <button onClick={() => openEdit(t)}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium bg-indigo-900/40 text-indigo-400 hover:bg-indigo-800/50">
                    ✏️ Edit
                  </button>
                  <button onClick={() => setDeleteTpl(t)}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium bg-red-900/40 text-red-400 hover:bg-red-800/50">
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ─── Create/Edit Modal ─── */}
      {editModal !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setEditModal(null)}>
          <div className="bg-[#1e293b] rounded-xl shadow-xl w-full max-w-lg mx-4 border border-slate-700/50 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-700/50 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{editModal?.template ? '✏️ Edit Template' : '➕ New Template'}</h3>
              <button onClick={() => setEditModal(null)} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>
            <div className="p-5 space-y-4">
              {/* Name */}
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block">Template Name *</label>
                <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., Standard Traffic Campaign"
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500" />
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block">Notes (optional)</label>
                <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Describe when to use this template..."
                  rows={3}
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500" />
              </div>

              {/* Objective */}
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block">Objective</label>
                <select value={editForm.objective} onChange={e => setEditForm(f => ({ ...f, objective: e.target.value }))}
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500">
                  {OBJECTIVES.map(o => <option key={o} value={o}>{objLabel(o)}</option>)}
                </select>
              </div>

              {/* Budget */}
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block">Daily Budget (THB)</label>
                <input type="number" value={editForm.dailyBudget} onChange={e => setEditForm(f => ({ ...f, dailyBudget: Number(e.target.value) }))}
                  min={0}
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
              </div>

              {/* Ad Set */}
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block">Ad Set Name (optional)</label>
                <input value={editForm.adSetName} onChange={e => setEditForm(f => ({ ...f, adSetName: e.target.value }))}
                  placeholder="e.g., TH Traffic Ad Set"
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500" />
              </div>

              {/* Optimization Goal + Billing Event */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1 block">Optimization Goal</label>
                  <select value={editForm.optimizationGoal} onChange={e => setEditForm(f => ({ ...f, optimizationGoal: e.target.value }))}
                    className="w-full bg-[#0b1120] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500">
                    {OPT_GOALS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1 block">Billing Event</label>
                  <select value={editForm.billingEvent} onChange={e => setEditForm(f => ({ ...f, billingEvent: e.target.value }))}
                    className="w-full bg-[#0b1120] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500">
                    <option value="IMPRESSIONS">Impressions</option>
                    <option value="LINK_CLICKS">Link Clicks</option>
                  </select>
                </div>
              </div>

              {/* Ad Name */}
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block">Ad Name (optional)</label>
                <input value={editForm.adName} onChange={e => setEditForm(f => ({ ...f, adName: e.target.value }))}
                  placeholder="e.g., TH Traffic Ad"
                  className="w-full bg-[#0b1120] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500" />
              </div>
            </div>

            <div className="p-5 border-t border-slate-700/50 flex justify-end gap-2">
              <button onClick={() => setEditModal(null)}
                className="px-4 py-2 border border-slate-600 rounded-lg text-sm hover:bg-slate-700 text-slate-300">Cancel</button>
              <button onClick={saveTemplate} disabled={editSaving}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {editSaving ? 'Saving...' : editModal?.template ? '💾 Update' : '➕ Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Modal ─── */}
      {deleteTpl && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setDeleteTpl(null)}>
          <div className="bg-[#1e293b] rounded-xl shadow-xl p-6 w-full max-w-sm mx-4 border border-slate-700/50" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">🗑 Delete Template</h3>
            <p className="text-sm text-slate-400 mb-4">Delete &quot;{deleteTpl.name}&quot;? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTpl(null)} className="px-4 py-2 border border-slate-600 rounded-lg text-sm hover:bg-slate-700 text-slate-300">Cancel</button>
              <button onClick={deleteTemplate} disabled={deleteBusy}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {deleteBusy ? 'Deleting...' : '🗑 Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
