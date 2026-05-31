'use client';

import { useEffect, useState, useRef } from 'react';
import axios from 'axios';

interface AdAccount { id: string; accountId: string; name: string; currency: string; }
interface Audience { id: string; adAccountId: string; accountName: string; fbAudienceId: string; name: string; type: string; subtype: string | null; description: string | null; approximateCount: number | null; status: string; sourceAudienceId: string | null; lookalikeRatio: number | null; createdAt: string; }

const fmtNum = (n: number | null) => n ? (n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString()) : '-';

const TYPE_ICONS: Record<string, string> = { CUSTOM: '🎯', LOOKALIKE: '👥', SAVED: '💾' };
const TYPE_LABELS: Record<string, string> = { CUSTOM: 'Custom', LOOKALIKE: 'Lookalike', SAVED: 'Saved Audience' };
const STATUS_COLORS: Record<string, string> = {
  READY: 'bg-green-900/40 text-green-400 border-green-800/50',
  IS_EXCLUDED: 'bg-red-900/40 text-red-400 border-red-800/50',
  IS_HOUSEHOLD: 'bg-blue-900/40 text-blue-400 border-blue-800/50',
  IS_LOOKALIKE: 'bg-purple-900/40 text-purple-400 border-purple-800/50',
};

const RATIO_OPTIONS = [1, 2, 3, 5, 10];

