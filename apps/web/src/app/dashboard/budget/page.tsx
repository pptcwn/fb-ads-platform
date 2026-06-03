'use client';

import { useEffect, useState } from 'react';
import { accountsApi, budgetSchedulesApi } from '@/lib/api-client';
import { Timer, Pencil, Clock, RefreshCw, Trash2, Save, X } from 'lucide-react';
import Shell from '@/components/Shell';
import AutomationLayout from '@/components/layout/AutomationLayout';
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

  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
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
        budgetSchedulesApi.list(),
        accountsApi.list().catch(() => ({ data: [] })),
      ]);
      setSchedules(schedRes.data);
      setAccounts(acctsRes.data);

      const allCamps: CampaignOption[] = [];
      for (const acct of acctsRes.data) {
        try {
          const { data } = await accountsApi.campaigns(acct.id);
          allCamps.push(...data.map((c) => ({ id: c.id, name: c.name, accountId: acct.id })));
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

  const selectedBudget = selectedBudgetId && selectedBudgetId !== 'new'
    ? schedules.find((s) => s.id === selectedBudgetId)
    : null;

  const openNew = () => {
    resetForm();
    setEditId(null);
    setSelectedBudgetId('new');
  };

  const selectBudget = (s: BudgetSchedule) => {
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
    setSelectedBudgetId(s.id);
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
        await budgetSchedulesApi.update(editId, dto);
        setMsg('✅ Schedule updated!');
      } else {
        await budgetSchedulesApi.create(dto);
        setMsg('✅ Schedule created!');
      }

      setSelectedBudgetId(null);
      loadAll();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleSchedule = async (id: string) => {
    try {
      await budgetSchedulesApi.toggle(id);
      loadAll();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await budgetSchedulesApi.remove(deleteConfirm.id);
      setMsg(`🗑️ Schedule "${deleteConfirm.name}" deleted`);
      setDeleteConfirm(null);
      if (deleteConfirm.id === selectedBudgetId) setSelectedBudgetId(null);
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

  const budgetForm = (
    <>
      <h3 className="text-lg font-semibold mb-4 text-ink inline-flex items-center gap-2">
        {editId ? <><Pencil className="w-4 h-4" /> แก้ไขงบประมาณ</> : 'สร้างงบประมาณอัตโนมัติ'}
      </h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink mb-1">ชื่อ</label>
          <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
            className="w-full px-3 py-2 text-sm bg-surface-50 text-ink border border-surface-200 rounded-lg" placeholder="เช่น หยุดตอนกลางคืน" />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1">การกระทำ</label>
          <select value={form.action} onChange={e => setForm({...form, action: e.target.value})}
            className="w-full px-3 py-2 text-sm bg-surface-50 text-ink border border-surface-200 rounded-lg">
            <option value="PAUSE">หยุดแคมเปญ</option>
            <option value="RESUME">เริ่มแคมเปญ</option>
            <option value="SET_BUDGET">ตั้งงบประมาณ</option>
            <option value="ADJUST_PERCENT">ปรับงบเป็น %</option>
          </select>
        </div>
        {(form.action === 'SET_BUDGET' || form.action === 'ADJUST_PERCENT') && (
          <div>
            <label className="block text-sm font-medium text-ink mb-1">
              {form.action === 'SET_BUDGET' ? 'งบใหม่ (บาท)' : 'ปรับเปอร์เซ็นต์'}
            </label>
            <input type="number" value={form.value}
              onChange={e => setForm({...form, value: parseFloat(e.target.value) || 0})}
              className="w-full border border-surface-200 rounded-lg px-3 py-2 text-sm bg-surface-50 text-ink"
              min={form.action === 'SET_BUDGET' ? 1 : undefined}
              step="1" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-ink-300 mb-1">บัญชีโฆษณา (ไม่บังคับ)</label>
            <select value={form.adAccountId} onChange={e => setForm({...form, adAccountId: e.target.value})}
              className="w-full px-3 py-2 text-sm bg-surface-50 text-ink border border-surface-200 rounded-lg">
              <option value="">ทุกบัญชี</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-ink-300 mb-1">แคมเปญ (ไม่บังคับ)</label>
            <select value={form.campaignId} onChange={e => setForm({...form, campaignId: e.target.value})}
              className="w-full px-3 py-2 text-sm bg-surface-50 text-ink border border-surface-200 rounded-lg">
              <option value="">ทุกแคมเปญ</option>
              {filteredCampaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1">ตาราง (Cron)</label>
          <select value={cronPreset} onChange={e => {
            const val = e.target.value;
            setCronPreset(val);
            if (val !== 'custom') setForm({...form, cronExpr: val});
          }}
            className="w-full px-3 py-2 text-sm bg-surface-50 text-ink border border-surface-200 rounded-lg mb-2">
            {CRON_PRESETS.map(p => <option key={p.label} value={p.value}>{p.label}</option>)}
          </select>
          {cronPreset === 'custom' && (
            <input value={customCron} onChange={e => {
              setCustomCron(e.target.value);
              setForm({...form, cronExpr: e.target.value});
            }}
              className="w-full px-3 py-2 text-sm bg-surface-50 text-ink font-mono border border-surface-200 rounded-lg"
              placeholder="เช่น 30 9 * * 1-5" />
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1">เขตเวลา</label>
          <select value={form.timezone} onChange={e => setForm({...form, timezone: e.target.value})}
            className="w-full px-3 py-2 text-sm bg-surface-50 text-ink border border-surface-200 rounded-lg">
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
      <div className="flex gap-2 mt-4">
        <button onClick={saveSchedule} disabled={saving} className="btn-primary btn-sm">
          {saving ? 'กำลังบันทึก...' : editId ? <><Save className="w-4 h-4" /> บันทึก</> : <><Save className="w-4 h-4" /> สร้าง</>}
        </button>
        {selectedBudget && (
          <button onClick={() => setDeleteConfirm({ id: selectedBudget.id, name: selectedBudget.name })}
            className="btn-danger btn-sm inline-flex items-center gap-1">
            <Trash2 className="w-4 h-4" /> ลบ
          </button>
        )}
      </div>
    </>
  );

  return (
    <Shell>
      {msg && (
        <div className={`mb-4 ${msg.includes('✅') || msg.includes('🗑️') ? 'msg-success' : 'msg-error'}`}>
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

      <AutomationLayout
        title="งบประมาณอัตโนมัติ"
        subtitle={schedules.length > 0 ? `${schedules.length} รายการ` : undefined}
        selectedId={selectedBudgetId}
        actions={
          <button onClick={openNew} className="btn-primary btn-sm">+ สร้างใหม่</button>
        }
        list={
          schedules.length === 0 ? (
            <p className="text-sm text-ink-300 text-center py-8">ยังไม่มีรายการ</p>
          ) : (
            <div className="space-y-1">
              {schedules.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-stretch gap-1 rounded-lg transition-colors ${
                    selectedBudgetId === s.id ? 'bg-accent-muted border border-accent-border' : 'hover:bg-surface-100'
                  }`}
                >
                  <button type="button" onClick={() => selectBudget(s)} className="flex-1 text-left p-3 min-w-0">
                    <p className="font-medium text-sm text-ink truncate">{s.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${ACTION_COLORS[s.action] || 'badge-ink'}`}>
                        {s.action}
                      </span>
                      {actionValueLabel(s) && (
                        <span className="text-[10px] text-ink-300 font-mono">{actionValueLabel(s)}</span>
                      )}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSchedule(s.id)}
                    className={`shrink-0 self-center mx-2 btn-xs ${
                      s.isEnabled
                        ? 'bg-warning-muted text-warning border border-warning-border'
                        : 'bg-success-muted text-success border border-success-border'
                    }`}
                  >
                    {s.isEnabled ? 'ปิด' : 'เปิด'}
                  </button>
                </div>
              ))}
            </div>
          )
        }
        detail={
          selectedBudgetId ? (
            <>
              <button
                type="button"
                onClick={() => setSelectedBudgetId(null)}
                className="lg:hidden text-sm text-accent mb-4 inline-flex items-center gap-1"
              >
                ← กลับ
              </button>
              {budgetForm}
              {selectedBudget && (
                <div className="mt-4 pt-4 border-t border-surface-300 flex flex-wrap gap-3 text-xs text-ink-300">
                  <span className="font-mono bg-surface-50 px-2 py-1 rounded text-ink inline-flex items-center gap-1">
                    <Timer className="w-3 h-3" /> {selectedBudget.cronExpr}
                  </span>
                  <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {selectedBudget.timezone}</span>
                  <span className="inline-flex items-center gap-1"><RefreshCw className="w-3 h-3" /> รันล่าสุด: {fmtDate(selectedBudget.lastRunAt)}</span>
                  <span>{scopeLabel(selectedBudget)}</span>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[320px] text-center text-ink-300">
              <Clock className="w-10 h-10 mb-3 text-ink-200" />
              <p>เลือกรายการจากด้านซ้าย</p>
              <button onClick={openNew} className="btn-primary btn-sm mt-4">+ สร้างใหม่</button>
            </div>
          )
        }
      />

      <ConfirmModal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={confirmDelete}
        title="ลบรายการ"
        message={deleteConfirm ? `ลบ "${deleteConfirm.name}"?` : ''}
        busy={deleting}
        danger
      />
    </Shell>
  );
}
