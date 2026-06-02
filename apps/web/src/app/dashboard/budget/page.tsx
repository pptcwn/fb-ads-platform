'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { Timer, Play, DollarSign, BarChart3, Pencil, Clock, RefreshCw, Calendar, Trash2, Save, X } from 'lucide-react';
import Shell from '@/components/Shell';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/Modal';
import { ConfirmModal } from '@/components/Modal';

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

const ACTION_LABELS: Record<string, any> = {
  PAUSE: <span className="inline-flex items-center gap-1"><Timer className="w-3 h-3" /> Pause</span>,
  RESUME: <span className="inline-flex items-center gap-1"><Play className="w-3 h-3" /> Resume</span>,
  SET_BUDGET: <span className="inline-flex items-center gap-1"><DollarSign className="w-3 h-3" /> Set Budget</span>,
  ADJUST_PERCENT: <span className="inline-flex items-center gap-1"><BarChart3 className="w-3 h-3" /> Adjust %</span>,
};

const ACTION_COLORS: Record<string, string> = {
  PAUSE: 'badge-danger',
  RESUME: 'bg-success-muted text-success border border-success-border',
  SET_BUDGET: 'bg-accent-muted text-accent border border-accent-border',
  ADJUST_PERCENT: 'badge-warning',
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

  if (loading) return (
    <Shell>
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-ink-300 animate-pulse">Loading budget schedules...</p>
      </div>
    </Shell>
  );

  return (
    <Shell>
      <div className="p-6 space-y-6">
        <PageHeader
          title="⏰ Budget Automation"
          subtitle={schedules.length > 0 ? `${schedules.length} schedules` : undefined}
          actions={
            <button onClick={openNew} className="btn-primary btn-sm">
              + New Schedule
            </button>
          }
        />

        {/* Messages */}
        {msg && (
          <div className={`${msg.includes('✅') || msg.includes('🗑️') ? 'msg-success' : 'msg-error'}`}>
            {msg}
            <button className="float-right" onClick={() => setMsg('')}><X className="w-4 h-4" /></button>
          </div>
        )}
        {error && (
          <div className="msg-error">
            {error}
            <button className="float-right" onClick={() => setError('')}><X className="w-4 h-4" /></button>
          </div>
        )}

        {schedules.length === 0 ? (
          <div className="card p-12 text-center">
            <Clock className="w-12 h-12 mx-auto mb-3 text-ink-200" />
            <p className="text-ink-300 text-lg mb-4">No budget schedules yet</p>
            <p className="text-ink-300 text-sm mb-4">
              Schedule automatic budget changes for your campaigns — pause at night, increase on weekends, and more.
            </p>
            <button onClick={openNew}
              className="btn-primary btn-sm">
              + Create your first schedule
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {schedules.map((s) => (
              <div key={s.id} className="card overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-ink">{s.name}</h3>
                        <span className={`badge-${s.isEnabled ? 'success' : 'ink'} text-xs`}>
                          {s.isEnabled ? 'Active' : 'Disabled'}
                        </span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${ACTION_COLORS[s.action] || 'badge-ink'}`}>
                          {ACTION_LABELS[s.action] || s.action}
                        </span>
                        {actionValueLabel(s) && (
                          <span className="px-2 py-0.5 text-xs bg-surface-100 text-ink rounded-full font-mono">
                            {actionValueLabel(s)}
                          </span>
                        )}
                        <span className="px-2 py-0.5 text-xs bg-accent-muted text-accent border border-accent-border rounded-full">
                          {scopeLabel(s)}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(s)}
                        className="btn-secondary btn-xs inline-flex items-center gap-1">
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                      <button onClick={() => toggleSchedule(s.id)}
                        className={`btn-xs ${
                          s.isEnabled
                            ? 'bg-warning-muted text-warning border border-warning-border hover:bg-warning/20'
                            : 'bg-success-muted text-success border border-success-border hover:bg-success/20'
                        }`}>
                        {s.isEnabled ? 'Disable' : 'Enable'}
                      </button>
                      <button onClick={() => setDeleteConfirm({ id: s.id, name: s.name })}
                        className="btn-danger btn-xs">
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Schedule details */}
                  <div className="mt-3 flex items-center gap-4 text-xs text-ink-300">
                    <span className="font-mono bg-surface-50 px-2 py-1 rounded text-ink inline-flex items-center gap-1">
                      <Timer className="w-3 h-3" /> {s.cronExpr}
                    </span>
                    <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {s.timezone}</span>
                    <span className="inline-flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Last run: {fmtDate(s.lastRunAt)}</span>
                    <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> Created: {fmtDate(s.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? '✏️ Edit Schedule' : '⏰ New Budget Schedule'} maxWidth="max-w-lg">
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Schedule Name</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
              className="w-full px-3 py-2 text-sm bg-surface-50 text-ink" placeholder="e.g. Pause at night" />
          </div>

          {/* Action */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Action</label>
            <select value={form.action} onChange={e => setForm({...form, action: e.target.value})}
              className="w-full px-3 py-2 text-sm bg-surface-50 text-ink">
              <option value="PAUSE"><Timer className="w-4 h-4 inline" /> Pause Campaign(s)</option>
              <option value="RESUME"><Play className="w-4 h-4 inline" /> Resume Campaign(s)</option>
              <option value="SET_BUDGET"><DollarSign className="w-4 h-4 inline" /> Set Budget</option>
              <option value="ADJUST_PERCENT"><BarChart3 className="w-4 h-4 inline" /> Adjust Budget by %</option>
            </select>
          </div>

          {/* Value (for SET_BUDGET and ADJUST_PERCENT) */}
          {(form.action === 'SET_BUDGET' || form.action === 'ADJUST_PERCENT') && (
            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                {form.action === 'SET_BUDGET' ? 'New Budget (THB)' : 'Percentage Adjustment'}
              </label>
              <div className="flex items-center gap-2">
                <input type="number" value={form.value}
                  onChange={e => setForm({...form, value: parseFloat(e.target.value) || 0})}
                  className="flex-1 border border-surface-200 rounded-lg px-3 py-2 text-sm bg-surface-50 text-ink"
                  min={form.action === 'SET_BUDGET' ? 1 : undefined}
                  step="1" />
                {form.action === 'ADJUST_PERCENT' && (
                  <span className="text-xs text-ink-300">
                    (positive = increase, negative = decrease)
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Scope */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Scope</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-ink-300 mb-1">Ad Account (optional)</label>
                <select value={form.adAccountId} onChange={e => setForm({...form, adAccountId: e.target.value})}
                  className="w-full px-3 py-2 text-sm bg-surface-50 text-ink">
                  <option value="">All accounts</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-ink-300 mb-1">Campaign (optional)</label>
                <select value={form.campaignId} onChange={e => setForm({...form, campaignId: e.target.value})}
                  className="w-full px-3 py-2 text-sm bg-surface-50 text-ink">
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
            <label className="block text-sm font-medium text-ink mb-1">Schedule (Cron)</label>
            <select value={cronPreset} onChange={e => {
              const val = e.target.value;
              setCronPreset(val);
              if (val !== 'custom') {
                setForm({...form, cronExpr: val});
              }
            }}
              className="w-full px-3 py-2 text-sm bg-surface-50 text-ink mb-2">
              {CRON_PRESETS.map(p => (
                <option key={p.label} value={p.value}>{p.label}</option>
              ))}
            </select>
            {cronPreset === 'custom' && (
              <input value={customCron} onChange={e => {
                setCustomCron(e.target.value);
                setForm({...form, cronExpr: e.target.value});
              }}
                className="w-full px-3 py-2 text-sm bg-surface-50 text-ink font-mono"
                placeholder="e.g. 30 9 * * 1-5" />
            )}
            <p className="text-xs text-ink-300 mt-1">
              Format: minute hour day-of-month month day-of-week (e.g., &quot;0 6 * * *&quot; = daily at 6 AM)
            </p>
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Timezone</label>
            <select value={form.timezone} onChange={e => setForm({...form, timezone: e.target.value})}
              className="w-full px-3 py-2 text-sm bg-surface-50 text-ink">
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

        <div className="flex justify-end gap-2 mt-6 pt-4 -mx-5 px-5 border-t border-surface-300">
          <button onClick={() => setShowModal(false)}
            className="btn-secondary btn-sm">
            Cancel
          </button>
          <button onClick={saveSchedule} disabled={saving}
            className="btn-primary btn-sm">
            {saving ? 'Saving...' : editId ? <><Save className="w-4 h-4" /> Update</> : <><Save className="w-4 h-4" /> Create</>}
          </button>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={confirmDelete}
        title="Delete Schedule"
        message={deleteConfirm ? `Are you sure you want to delete "${deleteConfirm.name}"? This action cannot be undone.` : ''}
        busy={deleting}
        icon="🗑️"
        danger
      />
    </Shell>
  );
}
