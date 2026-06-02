'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { Calendar, Plus, Pencil, Trash2, Clock, RefreshCw, AlertTriangle, StopCircle, Play, Timer, Save, X } from 'lucide-react';
import Shell from '@/components/Shell';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/Modal';
import { ConfirmModal } from '@/components/Modal';

interface Campaign { id: string; campaignId: string; name: string; status: string; objective: string; }
interface Schedule {
  id: string;
  campaignId: string;
  campaignName: string;
  campaignStatus: string;
  action: string;
  scheduleType: string;
  executeAt: string;
  endTime: string | null;
  daysOfWeek: number[] | null;
  timeOfDay: string | null;
  enabled: boolean;
  lastRunAt: string | null;
  lastError: string | null;
  runCount: number;
  createdAt: string;
}

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : '-';
const fmtTime = (t: string | null) => t || '-';

const ACTION_BADGE: Record<string, string> = {
  START: 'badge-success',
  STOP: 'badge-danger',
};

const TYPE_LABELS: Record<string, string> = {
  ONCE: 'One-time',
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  HOURLY: 'Hourly',
};

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({
    campaignId: '', action: 'STOP', scheduleType: 'ONCE',
    executeAt: '', endTime: '', daysOfWeek: [] as number[],
    timeOfDay: '',
  });
  const [formBusy, setFormBusy] = useState(false);

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState<Schedule | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/'; return; }
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [schRes, camRes] = await Promise.all([
        axios.get('/api/schedules').catch(() => ({ data: [] })),
        axios.get('/api/campaigns').catch(() => ({ data: [] })),
      ]);
      setSchedules(schRes.data);
      setCampaigns(camRes.data);
    } catch { setError('Failed to load data'); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditId(null);
    setForm({ campaignId: '', action: 'STOP', scheduleType: 'ONCE', executeAt: '', endTime: '', daysOfWeek: [], timeOfDay: '' });
    setShowModal(true);
  };

  const openEdit = (s: Schedule) => {
    setEditId(s.id);
    setForm({
      campaignId: s.campaignId,
      action: s.action,
      scheduleType: s.scheduleType,
      executeAt: s.executeAt ? new Date(s.executeAt).toISOString().slice(0, 16) : '',
      endTime: s.endTime ? new Date(s.endTime).toISOString().slice(0, 16) : '',
      daysOfWeek: s.daysOfWeek || [],
      timeOfDay: s.timeOfDay || '',
    });
    setShowModal(true);
  };

  const submitForm = async () => {
    setFormBusy(true); setError(''); setMsg('');
    try {
      const payload = { ...form };
      if (payload.scheduleType !== 'ONCE') delete payload.executeAt;
      if (payload.scheduleType === 'DAILY' || payload.scheduleType === 'WEEKLY') delete payload.executeAt;
      if (payload.scheduleType !== 'WEEKLY') delete payload.daysOfWeek;
      if (!payload.endTime) delete payload.endTime;

      if (editId) {
        const { data } = await axios.patch(`/api/schedules/${editId}`, payload);
        setMsg(data.message);
      } else {
        const { data } = await axios.post('/api/schedules', payload);
        setMsg(data.message);
      }
      setShowModal(false);
      await fetchAll();
    } catch (err: any) { setError(err?.response?.data?.message || err.message); }
    finally { setFormBusy(false); }
  };

  const deleteSchedule = async () => {
    if (!deleteConfirm) return;
    try {
      const { data } = await axios.delete(`/api/schedules/${deleteConfirm.id}`);
      setMsg(data.message);
      setDeleteConfirm(null);
      await fetchAll();
    } catch (err: any) { setError(err?.response?.data?.message || err.message); }
  };

  const toggleSchedule = async (id: string) => {
    try {
      const { data } = await axios.post(`/api/schedules/${id}/toggle`);
      setMsg(data.message);
      await fetchAll();
    } catch (err: any) { setError(err?.response?.data?.message || err.message); }
  };

  const runNow = async (id: string) => {
    try {
      const { data } = await axios.post(`/api/schedules/${id}/run-now`);
      setMsg(data.message);
      await fetchAll();
    } catch (err: any) { setError(err?.response?.data?.message || err.message); }
  };

  const toggleDay = (day: number) => {
    setForm((prev: any) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d: number) => d !== day)
        : [...prev.daysOfWeek, day],
    }));
  };

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (loading) return (
    <Shell>
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-ink-300 animate-pulse">Loading schedules...</p>
      </div>
    </Shell>
  );

  return (
    <Shell>
      <div className="p-6 space-y-6">
        <PageHeader
          title="📅 Campaign Schedules"
          subtitle={`${schedules.length} schedules`}
          actions={
            <button onClick={openCreate} className="btn-primary btn-sm inline-flex items-center gap-1"><Plus className="w-4 h-4" /> New Schedule</button>
          }
        />

        {msg && <div className="msg-success">{msg}<button className="float-right" onClick={() => setMsg('')}><X className="w-4 h-4" /></button></div>}
        {error && <div className="msg-error">{error}<button className="float-right" onClick={() => setError('')}><X className="w-4 h-4" /></button></div>}

        {schedules.length === 0 ? (
          <div className="card p-12 text-center">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-ink-200" />
            <p className="text-lg font-medium mb-1 text-ink">No schedules yet</p>
            <p className="text-sm text-ink-300">Create a schedule to auto start/stop campaigns.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {schedules.map(s => (
              <div key={s.id} className={`card p-4 transition-colors ${s.enabled ? 'hover:border-surface-300' : 'opacity-60'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`badge-ink text-[10px] ${ACTION_BADGE[s.action] || 'badge-ink'}`}>{s.action}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{s.campaignName}</p>
                      <p className="text-[10px] text-ink-300">{TYPE_LABELS[s.scheduleType] || s.scheduleType}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => runNow(s.id)}
                      className="btn-secondary btn-xs inline-flex items-center gap-1"><Play className="w-3 h-3" /> Run</button>
                    <button onClick={() => toggleSchedule(s.id)}
                      className={`btn-xs rounded border ${s.enabled ? 'bg-warning-muted text-warning border-warning-border' : 'bg-success-muted text-success border-success-border'}`}>
                      {s.enabled ? <span className="inline-flex items-center gap-1"><Timer className="w-3 h-3" /> Pause</span> : <span className="inline-flex items-center gap-1"><Play className="w-3 h-3" /> Resume</span>}
                    </button>
                    <button onClick={() => openEdit(s)}
                      className="btn-ghost btn-xs text-ink-300 hover:text-ink"><Pencil className="w-3 h-3" /></button>
                    <button onClick={() => setDeleteConfirm(s)}
                      className="btn-ghost btn-xs text-ink-300 hover:text-danger"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10px] text-ink-300">
                  <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {s.scheduleType === 'ONCE' ? fmtDate(s.executeAt) : fmtTime(s.timeOfDay)}{s.daysOfWeek ? ` (${s.daysOfWeek.map(d => DAYS[d]).join(', ')})` : ''}</span>
                  <span className="inline-flex items-center gap-1"><RefreshCw className="w-3 h-3" /> {s.runCount}x</span>
                  <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> {fmtDate(s.lastRunAt)}</span>
                  {s.lastError && <span className="text-danger inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {s.lastError}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Create/Edit Modal ─── */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? '✏️ Edit Schedule' : '📅 New Schedule'}>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-ink-300 mb-1">Campaign</label>
            <select value={form.campaignId} onChange={e => setForm({...form, campaignId: e.target.value})}
              className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 text-sm text-ink">
              <option value="">Select campaign...</option>
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-ink-300 mb-1">Action</label>
              <div className="flex gap-2">
                <button onClick={() => setForm({...form, action: 'STOP'})}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors inline-flex items-center justify-center gap-1 ${
                    form.action === 'STOP' ? 'bg-danger text-white border-danger' : 'bg-surface-50 text-ink-300 border-surface-200'
                  }`}><StopCircle className="w-3 h-3" /> STOP</button>
                <button onClick={() => setForm({...form, action: 'START'})}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors inline-flex items-center justify-center gap-1 ${
                    form.action === 'START' ? 'bg-success text-white border-success' : 'bg-surface-50 text-ink-300 border-surface-200'
                  }`}><Play className="w-3 h-3" /> START</button>
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-ink-300 mb-1">Type</label>
              <select value={form.scheduleType} onChange={e => setForm({...form, scheduleType: e.target.value})}
                className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 text-sm text-ink">
                <option value="ONCE">One-time</option>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
              </select>
            </div>
          </div>

          {form.scheduleType === 'ONCE' && (
            <div>
              <label className="block text-xs text-ink-300 mb-1">Execute At</label>
              <input type="datetime-local" value={form.executeAt}
                onChange={e => setForm({...form, executeAt: e.target.value})}
                className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 text-sm text-ink" />
            </div>
          )}

          {(form.scheduleType === 'DAILY' || form.scheduleType === 'WEEKLY') && (
            <div>
              <label className="block text-xs text-ink-300 mb-1">Time of Day</label>
              <input type="time" value={form.timeOfDay}
                onChange={e => setForm({...form, timeOfDay: e.target.value})}
                className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 text-sm text-ink" />
            </div>
          )}

          {form.scheduleType === 'WEEKLY' && (
            <div>
              <label className="block text-xs text-ink-300 mb-1">Days of Week</label>
              <div className="flex gap-1">
                {DAYS.map((day, i) => (
                  <button key={i} onClick={() => toggleDay(i)}
                    className={`px-2 py-1.5 rounded text-[10px] font-medium transition-colors ${
                      form.daysOfWeek.includes(i)
                        ? 'bg-accent text-white'
                        : 'bg-surface-50 text-ink-300 border border-surface-200'
                    }`}>{day}</button>
                ))}
              </div>
            </div>
          )}

          <p className="text-[10px] text-ink-300">The cron checks every minute and executes the action when conditions match.</p>
        </div>
        <div className="flex justify-end gap-2 mt-4 pt-4 -mx-5 px-5 border-t border-surface-300">
          <button onClick={() => setShowModal(false)} className="btn-secondary btn-sm">Cancel</button>
          <button onClick={submitForm} disabled={formBusy || !form.campaignId || !form.action}
            className="btn-primary btn-sm">
            {formBusy ? 'Saving...' : editId ? <><Save className="w-4 h-4" /> Update</> : <><Calendar className="w-4 h-4" /> Create Schedule</>}
          </button>
        </div>
      </Modal>

      {/* ─── Delete Confirmation ─── */}
      <ConfirmModal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={deleteSchedule}
        title="Delete Schedule"
        message={deleteConfirm ? `Are you sure you want to delete the schedule for "${deleteConfirm.campaignName}"?` : ''}
        confirmLabel="Delete"
        danger
        icon="🗑"
      />
    </Shell>
  );
}
