'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';

interface AbTestVariant {
  id: string; name: string; fbCampaignId: string; status: string; dailyBudget: number;
  impressions: number; clicks: number; spend: number; ctr: number; cpc: number; conversions: number;
}

interface AbTest {
  id: string; name: string; sourceCampaign: string; status: string;
  startedAt: string; variantCount: number;
  variants: AbTestVariant[];
}

interface CampaignOption {
  id: string; name: string; campaignId: string; objective: string; dailyBudget: number | null;
}

const fmtNum = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString();
const fmtCurr = (v: number) => new Intl.NumberFormat('en', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(v);
const winColor = (vals: number[], idx: number) => {
  const max = Math.max(...vals);
  return max > 0 && vals[idx] === max ? 'text-green-600 font-bold' : 'text-gray-600';
};

export default function AbTestPage() {
  const [tests, setTests] = useState<AbTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncMsg, setSyncMsg] = useState('');

  // Create new
  const [showCreate, setShowCreate] = useState(false);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [selectedCamp, setSelectedCamp] = useState('');
  const [variants, setVariants] = useState([{ name: '', dailyBudget: 0 }]);
  const [saving, setSaving] = useState(false);

  // Edit variant
  const [editVariant, setEditVariant] = useState<{ id: string; name: string; dailyBudget: number } | null>(null);
  const [editForm, setEditForm] = useState({ name: '', dailyBudget: 0 });
  const [editSaving, setEditSaving] = useState(false);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'test' | 'variant'; id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/'; return; }
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    fetchTests();
  }, []);

  const fetchTests = async () => {
    try {
      const { data } = await axios.get('/api/abtest/list');
      setTests(data);
    } catch { setError('Failed to load A/B tests'); }
    finally { setLoading(false); }
  };

  const openCreate = async () => {
    setShowCreate(true);
    setError('');
    try {
      const { data } = await axios.get('/api/campaigns/accounts');
      setCampaigns(data.flatMap((a: any) => a.campaigns || []));
    } catch { setError('Failed to load campaigns'); }
  };

  const addVariant = () => {
    if (variants.length >= 5) return;
    setVariants([...variants, { name: '', dailyBudget: 0 }]);
  };

  const removeVariant = (idx: number) => {
    if (variants.length <= 2) return;
    setVariants(variants.filter((_, i) => i !== idx));
  };

  const createTest = async () => {
    if (!selectedCamp) { setError('Select a source campaign'); return; }
    const validVariants = variants.filter(v => v.name.trim());
    if (validVariants.length < 2) { setError('Need at least 2 variants with names'); return; }

    setSaving(true); setError('');
    try {
      await axios.post('/api/abtest/create', {
        sourceCampaignId: selectedCamp,
        variants: validVariants,
      });
      setSyncMsg('✅ A/B Test created!');
      setShowCreate(false);
      fetchTests();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message);
    } finally { setSaving(false); }
  };

  const stopTest = async (testId: string) => {
    try {
      await axios.post(`/api/abtest/${testId}/stop`);
      setSyncMsg('✅ A/B Test stopped');
      fetchTests();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message);
    }
  };

  const pauseTest = async (testId: string) => {
    try {
      await axios.post(`/api/abtest/${testId}/pause`);
      setSyncMsg('⏸️ All variants paused');
      fetchTests();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message);
    }
  };

  const resumeTest = async (testId: string) => {
    try {
      await axios.post(`/api/abtest/${testId}/resume`);
      setSyncMsg('▶️ All variants resumed');
      fetchTests();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message);
    }
  };

  const toggleVariant = async (variantId: string) => {
    try {
      const { data } = await axios.post(`/api/abtest/variants/${variantId}/toggle`);
      setSyncMsg(data.message === 'Variant paused' ? '⏸️ Variant paused' : '▶️ Variant resumed');
      fetchTests();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message);
    }
  };

  const openEdit = (v: AbTestVariant) => {
    setEditVariant({ id: v.id, name: v.name, dailyBudget: v.dailyBudget });
    setEditForm({ name: v.name, dailyBudget: v.dailyBudget });
  };

  const saveEdit = async () => {
    if (!editVariant) return;
    setEditSaving(true);
    try {
      await axios.patch(`/api/abtest/variants/${editVariant.id}`, editForm);
      setSyncMsg('✅ Variant updated');
      setEditVariant(null);
      fetchTests();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message);
    } finally { setEditSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const url = deleteConfirm.type === 'test'
        ? `/api/abtest/${deleteConfirm.id}`
        : `/api/abtest/variants/${deleteConfirm.id}`;
      await axios.delete(url);
      setSyncMsg(`🗑️ ${deleteConfirm.type === 'test' ? 'A/B test' : 'Variant'} deleted`);
      setDeleteConfirm(null);
      fetchTests();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message);
    } finally { setDeleting(false); }
  };

  const loadVariants = async (testId: string) => {
    try {
      const { data } = await axios.get(`/api/abtest/${testId}/variants`);
      setTests(tests.map(t => t.id === testId ? { ...t, variants: data.variants } : t));
    } catch { setError('Failed to load variant data'); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><p className="text-gray-500">Loading...</p></div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold">FB Ads Platform</h1>
            <nav className="flex gap-4 text-sm">
              <a href="/dashboard" className="text-gray-500 hover:text-gray-800">Dashboard</a>
              <a href="/dashboard/all-campaigns" className="text-gray-500 hover:text-gray-800">📋 All Campaigns</a>
              <a href="/dashboard/campaigns/new" className="text-gray-500 hover:text-gray-800">🎯 New Campaign</a>
              <a href="/dashboard/rules" className="text-gray-500 hover:text-gray-800">⚡ Rules</a>
              <a href="/dashboard/analytics" className="text-gray-500 hover:text-gray-800">📊 Analytics</a>
              <a href="/dashboard/audiences" className="text-gray-500 hover:text-gray-800">🎯 Audiences</a>
              <a href="/dashboard/abtest" className="text-blue-600 font-medium hover:text-blue-800">🔁 A/B Test</a>
              <a href="/dashboard/budget" className="text-gray-500 hover:text-gray-800">💰 Budget</a>
              <a href="/dashboard/notifications" className="text-gray-500 hover:text-gray-800">🔔 Alerts</a>
              <a href="/dashboard/creatives" className="text-gray-500 hover:text-gray-800">🎨 Creatives</a>
            </nav>
          </div>
          <button onClick={() => { localStorage.removeItem('token'); window.location.href = '/'; }}
            className="text-sm text-gray-500 hover:text-red-600">Sign Out</button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">🔁 A/B Testing</h2>
          <button onClick={openCreate}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
            + New A/B Test
          </button>
        </div>

        {syncMsg && <div className="mb-4 px-4 py-3 rounded-lg text-sm bg-green-50 text-green-700 border border-green-200">{syncMsg}</div>}
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">{error}</div>}

        {tests.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border p-12 text-center text-gray-400">
            <p className="text-4xl mb-4">🔁</p>
            <p className="text-lg font-medium mb-1">No A/B tests yet</p>
            <p className="text-sm">Create an A/B test to compare campaign variants side by side</p>
          </div>
        ) : (
          <div className="space-y-6">
            {tests.map((test) => (
              <div key={test.id} className="bg-white rounded-xl shadow-sm border">
                <div className="px-6 py-4 border-b flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{test.name}</h3>
                    <p className="text-xs text-gray-500">Source: {test.sourceCampaign} · {new Date(test.startedAt).toLocaleDateString('th')} · {test.variantCount} variants</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 text-xs rounded-full ${test.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{test.status}</span>
                    {test.status === 'ACTIVE' && (
                      <>
                        <button onClick={() => pauseTest(test.id)}
                          className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded hover:bg-yellow-200 font-medium">⏸️ Pause</button>
                        <button onClick={() => stopTest(test.id)}
                          className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200 font-medium">⏹️ Stop</button>
                      </>
                    )}
                    {test.status === 'ACTIVE' && (
                      <button onClick={() => resumeTest(test.id)}
                        className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 font-medium">▶️ Resume All</button>
                    )}
                    <button onClick={() => loadVariants(test.id)}
                      className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 font-medium">🔄 Refresh</button>
                    <button onClick={() => setDeleteConfirm({ type: 'test', id: test.id, name: test.name })}
                      className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded hover:bg-red-100 hover:text-red-600 font-medium">🗑️</button>
                  </div>
                </div>

                {test.variants && test.variants.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="text-left px-4 py-3 font-medium text-gray-500">Variant</th>
                          <th className="text-right px-4 py-3 font-medium text-gray-500">Spend</th>
                          <th className="text-right px-4 py-3 font-medium text-gray-500">Impressions</th>
                          <th className="text-right px-4 py-3 font-medium text-gray-500">Clicks</th>
                          <th className="text-right px-4 py-3 font-medium text-gray-500">CTR</th>
                          <th className="text-right px-4 py-3 font-medium text-gray-500">CPC</th>
                          <th className="text-right px-4 py-3 font-medium text-gray-500">Conversions</th>
                          <th className="text-center px-4 py-3 font-medium text-gray-500">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {test.variants.map((v, idx) => {
                          const spends = test.variants.map(x => x.spend);
                          const ctrs = test.variants.map(x => x.ctr);
                          const cps = test.variants.map(x => x.cpc);
                          const convs = test.variants.map(x => x.conversions);
                          return (
                            <tr key={v.id} className="border-t hover:bg-slate-50">
                              <td className="px-4 py-3">
                                <span className="font-medium">{v.name}</span>
                                <span className={`ml-2 px-1.5 py-0.5 text-xs rounded ${v.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{v.status}</span>
                              </td>
                              <td className={`px-4 py-3 text-right ${winColor(spends, idx)}`}>{fmtCurr(v.spend)}</td>
                              <td className="px-4 py-3 text-right">{fmtNum(v.impressions)}</td>
                              <td className="px-4 py-3 text-right">{fmtNum(v.clicks)}</td>
                              <td className={`px-4 py-3 text-right ${winColor(ctrs, idx)}`}>{v.ctr.toFixed(2)}%</td>
                              <td className={`px-4 py-3 text-right ${winColor(cps, idx)}`}>{fmtCurr(v.cpc)}</td>
                              <td className={`px-4 py-3 text-right ${winColor(convs, idx)}`}>{v.conversions}</td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button onClick={() => toggleVariant(v.id)}
                                    className={`text-xs px-2 py-1 rounded font-medium ${v.status === 'ACTIVE' ? 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                                    {v.status === 'ACTIVE' ? '⏸️' : '▶️'}
                                  </button>
                                  <button onClick={() => openEdit(v)}
                                    className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 font-medium">✏️</button>
                                  <button onClick={() => setDeleteConfirm({ type: 'variant', id: v.id, name: v.name })}
                                    className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded hover:bg-red-100 font-medium">🗑️</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {(!test.variants || test.variants.length === 0) && (
                  <div className="px-6 py-4 text-sm text-gray-400 text-center">
                    Click "Refresh" to load performance data
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">🔁 New A/B Test</h3>

            <div className="mb-4">
              <label className="block text-xs font-medium mb-1">Source Campaign</label>
              <select value={selectedCamp} onChange={e => setSelectedCamp(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Select campaign...</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.objective})</option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium">Variants (at least 2)</label>
                {variants.length < 5 && (
                  <button onClick={addVariant} className="text-xs text-blue-600 hover:text-blue-800">+ Add Variant</button>
                )}
              </div>
              <div className="space-y-2">
                {variants.map((v, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <span className="text-xs text-gray-400 w-5">#{idx + 1}</span>
                    <input placeholder="Variant name" value={v.name}
                      onChange={e => {
                        const next = [...variants];
                        next[idx] = { ...next[idx], name: e.target.value };
                        setVariants(next);
                      }}
                      className="flex-1 border rounded-lg px-3 py-2 text-sm" />
                    {variants.length > 2 && (
                      <button onClick={() => removeVariant(idx)}
                        className="text-xs text-red-500 hover:text-red-700">✕</button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={createTest} disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Creating...' : 'Create A/B Test'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Variant Modal */}
      {editVariant && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setEditVariant(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">✏️ Edit Variant</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">Name</label>
                <input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Daily Budget ($)</label>
                <input type="number" value={editForm.dailyBudget} onChange={e => setEditForm({...editForm, dailyBudget: Number(e.target.value) || 0})}
                  className="w-full border rounded-lg px-3 py-2 text-sm" min={1} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEditVariant(null)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={saveEdit} disabled={editSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                {editSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">🗑️ Delete {deleteConfirm.type === 'test' ? 'A/B Test' : 'Variant'}</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?
              {deleteConfirm.type === 'test'
                ? ' All variants will also be deleted from Facebook.'
                : ' This variant campaign will be deleted from Facebook.'}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={confirmDelete} disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