export default function AudiencesPage() {
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState<string | null>(null);

  // Create modals
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [showLookalikeModal, setShowLookalikeModal] = useState(false);
  const [formBusy, setFormBusy] = useState(false);

  // Custom form
  const [customForm, setCustomForm] = useState({ adAccountId: '', name: '', description: '' });
  // Lookalike form
  const [lookalikeForm, setLookalikeForm] = useState({ adAccountId: '', name: '', sourceAudienceId: '', ratio: 1 });

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState<Audience | null>(null);

  // Upload CSV
  const [uploadTarget, setUploadTarget] = useState<Audience | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [uploadError, setUploadError] = useState('');
  const [csvPreview, setCsvPreview] = useState<any[] | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [schemaMapping, setSchemaMapping] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/'; return; }
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [audRes, accRes] = await Promise.all([
        axios.get('/api/audiences').catch(() => ({ data: [] })),
        axios.get('/api/adaccounts').catch(() => ({ data: [] })),
      ]);
      setAudiences(audRes.data);
      setAccounts(accRes.data);
    } catch { setError('Failed to load data'); }
    finally { setLoading(false); }
  };

  const syncAudiences = async (accountId: string) => {
    setSyncing(accountId);
    setMsg(''); setError('');
    try {
      const { data } = await axios.get(`/api/audiences/sync/${accountId}`);
      setMsg(data.message);
      await fetchAll();
    } catch (err: any) { setError(err?.response?.data?.message || err.message); }
    finally { setSyncing(null); }
  };

  const createCustom = async () => {
    if (!customForm.name || !customForm.adAccountId) return;
    setFormBusy(true); setError(''); setMsg('');
    try {
      const { data } = await axios.post('/api/audiences/create-custom', customForm);
      setMsg(data.message);
      setShowCustomModal(false);
      setCustomForm({ adAccountId: '', name: '', description: '' });
      await fetchAll();
    } catch (err: any) { setError(err?.response?.data?.message || err.message); }
    finally { setFormBusy(false); }
  };

  const createLookalike = async () => {
    if (!lookalikeForm.name || !lookalikeForm.sourceAudienceId || !lookalikeForm.adAccountId) return;
    setFormBusy(true); setError(''); setMsg('');
    try {
      const { data } = await axios.post('/api/audiences/create-lookalike', lookalikeForm);
      setMsg(data.message);
      setShowLookalikeModal(false);
      setLookalikeForm({ adAccountId: '', name: '', sourceAudienceId: '', ratio: 1 });
      await fetchAll();
    } catch (err: any) { setError(err?.response?.data?.message || err.message); }
    finally { setFormBusy(false); }
  };

  const deleteAudience = async () => {
    if (!deleteConfirm) return;
    setFormBusy(true);
    try {
      const { data } = await axios.delete(`/api/audiences/${deleteConfirm.id}`);
      setMsg(data.message);
      setDeleteConfirm(null);
      await fetchAll();
    } catch (err: any) { setError(err?.response?.data?.message || err.message); }
    finally { setFormBusy(false); }
  };

  // Upload CSV
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
        phone: 'PHONE', mobile: 'PHONE', tel: 'PHONE', เบอร์: 'PHONE', โทร: 'PHONE',
        madid: 'MADID', device_id: 'MADID', adid: 'MADID',
        extern_id: 'EXTERN_ID', external_id: 'EXTERN_ID', user_id: 'EXTERN_ID', uid: 'EXTERN_ID', customer_id: 'EXTERN_ID',
        first_name: 'FIRST_NAME', firstname: 'FIRST_NAME', fname: 'FIRST_NAME',
        last_name: 'LAST_NAME', lastname: 'LAST_NAME', lname: 'LAST_NAME',
        zip: 'ZIP', zipcode: 'ZIP', postcode: 'ZIP', รหัสไปรษณีย์: 'ZIP',
        country: 'COUNTRY', ประเทศ: 'COUNTRY',
        city: 'CITY', town: 'CITY', เมือง: 'CITY',
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
    setUploading(true); setUploadError(''); setUploadResult(null);
    try {
      const file = fileInputRef.current?.files?.[0];
      if (!file) { setUploadError('Please select a file'); setUploading(false); return; }
      const formData = new FormData();
      formData.append('file', file);
      formData.append('schema', JSON.stringify(schemaMapping));
      const { data } = await axios.post(`/api/audiences/${uploadTarget.id}/upload-users`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadResult(data);
      await fetchAll();
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
  };

  // Compute available source audiences (custom audiences that are ready)
  const sourceAudiences = audiences.filter(a =>
    a.type === 'CUSTOM' && a.status === 'READY' &&
    (lookalikeForm.adAccountId ? a.adAccountId === lookalikeForm.adAccountId : true)
  );

  if (loading) return (
    <div className="min-h-screen bg-[#0b1120] flex items-center justify-center">
      <p className="text-slate-400 animate-pulse">Loading audiences...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-200">
      {/* Navbar */}
      <header className="bg-[#1e293b] border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold">FB Ads Platform</h1>
            <nav className="flex gap-4 text-sm">
              <a href="/dashboard" className="text-gray-400 hover:text-gray-200">Dashboard</a>
              <a href="/dashboard/all-campaigns" className="text-gray-400 hover:text-gray-200">📋 Campaigns</a>
              <a href="/dashboard/analytics" className="text-gray-400 hover:text-gray-200">📊 Analytics</a>
              <a href="/dashboard/abtest" className="text-gray-400 hover:text-gray-200">🔁 A/B Test</a>
              <a href="/dashboard/audiences" className="text-blue-400 font-medium hover:text-blue-300">🎯 Audiences</a>
              <a href="/dashboard/schedules" className="text-gray-400 hover:text-gray-200">📅 Schedules</a>
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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">🎯 Audience Management</h2>
            <p className="text-sm text-slate-500 mt-1">{audiences.length} audiences</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowCustomModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">➕ Custom</button>
            <button onClick={() => setShowLookalikeModal(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">👥 Lookalike</button>
            <button onClick={fetchAll} disabled={loading}
              className="px-4 py-2 bg-[#1e293b] text-slate-300 rounded-lg text-sm hover:bg-[#293548] border border-slate-700/50">🔄 Refresh</button>
          </div>
        </div>

        {/* Messages */}
        {msg && <div className="px-4 py-3 rounded-lg text-sm bg-green-900/30 text-green-400 border border-green-800/50">{msg}<button className="float-right" onClick={() => setMsg('')}>✕</button></div>}
        {error && <div className="px-4 py-3 rounded-lg text-sm bg-red-900/30 text-red-400 border border-red-800/50">{error}<button className="float-right" onClick={() => setError('')}>✕</button></div>}

        {/* Accounts quick sync */}
        <div className="flex flex-wrap gap-2">
          {accounts.map(acc => (
            <button key={acc.id} onClick={() => syncAudiences(acc.id)} disabled={syncing === acc.id}
              className="px-3 py-1.5 bg-[#1e293b] border border-slate-700/50 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:border-slate-500 disabled:opacity-50">
              {syncing === acc.id ? '⟳ Syncing...' : `⟳ Sync ${acc.name}`}
            </button>
          ))}
        </div>

        {/* Audience Grid */}
        {audiences.length === 0 ? (
          <div className="bg-[#1e293b] rounded-xl border border-slate-700/50 p-12 text-center">
            <p className="text-4xl mb-3">🎯</p>
            <p className="text-lg font-medium mb-1 text-slate-300">No audiences yet</p>
            <p className="text-sm text-slate-500">Sync your ad accounts or create a new audience.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {audiences.map(a => (
              <div key={a.id} className="bg-[#1e293b] rounded-xl p-4 border border-slate-700/50 hover:border-slate-600 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{TYPE_ICONS[a.type] || '🎯'}</span>
                    <div>
                      <p className="text-sm font-medium truncate max-w-[180px]">{a.name}</p>
                      <p className="text-[10px] text-slate-500">{TYPE_LABELS[a.type] || a.type} · {a.accountName}</p>
                    </div>
                  </div>
                  <button onClick={() => setDeleteConfirm(a)}
                    className="text-slate-500 hover:text-red-400 text-xs shrink-0">🗑</button>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg font-bold text-blue-400">{fmtNum(a.approximateCount)}</span>
                  <span className="text-[10px] text-slate-500">people</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[a.status] || 'bg-gray-900/40 text-gray-400 border-gray-700'}`}>{a.status}</span>
                </div>

                {a.description && <p className="text-[11px] text-slate-500 mb-2 line-clamp-2">{a.description}</p>}

                <div className="flex flex-wrap gap-1 text-[10px] text-slate-500">
                  {a.subtype && <span className="bg-[#0b1120] px-1.5 py-0.5 rounded">📁 {a.subtype}</span>}
                  {a.type === 'LOOKALIKE' && a.lookalikeRatio && <span className="bg-[#0b1120] px-1.5 py-0.5 rounded">📊 {a.lookalikeRatio}% ratio</span>}
                </div>
                {a.type === 'CUSTOM' && a.status === 'READY' && (
                  <button onClick={() => setUploadTarget(a)}
                    className="mt-2 w-full text-[10px] py-1 rounded-lg bg-[#0b1120] border border-slate-700/50 text-slate-400 hover:text-blue-400 hover:border-blue-800/50 transition-colors">
                    📤 Upload CSV
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ─── Create Custom Audience Modal ─── */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowCustomModal(false)}>
          <div className="bg-[#1e293b] rounded-xl shadow-xl w-full max-w-md mx-4 border border-slate-700/50" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
              <h3 className="text-lg font-semibold">🎯 Create Custom Audience</h3>
              <button onClick={() => setShowCustomModal(false)} className="text-slate-400 hover:text-slate-200 text-xl">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Ad Account</label>
                <select value={customForm.adAccountId} onChange={e => setCustomForm({...customForm, adAccountId: e.target.value})}
                  className="w-full bg-[#0b1120] border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200">
                  <option value="">Select account...</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Audience Name</label>
                <input type="text" value={customForm.name} onChange={e => setCustomForm({...customForm, name: e.target.value})}
                  className="w-full bg-[#0b1120] border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Description (optional)</label>
                <textarea value={customForm.description} onChange={e => setCustomForm({...customForm, description: e.target.value})}
                  className="w-full bg-[#0b1120] border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200" rows={2} />
              </div>
              <p className="text-xs text-slate-500">This creates an empty custom audience on Facebook. You can add users via CSV or Pixel later.</p>
            </div>
            <div className="p-4 border-t border-slate-700/50 flex justify-end gap-2">
              <button onClick={() => setShowCustomModal(false)}
                className="px-4 py-2 border border-slate-600 rounded-lg text-sm text-slate-300 hover:bg-slate-700">Cancel</button>
              <button onClick={createCustom} disabled={formBusy || !customForm.adAccountId || !customForm.name}
                className="px-4 py-2 bg-blue-600 rounded-lg text-sm text-white hover:bg-blue-700 disabled:opacity-50">
                {formBusy ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Create Lookalike Modal ─── */}
      {showLookalikeModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowLookalikeModal(false)}>
          <div className="bg-[#1e293b] rounded-xl shadow-xl w-full max-w-md mx-4 border border-slate-700/50" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
              <h3 className="text-lg font-semibold">👥 Create Lookalike Audience</h3>
              <button onClick={() => setShowLookalikeModal(false)} className="text-slate-400 hover:text-slate-200 text-xl">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Ad Account</label>
                <select value={lookalikeForm.adAccountId} onChange={e => setLookalikeForm({...lookalikeForm, adAccountId: e.target.value})}
                  className="w-full bg-[#0b1120] border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200">
                  <option value="">Select account...</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Source Audience</label>
                <select value={lookalikeForm.sourceAudienceId} onChange={e => setLookalikeForm({...lookalikeForm, sourceAudienceId: e.target.value})}
                  className="w-full bg-[#0b1120] border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200">
                  <option value="">Select source...</option>
                  {sourceAudiences.map(a => <option key={a.fbAudienceId} value={a.fbAudienceId}>{a.name} ({fmtNum(a.approximateCount)})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Lookalike Name</label>
                <input type="text" value={lookalikeForm.name} onChange={e => setLookalikeForm({...lookalikeForm, name: e.target.value})}
                  className="w-full bg-[#0b1120] border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Audience Size (ratio)</label>
                <div className="flex gap-2">
                  {RATIO_OPTIONS.map(r => (
                    <button key={r} onClick={() => setLookalikeForm({...lookalikeForm, ratio: r})}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        lookalikeForm.ratio === r ? 'bg-purple-600 text-white' : 'bg-[#0b1120] text-slate-400 border border-slate-600 hover:border-slate-500'
                      }`}>
                      {r}%
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Higher % = larger audience but less similarity to source</p>
              </div>
            </div>
            <div className="p-4 border-t border-slate-700/50 flex justify-end gap-2">
              <button onClick={() => setShowLookalikeModal(false)}
                className="px-4 py-2 border border-slate-600 rounded-lg text-sm text-slate-300 hover:bg-slate-700">Cancel</button>
              <button onClick={createLookalike} disabled={formBusy || !lookalikeForm.adAccountId || !lookalikeForm.name || !lookalikeForm.sourceAudienceId}
                className="px-4 py-2 bg-purple-600 rounded-lg text-sm text-white hover:bg-purple-700 disabled:opacity-50">
                {formBusy ? 'Creating...' : '👥 Create Lookalike'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation ─── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-[#1e293b] rounded-xl shadow-xl w-full max-w-sm mx-4 border border-slate-700/50" onClick={e => e.stopPropagation()}>
            <div className="p-4">
              <h3 className="text-lg font-semibold mb-2">🗑 Delete Audience</h3>
              <p className="text-sm text-slate-400 mb-2">Are you sure you want to delete <strong className="text-slate-200">{deleteConfirm.name}</strong>?</p>
              <p className="text-xs text-red-400">This will also delete it from Facebook.</p>
            </div>
            <div className="p-4 border-t border-slate-700/50 flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border border-slate-600 rounded-lg text-sm text-slate-300 hover:bg-slate-700">Cancel</button>
              <button onClick={deleteAudience} disabled={formBusy}
                className="px-4 py-2 bg-red-600 rounded-lg text-sm text-white hover:bg-red-700 disabled:opacity-50">
                {formBusy ? 'Deleting...' : '🗑 Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Upload CSV Modal ─── */}
      {uploadTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={closeUploadModal}>
          <div className="bg-[#1e293b] rounded-xl shadow-xl w-full max-w-lg mx-4 border border-slate-700/50" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
              <h3 className="text-lg font-semibold">📤 Upload Users to Audience</h3>
              <button onClick={closeUploadModal} className="text-slate-400 hover:text-slate-200 text-xl">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-slate-300 font-medium">{uploadTarget.name}</p>
              <p className="text-xs text-slate-500">Upload a CSV file with customer data. Supported columns: email, phone, MADID, extern_id, name, zip, country.</p>

              {/* File picker */}
              {!csvPreview && (
                <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center">
                  <input ref={fileInputRef} id="csv-file-input" type="file" accept=".csv" onChange={handleFileSelect}
                    className="hidden" />
                  <label htmlFor="csv-file-input" className="cursor-pointer flex flex-col items-center gap-2">
                    <span className="text-3xl">📄</span>
                    <span className="text-sm text-slate-400 hover:text-slate-200">Click to select CSV file</span>
                    <span className="text-[10px] text-slate-600">First row must be column headers</span>
                  </label>
                </div>
              )}

              {uploading && !csvPreview && <p className="text-xs text-slate-400 text-center animate-pulse">Reading file...</p>}

              {/* Preview */}
              {csvPreview && csvPreview.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-1">Preview ({csvHeaders.length} columns, showing first rows)</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px] border-collapse">
                      <thead>
                        <tr className="text-slate-400">
                          {csvHeaders.map((h, i) => (
                            <th key={i} className="border border-slate-700/50 px-2 py-1 text-left bg-[#0b1120]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.map((row, ri) => (
                          <tr key={ri} className="text-slate-300">
                            {row.map((val: string, ci: number) => (
                              <td key={ci} className="border border-slate-700/50 px-2 py-1 truncate max-w-[120px]">{val}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Column Mapping */}
              {csvHeaders.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-1">Column Mapping (Facebook Schema)</p>
                  <div className="space-y-1.5">
                    {csvHeaders.map((h, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400 w-24 truncate shrink-0">{h}</span>
                        <span className="text-slate-600">→</span>
                        <select value={schemaMapping[h] || ''}
                          onChange={e => setSchemaMapping({...schemaMapping, [h]: e.target.value})}
                          className="flex-1 bg-[#0b1120] border border-slate-600 rounded px-2 py-1 text-slate-200 text-xs">
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

              {/* Result */}
              {uploadResult && (
                <div className="bg-green-900/30 border border-green-800/50 rounded-lg p-3 text-xs text-green-400 space-y-1">
                  <p>✅ {uploadResult.message}</p>
                  <p>📊 Total: {uploadResult.totalRows} rows</p>
                  {uploadResult.invalid > 0 && <p>⚠️ Invalid: {uploadResult.invalid}</p>}
                  {uploadResult.rejected > 0 && <p>⛔ Rejected: {uploadResult.rejected}</p>}
                </div>
              )}

              {uploadError && (
                <div className="bg-red-900/30 border border-red-800/50 rounded-lg p-3 text-xs text-red-400">{uploadError}</div>
              )}
            </div>
            <div className="p-4 border-t border-slate-700/50 flex justify-end gap-2">
              <button onClick={closeUploadModal}
                className="px-4 py-2 border border-slate-600 rounded-lg text-sm text-slate-300 hover:bg-slate-700">
                {uploadResult ? 'Close' : 'Cancel'}
              </button>
              {csvPreview && !uploadResult && (
                <button onClick={submitUpload} disabled={uploading || Object.values(schemaMapping).filter(Boolean).length === 0}
                  className="px-4 py-2 bg-blue-600 rounded-lg text-sm text-white hover:bg-blue-700 disabled:opacity-50">
                  {uploading ? 'Uploading...' : '📤 Upload to Facebook'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}