'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { BarChart3, ChevronLeft, ChevronRight, ImagePlus, Rocket, X } from 'lucide-react';
import Shell from '@/components/Shell';
import PageLayout from '@/components/layout/PageLayout';
import Stepper from '@/components/ui/Stepper';
import TargetingPanel from '@/components/TargetingPanel';
import { useAdAccounts } from '@/hooks/use-accounts';
import { useAccountContext } from '@/contexts/account-context';
import { useCreateCampaign } from '@/hooks/use-campaigns';
import { campaignsApi, templatesApi } from '@/lib/api-client';
import api from '@/lib/api';
import {
  CREATE_STEPS,
  OBJECTIVES,
  initialCampaignForm,
  estimateBudgetBreakdown,
  type CampaignFormState,
} from '@/lib/campaign-create-shared';
import { objLabel } from '@/lib/utils';

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

export default function CreateCampaignPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: adAccounts = [] } = useAdAccounts();
  const { selectedAccountId } = useAccountContext();
  const createMutation = useCreateCampaign();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<CampaignFormState>(initialCampaignForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const [errMsg, setErrMsg] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [fbPages, setFbPages] = useState<{ pageId: string; name: string }[]>([]);
  const adImageRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id =
      selectedAccountId !== 'all' && selectedAccountId
        ? selectedAccountId
        : adAccounts[0]?.id;
    if (id && !form.adAccountId) setForm((f) => ({ ...f, adAccountId: id }));
  }, [adAccounts, selectedAccountId, form.adAccountId]);

  useEffect(() => {
    api.get<{ pageId: string; name: string }[]>('/api/creatives/pages').then(({ data }) => setFbPages(data)).catch(() => setFbPages([]));
  }, []);

  useEffect(() => {
    const templateId = searchParams.get('template');
    if (!templateId) return;
    templatesApi.get(templateId).then(({ data: t }) => {
      const creative = (t.creativeConfig || {}) as Record<string, string>;
      setForm((f) => ({
        ...f,
        name: t.name.replace(/\s*Template\s*$/i, '').trim() || f.name,
        objective: t.objective || f.objective,
        dailyBudget: t.dailyBudget != null ? Number(t.dailyBudget) : f.dailyBudget,
        adSetName: t.adSetName || '',
        optimizationGoal: t.optimizationGoal || f.optimizationGoal,
        billingEvent: t.billingEvent || f.billingEvent,
        targeting: (t.targetSpec as Record<string, unknown>) || f.targeting,
        createAd: !!t.adName,
        adName: t.adName || '',
        creativeMessage: creative.message || '',
        creativeLink: creative.link || '',
      }));
    }).catch(() => setErrMsg('โหลดเทมเพลตไม่สำเร็จ'));
  }, [searchParams]);

  const budgetPreview = useMemo(() => estimateBudgetBreakdown(form.dailyBudget), [form.dailyBudget]);

  const validateStep = useCallback((s: number) => {
    const e: Record<string, string> = {};
    if (s === 1) {
      if (!form.name.trim()) e.name = 'กรุณาระบุชื่อแคมเปญ';
      if (!form.adAccountId) e.adAccountId = 'เลือกบัญชีโฆษณา';
    }
    if (s === 2) {
      if (!form.dailyBudget || form.dailyBudget < 50) e.dailyBudget = 'งบรายวันขั้นต่ำ 50 บาท';
    }
    if (s === 4 && form.createAd && !form.adName.trim()) e.adName = 'กรุณาระบุชื่อโฆษณา';
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [form]);

  const uploadAdImage = async (file: File) => {
    if (!form.adAccountId) {
      setErrMsg('เลือกบัญชีโฆษณาก่อนอัปโหลดรูป');
      return;
    }
    setImageUploading(true);
    setErrMsg('');
    try {
      setImagePreview(URL.createObjectURL(file));
      const { data } = await campaignsApi.uploadAdImage(form.adAccountId, file);
      setForm((f) => ({ ...f, creativeImageHash: data.imageHash }));
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } }; message?: string };
      setImagePreview(null);
      setErrMsg(ax?.response?.data?.message || ax?.message || 'อัปโหลดรูปไม่สำเร็จ');
    } finally {
      setImageUploading(false);
      if (adImageRef.current) adImageRef.current.value = '';
    }
  };

  const submit = async () => {
    for (let s = 1; s <= 4; s++) {
      if (!validateStep(s)) {
        setStep(s);
        return;
      }
    }
    setErrMsg('');
    setMsg('');
    try {
      const dto: Record<string, unknown> = {
        adAccountId: form.adAccountId,
        name: form.name,
        objective: form.objective,
        dailyBudget: form.dailyBudget,
        status: form.status,
      };
      dto.adSetName = form.adSetName || 'Ad Set 1';
      dto.optimizationGoal = form.optimizationGoal;
      dto.billingEvent = form.billingEvent;
      dto.targeting =
        Object.keys(form.targeting || {}).length > 0
          ? form.targeting
          : { geo_locations: { countries: ['TH'] } };
      if (form.createAd && form.adName) {
        dto.adName = form.adName;
        dto.creativeMessage = form.creativeMessage || 'ดูรายละเอียด';
        dto.creativeLink = form.creativeLink || 'https://example.com';
        if (form.creativeImageHash) dto.creativeImageHash = form.creativeImageHash;
        if (form.pageId) dto.pageId = form.pageId;
      }
      await createMutation.mutateAsync(dto);
      setMsg('สร้างแคมเปญสำเร็จ');
      setTimeout(() => router.push('/dashboard/campaigns'), 1200);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } }; message?: string };
      setErrMsg(ax?.response?.data?.message || ax?.message || 'สร้างแคมเปญไม่สำเร็จ');
    }
  };

  const accountName = adAccounts.find((a) => a.id === form.adAccountId)?.name;

  return (
    <Shell>
      <PageLayout
        title="สร้างแคมเปญ"
        subtitle={accountName ? `บัญชี: ${accountName}` : undefined}
        breadcrumbs={[
          { label: 'โฆษณา', href: '/dashboard/campaigns' },
          { label: 'แคมเปญ', href: '/dashboard/campaigns' },
          { label: 'สร้างใหม่' },
        ]}
        actions={
          <Link href="/dashboard/campaigns" className="btn-ghost btn-sm">
            <X className="w-4 h-4" /> ยกเลิก
          </Link>
        }
      >
        <Stepper steps={[...CREATE_STEPS]} currentStep={step} className="mb-8" />

        {errMsg && <div className="msg-error mb-4">{errMsg}</div>}
        {msg && <div className="msg-success mb-4">{msg}</div>}

        <div className="card p-5 sm:p-6 mb-24 sm:mb-8 max-w-3xl">
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-ink">① ตั้งค่าแคมเปญ</h2>
              <div>
                <label className="block text-sm font-medium text-ink mb-1">บัญชีโฆษณา (Ad Account)</label>
                <select
                  value={form.adAccountId}
                  onChange={(e) => setForm({ ...form, adAccountId: e.target.value })}
                  className="w-full"
                >
                  <option value="">เลือกบัญชี…</option>
                  {adAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                {errors.adAccountId && <p className="text-danger text-xs mt-1">{errors.adAccountId}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1">ชื่อแคมเปญ</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="เช่น โปรโมชัน มิ.ย. 2026"
                />
                {errors.name && <p className="text-danger text-xs mt-1">{errors.name}</p>}
              </div>
              <div>
                <p className="text-sm font-medium text-ink mb-2">วัตถุประสงค์ (Objective)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {OBJECTIVES.map((obj) => (
                    <button
                      key={obj.key}
                      type="button"
                      onClick={() => setForm({ ...form, objective: obj.key })}
                      className={`text-left p-3 rounded-xl border-2 transition-all ${
                        form.objective === obj.key ? 'border-accent bg-accent-muted' : 'border-surface-300'
                      }`}
                    >
                      <p className="font-semibold text-sm text-ink">{obj.label}</p>
                      <p className="text-xs text-ink-200 mt-0.5">{obj.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-ink">② งบประมาณ</h2>
              <p className="text-xs text-ink-200">ไม่มีการตั้งกลุ่มเป้าหมายในขั้นนี้ — ไปขั้นถัดไป</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">งบรายวัน (THB)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-200 text-sm">฿</span>
                    <input
                      type="number"
                      className="w-full pl-7"
                      min={50}
                      value={form.dailyBudget}
                      onChange={(e) => setForm({ ...form, dailyBudget: parseInt(e.target.value, 10) || 0 })}
                    />
                  </div>
                  {errors.dailyBudget && <p className="text-danger text-xs mt-1">{errors.dailyBudget}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">สถานะเริ่มต้น</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="PAUSED">หยุดชั่วคราว (แนะนำ)</option>
                    <option value="ACTIVE">เปิดใช้งานทันที</option>
                  </select>
                </div>
              </div>
              <div className="rounded-lg p-4 border border-budget-preview-border bg-budget-preview-muted">
                <h3 className="text-xs font-semibold text-budget-preview uppercase tracking-wide mb-2 flex items-center gap-1">
                  <BarChart3 className="w-3 h-3" /> งบประมาณโดยประมาณ (สูตรในระบบ)
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-ink-200 text-xs">ใช้จ่าย/วัน</p><p className="font-bold">฿{budgetPreview.dailySpend.toLocaleString()}</p></div>
                  <div><p className="text-ink-200 text-xs">Reach โดยประมาณ</p><p className="font-bold">{budgetPreview.estimatedDailyReach.toLocaleString()}</p></div>
                  <div><p className="text-ink-200 text-xs">CPC โดยประมาณ</p><p className="font-bold">฿{budgetPreview.estimatedCpc}</p></div>
                  <div><p className="text-ink-200 text-xs">CPM โดยประมาณ</p><p className="font-bold">฿{budgetPreview.estimatedCpm}</p></div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-ink">③ กลุ่มเป้าหมาย</h2>
              <TargetingPanel
                value={form.targeting as import('@/components/TargetingBuilder').TargetingState}
                onChange={(v) => setForm({ ...form, targeting: v as Record<string, unknown> })}
                adAccountId={form.adAccountId}
              />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-ink">④ โฆษณา (ไม่บังคับ)</h2>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.createAd} onChange={(e) => setForm({ ...form, createAd: e.target.checked })} />
                สร้างโฆษณาตอนนี้
              </label>
              {form.createAd && (
                <div className="space-y-3">
                  <input value={form.adName} onChange={(e) => setForm({ ...form, adName: e.target.value })} placeholder="ชื่อโฆษณา" />
                  {errors.adName && <p className="text-danger text-xs">{errors.adName}</p>}
                  <textarea value={form.creativeMessage} onChange={(e) => setForm({ ...form, creativeMessage: e.target.value })} placeholder="ข้อความโฆษณา" rows={2} />
                  <input value={form.creativeLink} onChange={(e) => setForm({ ...form, creativeLink: e.target.value })} placeholder="ลิงก์ปลายทาง" />
                  <input ref={adImageRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadAdImage(e.target.files[0])} />
                  <button type="button" onClick={() => adImageRef.current?.click()} className="btn-secondary btn-sm" disabled={imageUploading}>
                    <ImagePlus className="w-4 h-4" /> {imageUploading ? 'กำลังอัปโหลด…' : 'อัปโหลดรูป'}
                  </button>
                  {imagePreview && <img src={imagePreview} alt="" className="max-h-32 rounded-lg" />}
                  {fbPages.length > 0 && (
                    <select value={form.pageId} onChange={(e) => setForm({ ...form, pageId: e.target.value })}>
                      <option value="">เลือก Facebook Page</option>
                      {fbPages.map((p) => <option key={p.pageId} value={p.pageId}>{p.name}</option>)}
                    </select>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3 text-sm">
              <h2 className="text-lg font-semibold text-ink">⑤ สรุปก่อนเผยแพร่</h2>
              <dl className="grid grid-cols-1 gap-2">
                <div><dt className="text-ink-200">ชื่อ</dt><dd className="font-medium">{form.name}</dd></div>
                <div><dt className="text-ink-200">Objective</dt><dd>{objLabel(form.objective)}</dd></div>
                <div><dt className="text-ink-200">งบรายวัน</dt><dd>฿{form.dailyBudget}</dd></div>
                <div><dt className="text-ink-200">สถานะ</dt><dd>{form.status}</dd></div>
                <div><dt className="text-ink-200">โฆษณา</dt><dd>{form.createAd ? form.adName || 'มี' : 'ไม่สร้างตอนนี้'}</dd></div>
              </dl>
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 lg:left-56 z-20 flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-t border-surface-300 bg-surface-50/95 backdrop-blur-sm safe-area-pb">
          <button
            type="button"
            className="btn-secondary"
            disabled={step <= 1}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
          >
            <ChevronLeft className="w-4 h-4" /> ย้อนกลับ
          </button>
          {step < 5 ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                if (validateStep(step)) setStep((s) => s + 1);
              }}
            >
              ถัดไป <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={submit} disabled={createMutation.isPending}>
              {createMutation.isPending ? <><Spinner /> กำลังสร้าง…</> : <><Rocket className="w-4 h-4" /> เผยแพร่</>}
            </button>
          )}
        </div>
      </PageLayout>
    </Shell>
  );
}