'use client';

import { useState, useRef, useMemo, useEffect, type ReactNode } from 'react';
import { Target, Users, Save, Plus, RefreshCw, Trash2, Folder, BarChart3, Upload, X, FileText, Check, AlertTriangle, Ban } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import Modal, { ConfirmModal } from '@/components/Modal';
import { useAudiences, useCreateCustomAudience, useCreateLookalikeAudience, useDeleteAudience, useSyncAudiences, useUploadAudienceCsv } from '@/hooks/use-audiences';
import { useSelectedAdAccount, filterBySelectedAccount } from '@/hooks/use-selected-ad-account';
import AccountRestrictionBanner from '@/components/layout/AccountRestrictionBanner';
import type { Audience } from '@/lib/api-client';

const fmtNum = (n: number | null) => n ? (n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString()) : '-';

const TYPE_ICONS: Record<string, ReactNode> = { CUSTOM: <Target className="w-4 h-4" />, LOOKALIKE: <Users className="w-4 h-4" />, SAVED: <Save className="w-4 h-4" /> };
const TYPE_LABELS: Record<string, string> = { CUSTOM: 'Custom', LOOKALIKE: 'Lookalike', SAVED: 'Saved Audience' };
const TYPE_LABELS_TH: Record<string, string> = { CUSTOM: 'กำหนดเอง', LOOKALIKE: 'Lookalike', SAVED: 'บันทึกไว้' };
const STATUS_COLORS: Record<string, string> = {
  READY: 'badge-success',
  IS_EXCLUDED: 'badge-danger',
  IS_HOUSEHOLD: 'bg-accent-muted text-accent border border-accent-border',
  IS_LOOKALIKE: 'bg-purple-50 text-purple-700 border border-purple-200',
};

const RATIO_OPTIONS = [1, 2, 3, 5, 10];

