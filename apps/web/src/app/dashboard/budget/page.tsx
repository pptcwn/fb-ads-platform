'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';

interface BudgetSchedule {
  id: string;
  name: string;
  campaignId: string | null;
  adAccountId: string | null;
  action: string;
  value: number | null;
  cronExpr: string;
  timezone: string;
  isEnabled: boolean;
  lastRunAt: string | null;
  createdAt: string;
}

interface CampaignOption {
  id: string;
  name: string;
  accountId: string;
}

interface AccountOption {
  id: string;
  name: string;
}

const ACTION_LABELS: Record<string, string> = {
  PAUSE: '⏸ Pause',
  RESUME: '▶️ Resume',
  SET_BUDGET: '💰 Set Budget',
  ADJUST_PERCENT: '📊 Adjust %',
};

const ACTION_COLORS: Record<string, string> = {
  PAUSE: 'bg-red-100 text-red-700',
  RESUME: 'bg-green-100 text-green-700',
  SET_BUDGET: 'bg-blue-100 text-blue-700',
  ADJUST_PERCENT: 'bg-purple-100 text-purple-700',
};

const CRON_PRESETS = [
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 30 min', value: '*/30 * * * *' },
  { label: 'Every 15 min', value: '*/15 * * * *' },
  { label: 'Daily at midnight', value: '0 0 * * *' },
  { label: 'Daily at 6 AM', value: '0 6 * * *' },
  { label: 'Daily at 6 PM', value: '0 18 * * *' },
  { label: 'Weekdays 9 AM', value: '0 9 * * 1-5' },
  { label: 'Weekdays 5 PM', value: '0 17 * * 1-5' },
  { label: 'Monday 9 AM', value: '0 9 * * 1' },
  { label: 'Custom', value: 'custom' },
];

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleString('th') : 'Never';

