'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import Shell from '@/components/Shell';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/Modal';
import { ConfirmModal } from '@/components/Modal';
import { fmtCurr, fmtNum } from '@/lib/utils';

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

const winColor = (vals: number[], idx: number) => {
  const max = Math.max(...vals);
  return max > 0 && vals[idx] === max ? 'text-success font-bold' : 'text-ink-200';
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

  if (loading) return (
    <Shell>
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-ink-300 animate-pulse">Loading A/B tests...</p>
      </div>
    </Shell>
  );

  return (
    <Shell>
      <div className="p-6 space-y-6">
        <PageHeader
          title="🔁 A/B Testing"
          subtitle={tests.length > 0 ? `${tests.length} tests` : undefined}
          actions={
            <button onClick={openCreate}
              className="btn-primary btn-sm">
              + New A/B Test
            </button>
          }
        />

        {syncMsg && <div className="msg-success">{syncMsg}</div>}
        {error && <div className="msg-error">{error}</div>}

        {tests.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-4xl mb-4">🔁</p>
            <p className="text-lg font-medium text-ink mb-1">No A/B tests yet</p>
            <p className="text-sm text-ink-300">Create an A/B test to compare campaign variants side by side</p>
          </div>
        ) : (
          <div className="space-y-6">
            {tests.map((test) => (
              <div key={test.id} className="card">
                <div className="px-6 py-4 flex items-center justify-between border-b border-surface-300">
                  <div>
                    <h3 className="font-semibold text-ink">{test.name}</h3>
                    <p className="text-xs text-ink-300 mt-0.5">
                      Source: {test.sourceCampaign} · {new Date(test.startedAt).toLocaleDateString('th')} · {test.variantCount} variants
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge-${test.status === 'ACTIVE' ? 'success' : 'ink'} text-xs`}>{test.status}</span>
                    {test.status === 'ACTIVE' && (
                      <>
                        <button onClick={() => pauseTest(test.id)}
                          className="btn-xs bg-warning-muted text-warning border border-warning-border hover:bg-warning/20 font-medium">⏸️ Pause</button>
                        <button onClick={() => stopTest(test.id)}
                          className="btn-xs badge-danger hover:bg-danger font-medium">⏹️ Stop</button>
                      </>
                    )}
                    {test.status === 'PAUSED' && (
                      <button onClick={() => resumeTest(test.id)}
                        className="btn-xs bg-success-muted text-success border border-success-border hover:bg-success/20 font-medium">▶️ Resume All</button>
                    )}
                    <button onClick={() => loadVariants(test.id)}
                      className="btn-xs bg-accent-muted text-accent border border-accent-border hover:bg-accent/20 font-medium">🔄 Refresh</button>
                    <button onClick={() => setDeleteConfirm({ type: 'test', id: test.id, name: test.name })}
                      className="btn-xs bg-surface-100 text-ink-300 hover:bg-danger-muted hover:text-danger font-medium">🗑️</button>
                  </div>
                </div>

                {test.variants && test.variants.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-surface-50">
                          <th className="text-left px-4 py-3 font-medium text-ink-300">Variant</th>
                          <th className="text-right px-4 py-3 font-medium text-ink-300">Spend</th>
                          <th className="text-right px-4 py-3 font-medium text-ink-300">Impressions</th>
                          <th className="text-right px-4 py-3 font-medium text-ink-300">Clicks</th>
                          <th className="text-right px-4 py-3 font-medium text-ink-300">CTR</th>
                          <th className="text-right px-4 py-3 font-medium text-ink-300">CPC</th>
                          <th className="text-right px-4 py-3 font-medium text-ink-300">Conversions</th>
                          <th className="text-center px-4 py-3 font-medium text-ink-300">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {test.variants.map((v, idx) => {
                          const spends = test.variants.map(x => x.spend);
                          const ctrs = test.variants.map(x => x.ctr);
                          const cps = test.variants.map(x => x.cpc);
                          const convs = test.variants.map(x => x.conversions);
                          return (
                            <tr key={v.id} className="hover:bg-surface-100 border-b border-surface-300">
                              <td className="px-4 py-3">
                                <span className="font-medium text-ink">{v.name}</span>
                                <span className={`ml-2 px-1.5 py-0.5 text-xs rounded ${v.status === 'ACTIVE' ? 'bg-success-muted text-success border border-success-border' : 'bg-warning-muted text-warning border border-warning-border'}`}>{v.status}</span>
                              </td>
                              <td className={`px-4 py-3 text-right ${winColor(spends, idx)}`}>{fmtCurr(v.spend)}</td>
                              <td className="px-4 py-3 text-right text-ink-200">{fmtNum(v.impressions)}</td>
                              <td className="px-4 py-3 text-right text-ink-200">{fmtNum(v.clicks)}</td>
                              <td className={`px-4 py-3 text-right ${winColor(ctrs, idx)}`}>{v.ctr.toFixed(2)}%</td>
                              <td className={`px-4 py-3 text-right ${winColor(cps, idx)}`}>{fmtCurr(v.cpc)}</td>
                              <td className={`px-4 py-3 text-right ${winColor(convs, idx)}`}>{v.conversions}</td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button onClick={() => toggleVariant(v.id)}
                                    className={`btn-xs ${v.status === 'ACTIVE' ? 'bg-warning-muted text-warning border border-warning-border hover:bg-warning/20' : 'bg-success-muted text-success border border-success-border hover:bg-success/20'}`}>
                                    {v.status === 'ACTIVE' ? '⏸️' : '▶️'}
                                  </button>
                                  <button onClick={() => openEdit(v)}
                                    className="btn-xs bg-accent-muted text-accent border border-accent-border hover:bg-accent/20 font-medium">✏️</button>
                                  <button onClick={() => setDeleteConfirm({ type: 'variant', id: v.id, name: v.name })}
                                    className="btn-xs bg-danger-muted text-danger border border-danger-border hover:bg-danger/20 font-medium">🗑️</button>
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
                  <div className="px-6 py-4 text-sm text-ink-300 text-center">
                    Click &quot;Refresh&quot; to load performance data
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="🔁 New A/B Test" maxWidth="max-w-2xl">
        <div className="mb-4">
          <label className="block text-xs font-medium text-ink mb-1">Source Campaign</label>
          <select value={selectedCamp} onChange={e => setSelectedCamp(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-surface-100 text-ink">
            <option value="">Select campaign...</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.objective})</option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-ink">Variants (at least 2)</label>
            {variants.length < 5 && (
              <button onClick={addVariant} className="text-xs text-accent hover:text-accent/80">+ Add Variant</button>
            )}
          </div>
          <div className="space-y-2">
            {variants.map((v, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <span className="text-xs text-ink-300 w-5">#{idx + 1}</span>
                <input placeholder="Variant name" value={v.name}
                  onChange={e => {
                    const next = [...variants];
                    next[idx] = { ...next[idx], name: e.target.value };
                    setVariants(next);
                  }}
                  className="flex-1 px-3 py-2 text-sm bg-surface-100 text-ink" />
                {variants.length > 2 && (
                  <button onClick={() => removeVariant(idx)}
                    className="text-xs text-danger hover:text-danger/80">✕</button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4 pt-4 -mx-5 px-5 border-t border-surface-300">
          <button onClick={() => setShowCreate(false)} className="btn-secondary btn-sm">Cancel</button>
          <button onClick={createTest} disabled={saving}
            className="btn-primary btn-sm">
            {saving ? 'Creating...' : 'Create A/B Test'}
          </button>
        </div>
      </Modal>

      {/* Edit Variant Modal */}
      <Modal open={!!editVariant} onClose={() => setEditVariant(null)} title="✏️ Edit Variant" maxWidth="max-w-sm">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-ink mb-1">Name</label>
            <input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})}
              className="w-full px-3 py-2 text-sm bg-surface-100 text-ink" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink mb-1">Daily Budget ($)</label>
            <input type="number" value={editForm.dailyBudget} onChange={e => setEditForm({...editForm, dailyBudget: Number(e.target.value) || 0})}
              className="w-full px-3 py-2 text-sm bg-surface-100 text-ink" min={1} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4 pt-4 -mx-5 px-5 border-t border-surface-300">
          <button onClick={() => setEditVariant(null)} className="btn-secondary btn-sm">Cancel</button>
          <button onClick={saveEdit} disabled={editSaving}
            className="btn-primary btn-sm">
            {editSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={confirmDelete}
        title={deleteConfirm?.type === 'test' ? '🗑️ Delete A/B Test' : '🗑️ Delete Variant'}
        message={deleteConfirm ? `Are you sure you want to delete ${deleteConfirm.name}? ${deleteConfirm.type === 'test' ? 'All variants will also be deleted from Facebook.' : 'This variant campaign will be deleted from Facebook.'}` : ''}
        busy={deleting}
        icon="🗑️"
        danger
      />
    </Shell>
  );
}
