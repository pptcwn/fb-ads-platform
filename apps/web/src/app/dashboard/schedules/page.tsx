'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';

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

const ACTION_COLORS: Record<string, string> = {
  START: 'bg-green-900/40 text-green-400 border-green-800/50',
  STOP: 'bg-red-900/40 text-red-400 border-red-800/50',
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

  const deleteSchedule = async (id: string) => {
    if (!confirm('Delete this schedule?')) return;
    try {
      const { data } = await axios.delete(`/api/schedules/${id}`);
      setMsg(data.message);
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
    <div className="min-h-screen bg-[#0b1120] flex items-center justify-center">
      <p className="text-slate-400 animate-pulse">Loading schedules...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-200">
      <header className="bg-[#1e293b] border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold">FB Ads Platform</h1>
            <nav className="flex gap-4 text-sm">
              <a href="/dashboard" className="text-gray-400 hover:text-gray-200">Dashboard</a>
              <a href="/dashboard/all-campaigns" className="text-gray-400 hover:text-gray-200">📋 Campaigns</a>
              <a href="/dashboard/analytics" className="text-gray-400 hover:text-gray-200">📊 Analytics</a>
              <a href="/dashboard/audiences" className="text-gray-400 hover:text-gray-200">🎯 Audiences</a>
              <a href="/dashboard/templates" className="text-gray-400 hover:text-gray-200">📦 Templates</a>
              <a href="/dashboard/abtest" className="text-gray-400 hover:text-gray-200">🔁 A/B Test</a>
              <a href="/dashboard/schedules" className="text-blue-400 font-medium hover:text-blue-300">📅 Schedules</a>
              <a href="/dashboard/rules" className="text-gray-400 hover:text-gray-200">⚡ Rules</a>
              <a href="/dashboard/budget" className="text-gray-400 hover:text-gray-200">💰 Budget</a>
              <a href="/dashboard/notifications" className="text-gray-400 hover:text-gray-200">🔔 Alerts</a>
              <a href="/dashboard/creatives" className="text-gray-400 hover:text-gray-200">🎨 Creatives</a>
            </nav>
          </div>
          <button onClick={() => { localStorage.removeItem('token'); window.location.href = '/'; }}
            className="text-sm text-gray-500 hover:text-red-400">Sign Out</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">📅 Campaign Schedules</h2>
            <p className="text-sm text-slate-500 mt-1">{schedules.length} schedules</p>
          </div>
          <button onClick={openCreate}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">➕ New Schedule</button>
        </div>

        {msg && <div className="px-4 py-3 rounded-lg text-sm bg-green-900/30 text-green-400 border border-green-800/50">{msg}<button className="float-right" onClick={() => setMsg('')}>✕</button></div>}
        {error && <div className="px-4 py-3 rounded-lg text-sm bg-red-900/30 text-red-400 border border-red-800/50">{error}<button className="float-right" onClick={() => setError('')}>✕</button></div>}

        {schedules.length === 0 ? (
          <div className="bg-[#1e293b] rounded-xl border border-slate-700/50 p-12 text-center">
            <p className="text-4xl mb-3">📅</p>
            <p className="text-lg font-medium mb-1 text-slate-300">No schedules yet</p>
            <p className="text-sm text-slate-500">Create a schedule to auto start/stop campaigns.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {schedules.map(s => (
              <div key={s.id} className={`bg-[#1e293b] rounded-xl p-4 border transition-colors ${s.enabled ? 'border-slate-700/50 hover:border-slate-600' : 'border-slate-800/30 opacity-60'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${ACTION_COLORS[s.action]}`}>{s.action}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.campaignName}</p>
                      <p className="text-[10px] text-slate-500">{TYPE_LABELS[s.scheduleType] || s.scheduleType}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => runNow(s.id)} className="text-[10px] text-blue-400 hover:text-blue-300 px-2 py-1 rounded bg-[#0b1120] border border-slate-700/50">▶ Run</button>
                    <button onClick={() => toggleSchedule(s.id)} className={`text-[10px] px-2 py-1 rounded border ${s.enabled ? 'bg-yellow-900/40 text-yellow-400 border-yellow-800/50' : 'bg-green-900/40 text-green-400 border-green-800/50'}`}>{s.enabled ? '⏸ Pause' : '▶ Resume'}</button>
                    <button onClick={() => openEdit(s)} className="text-[10px] text-slate-400 hover:text-slate-200 px-2 py-1">✏️</button>
                    <button onClick={() => deleteSchedule(s.id)} className="text-[10px] text-red-400 hover:text-red-300 px-2 py-1">🗑</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10px] text-slate-500">
                  <span>⏰ {s.scheduleType === 'ONCE' ? fmtDate(s.executeAt) : fmtTime(s.timeOfDay)}{s.daysOfWeek ? ` (${s.daysOfWeek.map(d => DAYS[d]).join(', ')})` : ''}</span>
                  <span>🔄 {s.runCount}x</span>
                  <span>📅 {fmtDate(s.lastRunAt)}</span>
                  {s.lastError && <span className="text-red-400">⚠️ {s.lastError}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ─── Create/Edit Modal ─── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-[#1e293b] rounded-xl shadow-xl w-full max-w-lg mx-4 border border-slate-700/50" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{editId ? '✏️ Edit Schedule' : '📅 New Schedule'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-200 text-xl">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Campaign</label>
                <select value={form.campaignId} onChange={e => setForm({...form, campaignId: e.target.value})}
                  className="w-full bg-[#0b1120] border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200">
                  <option value="">Select campaign...</option>
                  {campaigns.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-slate-400 mb-1">Action</label>
                  <div className="flex gap-2">
                    <button onClick={() => setForm({...form, action: 'STOP'})}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        form.action === 'STOP' ? 'bg-red-600 text-white border-red-500' : 'bg-[#0b1120] text-slate-400 border-slate-600'
                      }`}>⏹ STOP</button>
                    <button onClick={() => setForm({...form, action: 'START'})}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        form.action === 'START' ? 'bg-green-600 text-white border-green-500' : 'bg-[#0b1120] text-slate-400 border-slate-600'
                      }`}>▶ START</button>
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-slate-400 mb-1">Type</label>
                  <select value={form.scheduleType} onChange={e => setForm({...form, scheduleType: e.target.value})}
                    className="w-full bg-[#0b1120] border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200">
                    <option value="ONCE">One-time</option>
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                  </select>
                </div>
              </div>

              {form.scheduleType === 'ONCE' && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Execute At</label>
                  <input type="datetime-local" value={form.executeAt}
                    onChange={e => setForm({...form, executeAt: e.target.value})}
                    className="w-full bg-[#0b1120] border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200" />
                </div>
              )}

              {(form.scheduleType === 'DAILY' || form.scheduleType === 'WEEKLY') && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Time of Day</label>
                  <input type="time" value={form.timeOfDay}
                    onChange={e => setForm({...form, timeOfDay: e.target.value})}
                    className="w-full bg-[#0b1120] border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200" />
                </div>
              )}

              {form.scheduleType === 'WEEKLY' && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Days of Week</label>
                  <div className="flex gap-1">
                    {DAYS.map((day, i) => (
                      <button key={i} onClick={() => toggleDay(i)}
                        className={`px-2 py-1.5 rounded text-[10px] font-medium transition-colors ${
                          form.daysOfWeek.includes(i)
                            ? 'bg-blue-600 text-white'
                            : 'bg-[#0b1120] text-slate-400 border border-slate-600'
                        }`}>{day}</button>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[10px] text-slate-500">The cron checks every minute and executes the action when conditions match.</p>
            </div>
            <div className="p-4 border-t border-slate-700/50 flex justify-end gap-2">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-slate-600 rounded-lg text-sm text-slate-300 hover:bg-slate-700">Cancel</button>
              <button onClick={submitForm} disabled={formBusy || !form.campaignId || !form.action}
                className="px-4 py-2 bg-blue-600 rounded-lg text-sm text-white hover:bg-blue-700 disabled:opacity-50">
                {formBusy ? 'Saving...' : editId ? '💾 Update' : '📅 Create Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