export default function BudgetPage() {
  const [schedules, setSchedules] = useState<BudgetSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    action: 'PAUSE',
    value: 100,
    cronExpr: '0 * * * *',
    timezone: 'Asia/Bangkok',
    campaignId: '',
    adAccountId: '',
  });

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Reference data
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [filteredCampaigns, setFilteredCampaigns] = useState<CampaignOption[]>([]);

  // Cron custom
  const [cronPreset, setCronPreset] = useState('0 * * * *');
  const [customCron, setCustomCron] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/'; return; }
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    loadAll();
  }, []);

  useEffect(() => {
    if (form.adAccountId) {
      setFilteredCampaigns(campaigns.filter(c => c.accountId === form.adAccountId));
    } else {
      setFilteredCampaigns(campaigns);
    }
  }, [form.adAccountId, campaigns]);

  const loadAll = async () => {
    try {
      const [schedRes, acctsRes] = await Promise.all([
        axios.get('/api/budget-schedules'),
        axios.get('/api/adaccounts').catch(() => ({ data: [] })),
      ]);
      setSchedules(schedRes.data);
      setAccounts(acctsRes.data);

      // Load campaigns for each account
      const allCamps: CampaignOption[] = [];
      for (const acct of acctsRes.data) {
        try {
          const { data } = await axios.get(`/api/adaccounts/${acct.id}/campaigns`);
          allCamps.push(...data.map((c: any) => ({ id: c.id, name: c.name, accountId: acct.id })));
        } catch {}
      }
      setCampaigns(allCamps);
      setFilteredCampaigns(allCamps);
    } catch (err: any) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      name: '',
      action: 'PAUSE',
      value: 100,
      cronExpr: '0 * * * *',
      timezone: 'Asia/Bangkok',
      campaignId: '',
      adAccountId: '',
    });
    setCronPreset('0 * * * *');
    setCustomCron('');
  };

  const openNew = () => {
    resetForm();
    setEditId(null);
    setShowModal(true);
  };

  const openEdit = (s: BudgetSchedule) => {
    setForm({
      name: s.name,
      action: s.action,
      value: s.value || 100,
      cronExpr: s.cronExpr,
      timezone: s.timezone,
      campaignId: s.campaignId || '',
      adAccountId: s.adAccountId || '',
    });
    const preset = CRON_PRESETS.find(p => p.value === s.cronExpr);
    if (preset && preset.value !== 'custom') {
      setCronPreset(s.cronExpr);
      setCustomCron('');
    } else {
      setCronPreset('custom');
      setCustomCron(s.cronExpr);
    }
    setEditId(s.id);
    setShowModal(true);
  };

  const saveSchedule = async () => {
    setSaving(true);
    setError('');
    try {
      const cronExpr = cronPreset === 'custom' ? customCron : cronPreset;
      if (!cronExpr || cronExpr.trim() === '') {
        setError('Cron expression is required');
        setSaving(false);
        return;
      }
      if (!form.name.trim()) {
        setError('Name is required');
        setSaving(false);
        return;
      }

      const dto: any = {
        name: form.name,
        action: form.action,
        cronExpr,
        timezone: form.timezone,
      };
      if (form.action === 'SET_BUDGET') dto.value = form.value;
      if (form.action === 'ADJUST_PERCENT') dto.value = form.value;
      if (form.campaignId) dto.campaignId = form.campaignId;
      if (form.adAccountId) dto.adAccountId = form.adAccountId;

      if (editId) {
        await axios.patch(`/api/budget-schedules/${editId}`, dto);
        setMsg('✅ Schedule updated!');
      } else {
        await axios.post('/api/budget-schedules', dto);
        setMsg('✅ Schedule created!');
      }

      setShowModal(false);
      loadAll();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleSchedule = async (id: string) => {
    try {
      await axios.post(`/api/budget-schedules/${id}/toggle`);
      loadAll();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/budget-schedules/${deleteConfirm.id}`);
      setMsg(`🗑️ Schedule "${deleteConfirm.name}" deleted`);
      setDeleteConfirm(null);
      loadAll();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setDeleting(false);
    }
  };

  const scopeLabel = (s: BudgetSchedule) => {
    if (s.campaignId) return 'Campaign';
    if (s.adAccountId) return 'Account';
    return 'All';
  };

  const actionValueLabel = (s: BudgetSchedule) => {
    if (s.action === 'SET_BUDGET' && s.value) return `฿${s.value}`;
    if (s.action === 'ADJUST_PERCENT' && s.value) return `${s.value > 0 ? '+' : ''}${s.value}%`;
    return '';
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading...</p></div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">⏰ Budget Automation</h1>
            <a href="/dashboard" className="text-sm text-blue-600 hover:text-blue-800">← Back to Dashboard</a>
          </div>
          <button onClick={openNew}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium">
            + New Schedule
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {msg && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${
            msg.includes('✅') || msg.includes('🗑️')
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {msg}
            <button className="float-right" onClick={() => setMsg('')}>✕</button>
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
            <button className="float-right" onClick={() => setError('')}>✕</button>
          </div>
        )}

        {schedules.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
            <p className="text-4xl mb-3">⏰</p>
            <p className="text-gray-500 text-lg mb-4">No budget schedules yet</p>
            <p className="text-gray-400 text-sm mb-4">
              Schedule automatic budget changes for your campaigns — pause at night, increase on weekends, and more.
            </p>
            <button onClick={openNew}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium">
              + Create your first schedule
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {schedules.map((s) => (
              <div key={s.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold">{s.name}</h3>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          s.isEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {s.isEnabled ? 'Active' : 'Disabled'}
                        </span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${ACTION_COLORS[s.action] || 'bg-gray-100 text-gray-600'}`}>
                          {ACTION_LABELS[s.action] || s.action}
                        </span>
                        {actionValueLabel(s) && (
                          <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full font-mono">
                            {actionValueLabel(s)}
                          </span>
                        )}
                        <span className="px-2 py-0.5 text-xs bg-blue-50 text-blue-600 rounded-full">
                          {scopeLabel(s)}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(s)}
                        className="px-3 py-1 text-xs rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium">
                        ✏️ Edit
                      </button>
                      <button onClick={() => toggleSchedule(s.id)}
                        className={`px-3 py-1 text-xs rounded-lg font-medium ${
                          s.isEnabled
                            ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}>
                        {s.isEnabled ? 'Disable' : 'Enable'}
                      </button>
                      <button onClick={() => setDeleteConfirm({ id: s.id, name: s.name })}
                        className="px-3 py-1 text-xs rounded-lg bg-red-50 text-red-500 hover:bg-red-100">
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Schedule details */}
                  <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                    <span className="font-mono bg-slate-50 px-2 py-1 rounded text-slate-700">
                      ⏱ {s.cronExpr}
                    </span>
                    <span>🕐 {s.timezone}</span>
                    <span>🔄 Last run: {fmtDate(s.lastRunAt)}</span>
                    <span>📅 Created: {fmtDate(s.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">
              {editId ? '✏️ Edit Schedule' : '⏰ New Budget Schedule'}
            </h3>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium mb-1">Schedule Name</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Pause at night" />
              </div>

              {/* Action */}
              <div>
                <label className="block text-sm font-medium mb-1">Action</label>
                <select value={form.action} onChange={e => setForm({...form, action: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="PAUSE">⏸ Pause Campaign(s)</option>
                  <option value="RESUME">▶️ Resume Campaign(s)</option>
                  <option value="SET_BUDGET">💰 Set Budget</option>
                  <option value="ADJUST_PERCENT">📊 Adjust Budget by %</option>
                </select>
              </div>

              {/* Value (for SET_BUDGET and ADJUST_PERCENT) */}
              {(form.action === 'SET_BUDGET' || form.action === 'ADJUST_PERCENT') && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {form.action === 'SET_BUDGET' ? 'New Budget (THB)' : 'Percentage Adjustment'}
                  </label>
                  <div className="flex items-center gap-2">
                    <input type="number" value={form.value}
                      onChange={e => setForm({...form, value: parseFloat(e.target.value) || 0})}
                      className="flex-1 border rounded-lg px-3 py-2 text-sm"
                      min={form.action === 'SET_BUDGET' ? 1 : undefined}
                      step="1" />
                    {form.action === 'ADJUST_PERCENT' && (
                      <span className="text-xs text-gray-500">
                        (positive = increase, negative = decrease)
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Scope */}
              <div>
                <label className="block text-sm font-medium mb-1">Scope</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Ad Account (optional)</label>
                    <select value={form.adAccountId} onChange={e => setForm({...form, adAccountId: e.target.value})}
                      className="w-full border rounded-lg px-3 py-2 text-sm">
                      <option value="">All accounts</option>
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Campaign (optional)</label>
                    <select value={form.campaignId} onChange={e => setForm({...form, campaignId: e.target.value})}
                      className="w-full border rounded-lg px-3 py-2 text-sm">
                      <option value="">All campaigns</option>
                      {filteredCampaigns.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Cron Expression */}
              <div>
                <label className="block text-sm font-medium mb-1">Schedule (Cron)</label>
                <select value={cronPreset} onChange={e => {
                  const val = e.target.value;
                  setCronPreset(val);
                  if (val !== 'custom') {
                    setForm({...form, cronExpr: val});
                  }
                }}
                  className="w-full border rounded-lg px-3 py-2 text-sm mb-2">
                  {CRON_PRESETS.map(p => (
                    <option key={p.label} value={p.value}>{p.label}</option>
                  ))}
                </select>
                {cronPreset === 'custom' && (
                  <input value={customCron} onChange={e => {
                    setCustomCron(e.target.value);
                    setForm({...form, cronExpr: e.target.value});
                  }}
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                    placeholder="e.g. 30 9 * * 1-5" />
                )}
                <p className="text-xs text-gray-400 mt-1">
                  Format: minute hour day-of-month month day-of-week (e.g., "0 6 * * *" = daily at 6 AM)
                </p>
              </div>

              {/* Timezone */}
              <div>
                <label className="block text-sm font-medium mb-1">Timezone</label>
                <select value={form.timezone} onChange={e => setForm({...form, timezone: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="Asia/Bangkok">Asia/Bangkok (ICT)</option>
                  <option value="Asia/Ho_Chi_Minh">Asia/Ho Chi Minh</option>
                  <option value="Asia/Singapore">Asia/Singapore</option>
                  <option value="Asia/Shanghai">Asia/Shanghai</option>
                  <option value="Asia/Tokyo">Asia/Tokyo</option>
                  <option value="Asia/Seoul">Asia/Seoul</option>
                  <option value="America/New_York">America/New York</option>
                  <option value="America/Chicago">America/Chicago</option>
                  <option value="America/Los_Angeles">America/Los Angeles</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="Europe/Berlin">Europe/Berlin</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={saveSchedule} disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Saving...' : editId ? '💾 Update' : '💾 Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">🗑️ Delete Schedule</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