export default function AudiencesPage() {
  // ─── React Query ───
  const { data: audiences = [], isLoading, refetch } = useAudiences();
  const { selectedAccountId, selectedAccount, canCreate, isRestricted } = useSelectedAdAccount();
  const createCustom = useCreateCustomAudience();
  const createLookalike = useCreateLookalikeAudience();
  const deleteAudienceMutation = useDeleteAudience();
  const syncAudiencesMutation = useSyncAudiences();
  const uploadMutation = useUploadAudienceCsv();

  // ─── UI state ───
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [showLookalikeModal, setShowLookalikeModal] = useState(false);
  const [customForm, setCustomForm] = useState({ adAccountId: '', name: '', description: '' });
  const [lookalikeForm, setLookalikeForm] = useState({ adAccountId: '', name: '', sourceAudienceId: '', ratio: 1 });
  const [deleteConfirm, setDeleteConfirm] = useState<Audience | null>(null);

  // Upload state
  const [uploadTarget, setUploadTarget] = useState<Audience | null>(null);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [uploadError, setUploadError] = useState('');
  const [csvPreview, setCsvPreview] = useState<any[] | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [schemaMapping, setSchemaMapping] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [pdpaConsent, setPdpaConsent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scopedAudiences = useMemo(
    () => filterBySelectedAccount(audiences, selectedAccountId),
    [audiences, selectedAccountId],
  );

  useEffect(() => {
    if (!selectedAccountId) return;
    setCustomForm((f) => (f.adAccountId === selectedAccountId ? f : { ...f, adAccountId: selectedAccountId }));
    setLookalikeForm((f) => (f.adAccountId === selectedAccountId ? f : { ...f, adAccountId: selectedAccountId }));
  }, [selectedAccountId]);

  useEffect(() => {
    if (selectedId && !scopedAudiences.some((a) => a.id === selectedId)) {
      setSelectedId(null);
    }
  }, [scopedAudiences, selectedId]);

  const selectedAudience = selectedId ? scopedAudiences.find((a) => a.id === selectedId) : null;
  const showDetailMobile = selectedId != null;

  // ─── Mutations ───

  const handleSync = async (accountId: string) => {
    setMsg(''); setError('');
    try {
      const data = await syncAudiencesMutation.mutateAsync(accountId);
      setMsg(data.message);
    } catch (err: any) { setError(err?.response?.data?.message || err.message); }
  };

  const handleCreateCustom = async () => {
    if (!customForm.name || !customForm.adAccountId) return;
    setError(''); setMsg('');
    try {
      const data = await createCustom.mutateAsync(customForm);
      setMsg(data.message);
      setShowCustomModal(false);
      setCustomForm({ adAccountId: '', name: '', description: '' });
    } catch (err: any) { setError(err?.response?.data?.message || err.message); }
  };

  const handleCreateLookalike = async () => {
    if (!lookalikeForm.name || !lookalikeForm.sourceAudienceId || !lookalikeForm.adAccountId) return;
    setError(''); setMsg('');
    try {
      const data = await createLookalike.mutateAsync(lookalikeForm);
      setMsg(data.message);
      setShowLookalikeModal(false);
      setLookalikeForm({ adAccountId: '', name: '', sourceAudienceId: '', ratio: 1 });
    } catch (err: any) { setError(err?.response?.data?.message || err.message); }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const data = await deleteAudienceMutation.mutateAsync(deleteConfirm.id);
      setMsg(data.message);
      if (deleteConfirm.id === selectedId) setSelectedId(null);
      setDeleteConfirm(null);
    } catch (err: any) { setError(err?.response?.data?.message || err.message); }
  };

  // ─── CSV Upload ───

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTarget) return;
    setUploading(true); setUploadError(''); setUploadResult(null);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim().length > 0);
      if (lines.length < 2) { setUploadError('CSV needs header + data rows'); setUploading(false); return; }
      const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
      const preview = lines.slice(1, 6).map(line => {
        const vals: string[] = [];
        let inQuote = false, cur = '';
        for (const ch of line) {
          if (ch === '"') { inQuote = !inQuote; continue; }
          if (ch === ',' && !inQuote) { vals.push(cur.trim()); cur = ''; continue; }
          cur += ch;
        }
        vals.push(cur.trim());
        return vals;
      });
      setCsvHeaders(headers);
      setCsvPreview(preview);
      const AUTO_MAP: Record<string, string> = {
        email: 'EMAIL', 'e-mail': 'EMAIL', mail: 'EMAIL',
        phone: 'PHONE', mobile: 'PHONE', tel: 'PHONE',
        madid: 'MADID', device_id: 'MADID', adid: 'MADID',
        extern_id: 'EXTERN_ID', external_id: 'EXTERN_ID', user_id: 'EXTERN_ID', uid: 'EXTERN_ID', customer_id: 'EXTERN_ID',
        first_name: 'FIRST_NAME', firstname: 'FIRST_NAME', fname: 'FIRST_NAME',
        last_name: 'LAST_NAME', lastname: 'LAST_NAME', lname: 'LAST_NAME',
        zip: 'ZIP', zipcode: 'ZIP', postcode: 'ZIP',
        country: 'COUNTRY',
        city: 'CITY', town: 'CITY',
      };
      const mapping: Record<string, string> = {};
      for (const h of headers) {
        const key = h.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const [pat, schema] of Object.entries(AUTO_MAP)) {
          if (key.includes(pat)) { mapping[h] = schema; break; }
        }
      }
      setSchemaMapping(mapping);
    } catch (err: any) { setUploadError(err.message); }
    finally { setUploading(false); }
  };

  const submitUpload = async () => {
    if (!uploadTarget) return;
    if (!pdpaConsent) {
      setUploadError('Please confirm PDPA consent before uploading.');
      return;
    }
    setUploading(true); setUploadError(''); setUploadResult(null);
    try {
      const file = fileInputRef.current?.files?.[0];
      if (!file) { setUploadError('Please select a file'); setUploading(false); return; }
      const formData = new FormData();
      formData.append('file', file);
      formData.append('schema', JSON.stringify(schemaMapping));
      formData.append('consentConfirmed', 'true');
      const data = await uploadMutation.mutateAsync({ id: uploadTarget.id, formData });
      setUploadResult(data);
    } catch (err: any) { setUploadError(err?.response?.data?.message || err.message); }
    finally { setUploading(false); }
  };

  const closeUploadModal = () => {
    setUploadTarget(null);
    setUploadResult(null);
    setUploadError('');
    setCsvPreview(null);
    setCsvHeaders([]);
    setSchemaMapping({});
    setPdpaConsent(false);
  };

  // ─── Derived ───
  const sourceAudiences = scopedAudiences.filter(
    (a) => a.type === 'CUSTOM' && a.status === 'READY',
  );

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-ink-300 animate-pulse">กำลังโหลดกลุ่มเป้าหมาย...</p>
      </div>
    );

  return (
    <>
        <PageLayout
          title="กลุ่มเป้าหมาย"
          subtitle={
            selectedAccount
              ? `${scopedAudiences.length} กลุ่ม · ${selectedAccount.name}`
              : `${scopedAudiences.length} กลุ่ม`
          }
          actions={
            <>
              <button
                onClick={() => setShowCustomModal(true)}
                disabled={!canCreate}
                title={!canCreate ? selectedAccount?.restrictionMessage ?? undefined : undefined}
                className="btn-primary btn-sm inline-flex items-center gap-1 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" /> Custom
              </button>
              <button
                onClick={() => setShowLookalikeModal(true)}
                disabled={!canCreate}
                title={!canCreate ? selectedAccount?.restrictionMessage ?? undefined : undefined}
                className="btn bg-purple-600 text-white hover:bg-purple-700 btn-sm rounded-lg inline-flex items-center gap-1 disabled:opacity-50"
              >
                <Users className="w-4 h-4" /> Lookalike
              </button>
              <button onClick={() => refetch()} disabled={isLoading} className="btn-secondary btn-sm inline-flex items-center gap-1"><RefreshCw className="w-4 h-4" /> รีเฟรช</button>
            </>
          }
        >
          {msg && <div className="msg-success">{msg}<button className="float-right" onClick={() => setMsg('')}><X className="w-4 h-4" /></button></div>}
          {error && <div className="msg-error">{error}<button className="float-right" onClick={() => setError('')}><X className="w-4 h-4" /></button></div>}

          {isRestricted && selectedAccount && (
            <AccountRestrictionBanner account={selectedAccount} />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 min-h-[480px]">
            {/* Left: list */}
            <div
              className={`card p-3 overflow-y-auto max-h-[70vh] lg:max-h-none ${
                showDetailMobile ? 'hidden lg:block' : 'block'
              }`}
            >
              {scopedAudiences.length === 0 ? (
                <div className="text-center py-8">
                  <Target className="w-10 h-10 mx-auto mb-2 text-ink-200" />
                  <p className="text-sm font-medium text-ink">ยังไม่มีกลุ่มเป้าหมาย</p>
                  <p className="text-xs text-ink-300 mt-1">ซิงค์บัญชีหรือสร้างกลุ่มใหม่</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {scopedAudiences.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setSelectedId(a.id)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedId === a.id ? 'bg-accent-muted border border-accent-border' : 'hover:bg-surface-100 border border-transparent'
                      }`}
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <span className="shrink-0 text-ink-300">{TYPE_ICONS[a.type] || <Target className="w-4 h-4" />}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-ink truncate">{a.name}</p>
                          <p className="text-[10px] text-ink-300 truncate">{a.accountName}</p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="badge-ink text-[10px]">{TYPE_LABELS_TH[a.type] || a.type}</span>
                            <span className="text-xs font-semibold text-accent">{fmtNum(a.approximateCount)}</span>
                            <span className={`badge-ink text-[10px] ${STATUS_COLORS[a.status] || 'badge-ink'}`}>{a.status}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right: detail */}
            <div
              className={`card p-5 overflow-y-auto ${
                showDetailMobile ? 'block' : 'hidden lg:block'
              }`}
            >
              {selectedAudience ? (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="lg:hidden text-sm text-accent mb-4 inline-flex items-center gap-1"
                  >
                    ← กลับ
                  </button>

                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-ink-300">{TYPE_ICONS[selectedAudience.type]}</span>
                        <h2 className="text-lg font-semibold text-ink truncate">{selectedAudience.name}</h2>
                      </div>
                      <p className="text-xs text-ink-300">
                        {TYPE_LABELS[selectedAudience.type] || selectedAudience.type} · {selectedAudience.accountName}
                      </p>
                    </div>
                    <span className={`badge-ink text-[10px] shrink-0 ${STATUS_COLORS[selectedAudience.status] || 'badge-ink'}`}>
                      {selectedAudience.status}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-3xl font-bold text-accent">{fmtNum(selectedAudience.approximateCount)}</span>
                    <span className="text-sm text-ink-300">คน</span>
                  </div>

                  {selectedAudience.description && (
                    <p className="text-sm text-ink-200 mb-4">{selectedAudience.description}</p>
                  )}

                  <div className="flex flex-wrap gap-2 text-xs text-ink-300 mb-6">
                    {selectedAudience.subtype && (
                      <span className="bg-surface-50 px-2 py-1 rounded inline-flex items-center gap-1">
                        <Folder className="w-3 h-3" /> {selectedAudience.subtype}
                      </span>
                    )}
                    {selectedAudience.type === 'LOOKALIKE' && selectedAudience.lookalikeRatio && (
                      <span className="bg-surface-50 px-2 py-1 rounded inline-flex items-center gap-1">
                        <BarChart3 className="w-3 h-3" /> {selectedAudience.lookalikeRatio}% ratio
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-4 border-t border-surface-300">
                    <button
                      onClick={() => handleSync(selectedAudience.adAccountId)}
                      disabled={syncAudiencesMutation.isPending}
                      className="btn-secondary btn-sm inline-flex items-center gap-1"
                    >
                      <RefreshCw className="w-4 h-4" />
                      {syncAudiencesMutation.isPending ? 'กำลังซิงค์...' : 'ซิงค์บัญชี'}
                    </button>
                    {selectedAudience.type === 'CUSTOM' && selectedAudience.status === 'READY' && (
                      <button
                        onClick={() => setUploadTarget(selectedAudience)}
                        className="btn-secondary btn-sm inline-flex items-center gap-1"
                      >
                        <Upload className="w-4 h-4" /> อัปโหลด CSV
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteConfirm(selectedAudience)}
                      className="btn-danger btn-sm inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-4 h-4" /> ลบ
                    </button>
                  </div>


                </>
              ) : (
                <div className="flex flex-col items-center justify-center min-h-[320px] text-center text-ink-300">
                  <Users className="w-10 h-10 mb-3 text-ink-200" />
                  <p>เลือกกลุ่มเป้าหมายจากรายการด้านซ้าย</p>
                  <p className="text-xs mt-1">หรือสร้าง Custom / Lookalike ใหม่</p>
                </div>
              )}
            </div>
          </div>
        </PageLayout>

      {/* ─── Create Custom ─── */}
      <Modal open={showCustomModal} onClose={() => setShowCustomModal(false)} title="Create Custom Audience" icon={<Target className="w-4 h-4" />}>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-ink-300 mb-1">Ad Account</label>
            <p className="w-full bg-surface-100 border border-surface-200 rounded-lg px-3 py-2 text-sm text-ink">
              {selectedAccount?.name ?? '—'}
            </p>
          </div>
          <div>
            <label className="block text-xs text-ink-300 mb-1">Audience Name</label>
            <input type="text" value={customForm.name} onChange={e => setCustomForm({...customForm, name: e.target.value})}
              className="w-full bg-surface-50 px-3 py-2 text-sm text-ink" />
          </div>
          <div>
            <label className="block text-xs text-ink-300 mb-1">Description (optional)</label>
            <textarea value={customForm.description} onChange={e => setCustomForm({...customForm, description: e.target.value})}
              className="w-full bg-surface-50 px-3 py-2 text-sm text-ink" rows={2} />
          </div>
          <p className="text-xs text-ink-300">This creates an empty custom audience on Facebook. You can add users via CSV or Pixel later.</p>
        </div>
        <div className="flex justify-end gap-2 mt-4 pt-4 -mx-5 px-5 border-t border-surface-300">
          <button onClick={() => setShowCustomModal(false)} className="btn-secondary btn-sm">Cancel</button>
          <button onClick={handleCreateCustom} disabled={createCustom.isPending || !customForm.adAccountId || !customForm.name}
            className="btn-primary btn-sm">
            {createCustom.isPending ? 'Creating...' : 'Create'}
          </button>
        </div>
      </Modal>

      {/* ─── Create Lookalike ─── */}
      <Modal open={showLookalikeModal} onClose={() => setShowLookalikeModal(false)} title="Create Lookalike Audience" icon={<Users className="w-4 h-4" />}>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-ink-300 mb-1">Ad Account</label>
            <p className="w-full bg-surface-100 border border-surface-200 rounded-lg px-3 py-2 text-sm text-ink">
              {selectedAccount?.name ?? '—'}
            </p>
          </div>
          <div>
            <label className="block text-xs text-ink-300 mb-1">Source Audience</label>
            <select value={lookalikeForm.sourceAudienceId} onChange={e => setLookalikeForm({...lookalikeForm, sourceAudienceId: e.target.value})}
              className="w-full bg-surface-50 px-3 py-2 text-sm text-ink">
              <option value="">Select source...</option>
              {sourceAudiences.map(a => <option key={a.fbAudienceId} value={a.fbAudienceId}>{a.name} ({fmtNum(a.approximateCount)})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-ink-300 mb-1">Lookalike Name</label>
            <input type="text" value={lookalikeForm.name} onChange={e => setLookalikeForm({...lookalikeForm, name: e.target.value})}
              className="w-full bg-surface-50 px-3 py-2 text-sm text-ink" />
          </div>
          <div>
            <label className="block text-xs text-ink-300 mb-1">Audience Size (ratio)</label>
            <div className="flex gap-2">
              {RATIO_OPTIONS.map(r => (
                <button key={r} onClick={() => setLookalikeForm({...lookalikeForm, ratio: r})}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    lookalikeForm.ratio === r ? 'bg-purple-600 text-white' : 'bg-surface-50 text-ink-300 border border-surface-200 hover:border-surface-300'
                  }`}>
                  {r}%
                </button>
              ))}
            </div>
            <p className="text-[10px] text-ink-300 mt-1">Higher % = larger audience but less similarity to source</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4 pt-4 -mx-5 px-5 border-t border-surface-300">
          <button onClick={() => setShowLookalikeModal(false)} className="btn-secondary btn-sm">Cancel</button>
          <button onClick={handleCreateLookalike} disabled={createLookalike.isPending || !lookalikeForm.adAccountId || !lookalikeForm.name || !lookalikeForm.sourceAudienceId}
            className="btn bg-purple-600 text-white hover:bg-purple-700 btn-sm rounded-lg disabled:opacity-50">
            {createLookalike.isPending ? 'Creating...' : <><Users className="w-4 h-4" /> Create Lookalike</>}
          </button>
        </div>
      </Modal>

      {/* ─── Delete Confirmation ─── */}
      <ConfirmModal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Audience"
        message={deleteConfirm ? `Are you sure you want to delete ${deleteConfirm.name}?` : ''}
        confirmLabel="Delete"
        danger
        busy={deleteAudienceMutation.isPending}
        icon={<Trash2 className="w-4 h-4" />}
      />

      {/* ─── Upload CSV Modal ─── */}
      <Modal open={!!uploadTarget} onClose={closeUploadModal} title="Upload Users to Audience" icon={<Upload className="w-4 h-4" />} maxWidth="max-w-lg">
        <div className="space-y-3">
          <p className="text-sm text-ink font-medium">{uploadTarget?.name}</p>
          <p className="text-xs text-ink-300">Upload a CSV with customer data. PII is SHA-256 hashed server-side before sending to Meta (PDPA). Supported columns: email, phone, MADID, extern_id, name, zip, country.</p>

          {!csvPreview && (
            <div className="border-2 border-dashed border-surface-200 rounded-lg p-6 text-center">
              <input ref={fileInputRef} id="csv-file-input" type="file" accept=".csv" onChange={handleFileSelect}
                className="hidden" />
              <label htmlFor="csv-file-input" className="cursor-pointer flex flex-col items-center gap-2">
                <span className="text-3xl"><FileText className="w-8 h-8" /></span>
                <span className="text-sm text-ink-300 hover:text-ink">Click to select CSV file</span>
                <span className="text-[10px] text-ink-400">First row must be column headers</span>
              </label>
            </div>
          )}

          {uploading && !csvPreview && <p className="text-xs text-ink-300 text-center animate-pulse">Reading file...</p>}

          {csvPreview && csvPreview.length > 0 && (
            <div>
              <p className="text-xs text-ink-300 mb-1">Preview ({csvHeaders.length} columns, showing first rows)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] border-collapse">
                  <thead>
                    <tr className="text-ink-300">
                      {csvHeaders.map((h, i) => (
                        <th key={i} className="border border-surface-200/50 px-2 py-1 text-left bg-surface-50">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.map((row, ri) => (
                      <tr key={ri} className="text-ink">
                        {row.map((val: string, ci: number) => (
                          <td key={ci} className="border border-surface-200/50 px-2 py-1 truncate max-w-[120px]">{val}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {csvHeaders.length > 0 && (
            <div>
              <p className="text-xs text-ink-300 mb-1">Column Mapping (Facebook Schema)</p>
              <div className="space-y-1.5">
                {csvHeaders.map((h, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-ink-300 w-24 truncate shrink-0">{h}</span>
                    <span className="text-ink-400">→</span>
                    <select value={schemaMapping[h] || ''}
                      onChange={e => setSchemaMapping({...schemaMapping, [h]: e.target.value})}
                      className="flex-1 bg-surface-50 border border-surface-200 rounded px-2 py-1 text-ink text-xs">
                      <option value="">-- Skip --</option>
                      <option value="EMAIL">EMAIL</option>
                      <option value="PHONE">PHONE</option>
                      <option value="MADID">MADID (Device ID)</option>
                      <option value="EXTERN_ID">EXTERN_ID</option>
                      <option value="WHATSAPP">WHATSAPP</option>
                      <option value="GEN">GEN (Gender)</option>
                      <option value="DOBY">DOBY (Birth Year)</option>
                      <option value="DOBM">DOBM (Birth Month)</option>
                      <option value="DOBD">DOBD (Birth Day)</option>
                      <option value="FIRST_NAME">FIRST_NAME</option>
                      <option value="LAST_NAME">LAST_NAME</option>
                      <option value="ZIP">ZIP</option>
                      <option value="COUNTRY">COUNTRY</option>
                      <option value="CITY">CITY</option>
                      <option value="CT_VALUE">CT_VALUE</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {uploadResult && (
            <div className="msg-success space-y-1">
              <p className="inline-flex items-center gap-1"><Check className="w-4 h-4" /> {uploadResult.message}</p>
              <p className="inline-flex items-center gap-1"><BarChart3 className="w-4 h-4" /> Total: {uploadResult.totalRows} rows</p>
              {uploadResult.invalid > 0 && <p className="inline-flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> Invalid: {uploadResult.invalid}</p>}
              {uploadResult.rejected > 0 && <p className="inline-flex items-center gap-1"><Ban className="w-4 h-4" /> Rejected: {uploadResult.rejected}</p>}
            </div>
          )}

          {csvPreview && !uploadResult && (
            <label className="flex items-start gap-2 text-xs text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={pdpaConsent}
                onChange={(e) => setPdpaConsent(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                I confirm I have lawful basis and customer consent to upload this data for advertising purposes (PDPA).
              </span>
            </label>
          )}

          {uploadError && (
            <div className="msg-error">{uploadError}</div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-4 pt-4 -mx-5 px-5 border-t border-surface-300">
          <button onClick={closeUploadModal} className="btn-secondary btn-sm">
            {uploadResult ? 'Close' : 'Cancel'}
          </button>
          {csvPreview && !uploadResult && (
            <button onClick={submitUpload} disabled={uploading || !pdpaConsent || Object.values(schemaMapping).filter(Boolean).length === 0}
              className="btn-primary btn-sm">
              {uploading ? 'Uploading...' : <><Upload className="w-4 h-4" /> Upload to Facebook</>}
            </button>
          )}
        </div>
      </Modal>
    </>
    );
}