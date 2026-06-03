'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Check, X } from 'lucide-react';
import Shell from '@/components/Shell';
import PageHeader from '@/components/PageHeader';
import api from '@/lib/api';

interface Approval {
  id: string;
  source: string;
  sourceId: string | null;
  action: string;
  payload: { dailyBudget?: number; context?: string };
  status: string;
  reason: string | null;
  createdAt: string;
}

export default function ApprovalsPage() {
  const [items, setItems] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Approval[]>('/api/approvals');
      setItems(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const approve = async (id: string) => {
    setError('');
    try {
      await api.post(`/api/approvals/${id}/approve`);
      setMsg('Approved and applied to Facebook.');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message);
    }
  };

  const reject = async (id: string) => {
    setError('');
    try {
      await api.post(`/api/approvals/${id}/reject`, { note: 'Rejected from dashboard' });
      setMsg('Request rejected.');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message);
    }
  };

  return (
    <Shell>
      <div className="p-6 space-y-6">
        <PageHeader
          title={<><ShieldCheck className="w-4 h-4 inline mr-1" aria-hidden />อนุมัติอัตโนมัติ</>}
          subtitle="การเปลี่ยนงบที่เกิน guardrail รออนุมัติก่อนส่งไป Meta"
        />

        {msg && <div className="msg-success">{msg}</div>}
        {error && <div className="msg-error">{error}</div>}

        {loading ? (
          <p className="text-ink-300 animate-pulse">กำลังโหลด…</p>
        ) : items.length === 0 ? (
          <div className="card p-8 text-center text-ink-300">ไม่มีรายการรออนุมัติ</div>
        ) : (
          <div className="space-y-3">
            {items.map((a) => (
              <div key={a.id} className="card p-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-ink">{a.action}</p>
                  <p className="text-xs text-ink-300 mt-1">
                    {a.source}{a.sourceId ? ` · ${a.sourceId}` : ''} ·{' '}
                    budget ฿{a.payload?.dailyBudget ?? '—'}
                  </p>
                  {a.reason && <p className="text-xs text-ink-200 mt-2">{a.reason}</p>}
                  <p className="text-[10px] text-ink-400 mt-1">{new Date(a.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => approve(a.id)} className="btn-primary btn-sm inline-flex items-center gap-1">
                    <Check className="w-4 h-4" aria-hidden /> อนุมัติ
                  </button>
                  <button type="button" onClick={() => reject(a.id)} className="btn-secondary btn-sm inline-flex items-center gap-1">
                    <X className="w-4 h-4" aria-hidden /> ปฏิเสธ
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}