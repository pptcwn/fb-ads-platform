'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { templatesApi, type CampaignTemplate } from '@/lib/api-client';
import { Package, Pencil, Trash2, Sparkles } from 'lucide-react';
import { ConfirmModal } from '@/components/Modal';
import { objLabel, fmtCurr } from '@/lib/utils';

type Template = CampaignTemplate & {
  notes: string | null;
  dailyBudget: number | null;
  useCount: number;
};

export default function TemplatesTab() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteTpl, setDeleteTpl] = useState<Template | null>(null);

  useEffect(() => {
    templatesApi
      .list()
      .then(({ data }) => setTemplates(data as Template[]))
      .catch((err: { response?: { data?: { message?: string } } }) =>
        setError(err?.response?.data?.message || 'โหลดเทมเพลตไม่สำเร็จ'),
      )
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async () => {
    if (!deleteTpl) return;
    try {
      await templatesApi.remove(deleteTpl.id);
      setTemplates((t) => t.filter((x) => x.id !== deleteTpl.id));
      setDeleteTpl(null);
    } catch {
      setError('ลบเทมเพลตไม่สำเร็จ');
    }
  };

  if (loading) {
    return <p className="text-ink-300 animate-pulse py-12 text-center">กำลังโหลดเทมเพลต…</p>;
  }

  if (error) {
    return <div className="msg-error">{error}</div>;
  }

  if (templates.length === 0) {
    return (
      <div className="card p-12 text-center">
        <Package className="w-8 h-8 mx-auto mb-3 text-ink-200" />
        <p className="text-lg font-medium text-ink">ยังไม่มีเทมเพลต</p>
        <p className="text-sm text-ink-300 mt-1">บันทึกเทมเพลตจากแคมเปญที่มีอยู่ หรือสร้างจากหน้าแคมเปญ</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {templates.map((t) => (
          <div key={t.id} className="card p-4 flex flex-col gap-3">
            <div>
              <h3 className="font-semibold text-ink">{t.name}</h3>
              <p className="text-xs text-ink-200 mt-1">{objLabel(t.objective)} · {t.dailyBudget ? fmtCurr(Number(t.dailyBudget), 'THB') : '—'}</p>
              {t.notes && <p className="text-xs text-ink-300 mt-2 line-clamp-2">{t.notes}</p>}
            </div>
            <div className="flex gap-2 mt-auto flex-wrap">
              <Link href={`/dashboard/campaigns/create?template=${t.id}`} className="btn-primary btn-sm flex-1 justify-center">
                <Sparkles className="w-3.5 h-3.5" /> นำไปใช้
              </Link>
              <button type="button" className="btn-ghost btn-sm" aria-label="แก้ไข">
                <Pencil className="w-4 h-4" />
              </button>
              <button type="button" className="btn-ghost btn-sm text-danger" onClick={() => setDeleteTpl(t)} aria-label="ลบ">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <ConfirmModal
        open={!!deleteTpl}
        onClose={() => setDeleteTpl(null)}
        title="ลบเทมเพลต"
        message={`ลบ "${deleteTpl?.name}" ใช่หรือไม่?`}
        confirmLabel="ลบ"
        confirmVariant="danger"
        onConfirm={handleDelete}
        danger
      />
    </>
  );
}