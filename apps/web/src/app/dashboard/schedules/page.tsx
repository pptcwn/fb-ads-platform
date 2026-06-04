'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSelectedAdAccount } from '@/hooks/use-selected-ad-account';
import AccountRestrictionBanner from '@/components/layout/AccountRestrictionBanner';
import { campaignsApi, schedulesApi } from '@/lib/api-client';
import { Calendar, Plus, Pencil, Trash2, Clock, RefreshCw, AlertTriangle, StopCircle, Play, Timer, Save, X } from 'lucide-react';
import AutomationLayout from '@/components/layout/AutomationLayout';
import { ConfirmModal } from '@/components/Modal';

interface CampaignOption { id: string; campaignId: string; name: string; status: string; objective: string; accountId: string; }
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
  ONCE: 'ครั้งเดียว',
  DAILY: 'รายวัน',
  WEEKLY: 'รายสัปดาห์',
};

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({
    campaignId: '', action: 'STOP', scheduleType: 'ONCE',
    executeAt: '', endTime: '', daysOfWeek: [] as number[],
    timeOfDay: '',
  });
  const [formBusy, setFormBusy] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<Schedule | null>(null);
  const { selectedAccountId, selectedAccount, canCreate, isRestricted } = useSelectedAdAccount();

  const scopedCampaigns = useMemo(
    () => (selectedAccountId ? campaigns.filter((c) => c.accountId === selectedAccountId) : []),
    [campaigns, selectedAccountId],
  );

  const scopedCampaignIds = useMemo(
    () => new Set(scopedCampaigns.map((c) => c.id)),
    [scopedCampaigns],
  );

  const scopedSchedules = useMemo(() => {
    if (!selectedAccountId) return [];
    return schedules.filter((s) => scopedCampaignIds.has(s.campaignId));
  }, [schedules, selectedAccountId, scopedCampaignIds]);

  useEffect(() => {
    if (
      selectedScheduleId &&
      selectedScheduleId !== 'new' &&
      !scopedSchedules.some((s) => s.id === selectedScheduleId)
    ) {
      setSelectedScheduleId(null);
    }
  }, [scopedSchedules, selectedScheduleId]);

  const selectedSchedule = selectedScheduleId && selectedScheduleId !== 'new'
    ? scopedSchedules.find((s) => s.id === selectedScheduleId)
    : null;

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [schRes, acctRes] = await Promise.all([
        schedulesApi.list().catch(() => ({ data: [] })),
        campaignsApi.list().catch(() => ({ data: [] })),
      ]);
      setSchedules(schRes.data);
      const flat: CampaignOption[] = (acctRes.data || []).flatMap((acct) =>
        (acct.campaigns || []).map((c) => ({
          id: c.id,
          campaignId: c.campaignId ?? c.id,
          name: c.name,
          status: c.status,
          objective: c.objective,
          accountId: acct.id,
        })),
      );
      setCampaigns(flat);
    } catch { setError('Failed to load data'); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditId(null);
    setForm({ campaignId: '', action: 'STOP', scheduleType: 'ONCE', executeAt: '', endTime: '', daysOfWeek: [], timeOfDay: '' });
    setSelectedScheduleId('new');
  };

  const selectSchedule = (s: Schedule) => {
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
    setSelectedScheduleId(s.id);
  };

  const submitForm = async () => {
    if (form.scheduleType === 'ONCE' && !form.executeAt) {
      setError('Please set Execute At for a one-time schedule');
      return;
    }
    if ((form.scheduleType === 'DAILY' || form.scheduleType === 'WEEKLY') && !form.timeOfDay) {
      setError('Please set Time of Day');
      return;
    }
    if (form.scheduleType === 'WEEKLY' && form.daysOfWeek.length === 0) {
      setError('Please select at least one day for weekly schedule');
      return;
    }
    setFormBusy(true); setError(''); setMsg('');
    try {
      const payload = { ...form };
      if (payload.scheduleType !== 'ONCE') delete payload.executeAt;
      if (payload.scheduleType === 'DAILY' || payload.scheduleType === 'WEEKLY') delete payload.executeAt;
      if (payload.scheduleType !== 'WEEKLY') delete payload.daysOfWeek;
      if (!payload.endTime) delete payload.endTime;

      if (editId) {
        const { data } = await schedulesApi.update(editId, payload);
        setMsg(data.message);
      } else {
        const { data } = await schedulesApi.create(payload);
        setMsg(data.message);
      }
      setSelectedScheduleId(null);
      setEditId(null);
      await fetchAll();
    } catch (err: any) { setError(err?.response?.data?.message || err.message); }
    finally { setFormBusy(false); }
  };

  const deleteSchedule = async () => {
    if (!deleteConfirm) return;
    try {
      const { data } = await schedulesApi.remove(deleteConfirm.id);
      setMsg(data.message);
      if (deleteConfirm.id === selectedScheduleId) setSelectedScheduleId(null);
      setDeleteConfirm(null);
      await fetchAll();
    } catch (err: any) { setError(err?.response?.data?.message || err.message); }
  };

  const toggleSchedule = async (id: string) => {
    try {
      const { data } = await schedulesApi.toggle(id);
      setMsg(data.message);
      await fetchAll();
    } catch (err: any) { setError(err?.response?.data?.message || err.message); }
  };

  const runNow = async (id: string) => {
    try {
      const { data } = await schedulesApi.runNow(id);
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

  const DAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

  const scheduleForm = (
    <>
      <h3 className="text-lg font-semibold mb-4 text-ink inline-flex items-center gap-2">
        {editId ? <><Pencil className="w-4 h-4" /> แก้ไขตารางเวลา</> : 'สร้างตารางเวลาใหม่'}
      </h3>
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-ink-300 mb-1">แคมเปญ</label>
          <select value={form.campaignId} onChange={e => setForm({...form, campaignId: e.target.value})}
            className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 text-sm text-ink">
            <option value="">เลือกแคมเปญ...</option>
            {scopedCampaigns.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
            ))}
          </select>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs text-ink-300 mb-1">การกระทำ</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setForm({...form, action: 'STOP'})}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors inline-flex items-center justify-center gap-1 ${
                  form.action === 'STOP' ? 'bg-danger text-white border-danger' : 'bg-surface-50 text-ink-300 border-surface-200'
                }`}><StopCircle className="w-3 h-3" /> หยุด</button>
              <button type="button" onClick={() => setForm({...form, action: 'START'})}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors inline-flex items-center justify-center gap-1 ${
                  form.action === 'START' ? 'bg-success text-white border-success' : 'bg-surface-50 text-ink-300 border-surface-200'
                }`}><Play className="w-3 h-3" /> เริ่ม</button>
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-ink-300 mb-1">ประเภท</label>
            <select value={form.scheduleType} onChange={e => setForm({...form, scheduleType: e.target.value})}
              className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 text-sm text-ink">
              <option value="ONCE">ครั้งเดียว</option>
              <option value="DAILY">รายวัน</option>
              <option value="WEEKLY">รายสัปดาห์</option>
            </select>
          </div>
        </div>

        {form.scheduleType === 'ONCE' && (
          <div>
            <label className="block text-xs text-ink-300 mb-1">เวลาดำเนินการ</label>
            <input type="datetime-local" value={form.executeAt}
              onChange={e => setForm({...form, executeAt: e.target.value})}
              className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 text-sm text-ink" />
          </div>
        )}

        {(form.scheduleType === 'DAILY' || form.scheduleType === 'WEEKLY') && (
          <div>
            <label className="block text-xs text-ink-300 mb-1">เวลาในวัน</label>
            <input type="time" value={form.timeOfDay}
              onChange={e => setForm({...form, timeOfDay: e.target.value})}
              className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 text-sm text-ink" />
          </div>
        )}

        {form.scheduleType === 'WEEKLY' && (
          <div>
            <label className="block text-xs text-ink-300 mb-1">วันในสัปดาห์</label>
            <div className="flex gap-1">
              {DAYS.map((day, i) => (
                <button key={i} type="button" onClick={() => toggleDay(i)}
                  className={`px-2 py-1.5 rounded text-[10px] font-medium transition-colors ${
                    form.daysOfWeek.includes(i)
                      ? 'bg-brand text-white'
                      : 'bg-surface-50 text-ink-300 border border-surface-200'
                  }`}>{day}</button>
              ))}
            </div>
          </div>
        )}

        <p className="text-[10px] text-ink-300">ระบบตรวจสอบทุกนาทีและดำเนินการเมื่อตรงเงื่อนไข</p>
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={submitForm} disabled={formBusy || !form.campaignId || !form.action}
          className="btn-primary btn-sm">
          {formBusy ? 'กำลังบันทึก...' : editId ? <><Save className="w-4 h-4" /> บันทึก</> : <><Calendar className="w-4 h-4" /> สร้าง</>}
        </button>
        {selectedSchedule && (
          <>
            <button onClick={() => runNow(selectedSchedule.id)} className="btn-secondary btn-sm inline-flex items-center gap-1">
              <Play className="w-4 h-4" /> รันทันที
            </button>
            <button onClick={() => setDeleteConfirm(selectedSchedule)} className="btn-danger btn-sm inline-flex items-center gap-1">
              <Trash2 className="w-4 h-4" /> ลบ
            </button>
          </>
        )}
      </div>
    </>
  );

  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-ink-300 animate-pulse">Loading schedules...</p>
      </div>
    );

  return (
    <>
    {msg && <div className="msg-success mb-4">{msg}<button className="float-right" onClick={() => setMsg('')}><X className="w-4 h-4" /></button></div>}
      {error && <div className="msg-error mb-4">{error}<button className="float-right" onClick={() => setError('')}><X className="w-4 h-4" /></button></div>}

      {isRestricted && selectedAccount && (
        <AccountRestrictionBanner account={selectedAccount} className="mx-6 mb-4" />
      )}

      <AutomationLayout
        title="ตารางเวลา"
        subtitle={
          selectedAccount
            ? `${scopedSchedules.length} รายการ · ${selectedAccount.name}`
            : `${scopedSchedules.length} รายการ`
        }
        selectedId={selectedScheduleId}
        actions={
          <button
            onClick={openCreate}
            disabled={!canCreate || scopedCampaigns.length === 0}
            className="btn-primary btn-sm inline-flex items-center gap-1 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> สร้างใหม่
          </button>
        }
        list={
          scopedSchedules.length === 0 ? (
            <p className="text-sm text-ink-300 text-center py-8">ยังไม่มีตารางเวลาในบัญชีนี้</p>
          ) : (
            <div className="space-y-1">
              {scopedSchedules.map(s => (
                <div
                  key={s.id}
                  className={`flex items-stretch gap-1 rounded-lg transition-colors ${
                    selectedScheduleId === s.id ? 'bg-brand-muted border border-brand-border' : 'hover:bg-surface-100'
                  } ${!s.enabled ? 'opacity-60' : ''}`}
                >
                  <button type="button" onClick={() => selectSchedule(s)} className="flex-1 text-left p-3 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`badge-ink text-[10px] ${ACTION_BADGE[s.action] || 'badge-ink'}`}>{s.action}</span>
                      <p className="text-sm font-medium text-ink truncate">{s.campaignName}</p>
                    </div>
                    <p className="text-[10px] text-ink-300 mt-0.5">{TYPE_LABELS[s.scheduleType] || s.scheduleType}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSchedule(s.id)}
                    className={`shrink-0 self-center mx-2 btn-xs rounded border ${s.enabled ? 'bg-warning-muted text-warning border-warning-border' : 'bg-success-muted text-success border-success-border'}`}
                  >
                    {s.enabled ? 'ปิด' : 'เปิด'}
                  </button>
                </div>
              ))}
            </div>
          )
        }
        detail={
          selectedScheduleId ? (
            <>
              <button
                type="button"
                onClick={() => setSelectedScheduleId(null)}
                className="lg:hidden text-sm text-brand mb-4 inline-flex items-center gap-1"
              >
                ← กลับ
              </button>
              {scheduleForm}
              {selectedSchedule && (
                <div className="mt-4 pt-4 border-t border-surface-300 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-ink-300">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {selectedSchedule.scheduleType === 'ONCE' ? fmtDate(selectedSchedule.executeAt) : fmtTime(selectedSchedule.timeOfDay)}
                    {selectedSchedule.daysOfWeek ? ` (${selectedSchedule.daysOfWeek.map(d => DAYS[d]).join(', ')})` : ''}
                  </span>
                  <span className="inline-flex items-center gap-1"><RefreshCw className="w-3 h-3" /> {selectedSchedule.runCount}x</span>
                  <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> {fmtDate(selectedSchedule.lastRunAt)}</span>
                  {selectedSchedule.lastError && (
                    <span className="text-danger inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {selectedSchedule.lastError}</span>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[320px] text-center text-ink-300">
              <Calendar className="w-10 h-10 mb-3 text-ink-200" />
              <p>เลือกรายการจากด้านซ้าย</p>
              <button onClick={openCreate} className="btn-primary btn-sm mt-4 inline-flex items-center gap-1">
                <Plus className="w-4 h-4" /> สร้างใหม่
              </button>
            </div>
          )
        }
      />

      <ConfirmModal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={deleteSchedule}
        title="ลบตารางเวลา"
        message={deleteConfirm ? `ลบตารางเวลาของ "${deleteConfirm.campaignName}"?` : ''}
        confirmLabel="ลบ"
        danger
      />
    </>
    );
}