'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';

type RuleCondition = { metric: string; operator: string; value: number; window?: string };
type Rule = {
  id: string; name: string; description: string | null; scope: string;
  logic: string; conditions: RuleCondition[]; actions: string[];
  cooldownMinutes: number; isEnabled: boolean; triggerCount: number;
  lastTriggeredAt: string | null; createdAt: string;
  remainingCooldown: number;
  campaign?: { id: string; name: string; status: string } | null;
  adAccount?: { id: string; name: string } | null;
  _count?: { logs: number };
};

const METRICS = [
  { key: 'CTR', label: 'CTR (%)', unit: '%' },
  { key: 'CPC', label: 'CPC (THB)', unit: '฿' },
  { key: 'CPA', label: 'CPA (THB)', unit: '฿' },
  { key: 'CPM', label: 'CPM (THB)', unit: '฿' },
  { key: 'SPEND', label: 'Spend (THB)', unit: '฿' },
  { key: 'IMPRESSIONS', label: 'Impressions', unit: '' },
  { key: 'FREQUENCY', label: 'Frequency', unit: '' },
  { key: 'ROAS', label: 'ROAS', unit: 'x' },
  { key: 'CONVERSIONS', label: 'Conversions', unit: '' },
  { key: 'REACH', label: 'Reach', unit: '' },
];

const OPERATORS = [
  { key: 'GT', label: '>' },
  { key: 'LT', label: '<' },
  { key: 'GTE', label: '≥' },
  { key: 'LTE', label: '≤' },
  { key: 'EQ', label: '=' },
];

const ACTIONS = [
  { key: 'PAUSE_CAMPAIGN', label: '⏸ Pause Campaign', color: 'bg-red-100 text-red-700' },
  { key: 'PAUSE_ADSET', label: '⏸ Pause AdSet', color: 'bg-red-100 text-red-700' },
  { key: 'INCREASE_BUDGET_10', label: '📈 +10% Budget', color: 'bg-green-100 text-green-700' },
  { key: 'INCREASE_BUDGET_20', label: '📈 +20% Budget', color: 'bg-green-100 text-green-700' },
  { key: 'INCREASE_BUDGET_50', label: '📈 +50% Budget', color: 'bg-green-100 text-green-700' },
  { key: 'DECREASE_BUDGET_10', label: '📉 -10% Budget', color: 'bg-yellow-100 text-yellow-700' },
  { key: 'DECREASE_BUDGET_20', label: '📉 -20% Budget', color: 'bg-yellow-100 text-yellow-700' },
  { key: 'NOTIFY', label: '🔔 Notify', color: 'bg-blue-100 text-blue-700' },
];

const SCOPE_LABELS: Record<string, string> = { CAMPAIGN: 'Campaign', ADSET: 'AdSet', AD: 'Ad', ACCOUNT: 'Account' };

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState('');

  // Form state
  const [form, setForm] = useState({
    name: '', description: '', scope: 'CAMPAIGN',
    conditions: [{ metric: 'CTR', operator: 'LT', value: 1 }] as RuleCondition[],
    logic: 'ALL', actions: ['NOTIFY'] as string[],
    cooldownMinutes: 60,
    campaignId: '', adAccountId: '',
  });
  const [editId, setEditId] = useState<string | null>(null);

  // Campaigns / accounts for dropdowns
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [showLogs, setShowLogs] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/'; return; }
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [rulesRes, campsRes, acctsRes] = await Promise.all([
        axios.get('/api/rules'),
        axios.get('/api/adaccounts').then(r => {
          // Get all campaigns from all accounts
          const allCamps: { id: string; name: string }[] = [];
          return allCamps;
        }).catch(() => ({ data: [] as any[] })),
        axios.get('/api/adaccounts').catch(() => ({ data: [] })),
      ]);
      setRules(rulesRes.data);
      setAccounts(acctsRes.data);

      // Load campaigns for each account
      const allCamps: { id: string; name: string; accountId: string }[] = [];
      for (const acct of acctsRes.data) {
        try {
          const { data } = await axios.get(`/api/adaccounts/${acct.id}/campaigns`);
          allCamps.push(...data.map((c: any) => ({ id: c.id, name: c.name, accountId: acct.id })));
        } catch {}
      }
      setCampaigns(allCamps);
    } catch (err: any) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const saveRule = async () => {
    try {
      const dto: any = {
        name: form.name,
        description: form.description || undefined,
        scope: form.scope,
        conditions: form.conditions,
        logic: form.logic,
        actions: form.actions,
        cooldownMinutes: form.cooldownMinutes,
      };
      if (form.campaignId) dto.campaignId = form.campaignId;
      if (form.adAccountId) dto.adAccountId = form.adAccountId;

      if (editId) {
        await axios.patch(`/api/rules/${editId}`, dto);
        setMsg('✅ Rule updated!');
      } else {
        await axios.post('/api/rules', dto);
        setMsg('✅ Rule created!');
      }
      setShowForm(false);
      setEditId(null);
      resetForm();
      loadAll();
    } catch (err: any) {
      setMsg(`❌ Failed: ${err?.response?.data?.message || err.message}`);
    }
  };

  const toggleRule = async (id: string) => {
    try {
      await axios.post(`/api/rules/${id}/toggle`);
      loadAll();
    } catch {}
  };

  const deleteRule = async (id: string, name: string) => {
    if (!confirm(`Delete rule "${name}"?`)) return;
    try {
      await axios.delete(`/api/rules/${id}`);
      setMsg('🗑️ Rule deleted');
      loadAll();
    } catch {}
  };

  const editRule = (rule: Rule) => {
    setForm({
      name: rule.name,
      description: rule.description || '',
      scope: rule.scope,
      conditions: rule.conditions.length > 0 ? rule.conditions : [{ metric: 'CTR', operator: 'LT', value: 1 }],
      logic: rule.logic,
      actions: rule.actions.length > 0 ? rule.actions : ['NOTIFY'],
      cooldownMinutes: rule.cooldownMinutes,
      campaignId: rule.campaign?.id || '',
      adAccountId: rule.adAccount?.id || '',
    });
    setEditId(rule.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openNewRule = () => {
    resetForm();
    setEditId(null);
    setShowForm(!showForm);
  };

  const viewLogs = async (ruleId: string) => {
    setShowLogs(ruleId);
    setLoadingLogs(true);
    try {
      const { data } = await axios.get(`/api/rules/${ruleId}/logs`);
      setLogs(data);
    } catch {}
    setLoadingLogs(false);
  };

  const resetForm = () => {
    setForm({
      name: '', description: '', scope: 'CAMPAIGN',
      conditions: [{ metric: 'CTR', operator: 'LT', value: 1 }],
      logic: 'ALL', actions: ['NOTIFY'],
      cooldownMinutes: 60, campaignId: '', adAccountId: '',
    });
  };

  const updateCondition = (i: number, field: string, value: any) => {
    const conds = [...form.conditions];
    (conds[i] as any)[field] = value;
    setForm({ ...form, conditions: conds });
  };

  const addCondition = () => {
    setForm({ ...form, conditions: [...form.conditions, { metric: 'CTR', operator: 'LT', value: 1 }] });
  };

  const removeCondition = (i: number) => {
    if (form.conditions.length <= 1) return;
    setForm({ ...form, conditions: form.conditions.filter((_, idx) => idx !== i) });
  };

  const metricLabel = (key: string) => METRICS.find(m => m.key === key)?.label || key;
  const actionLabel = (key: string) => ACTIONS.find(a => a.key === key)?.label || key;
  const actionColor = (key: string) => ACTIONS.find(a => a.key === key)?.color || 'bg-gray-100 text-gray-600';
  const operatorLabel = (key: string) => OPERATORS.find(o => o.key === key)?.label || key;
  const fmtDate = (d: string) => new Date(d).toLocaleString('th');

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading...</p></div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">⚡ Rule Engine</h1>
            <a href="/dashboard" className="text-sm text-blue-600 hover:text-blue-800">← Back to Dashboard</a>
          </div>
          <button onClick={openNewRule}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium">
            {showForm ? '✕ Close' : '+ New Rule'}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {msg && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${msg.includes('✅') || msg.includes('🗑️') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {msg}
            <button className="float-right" onClick={() => setMsg('')}>✕</button>
          </div>
        )}
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">{error}</div>}

        {/* Create Form */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">{editId ? '✏️ Edit Rule' : 'Create Rule'}</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Rule Name</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Stop if CPA too high" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Scope</label>
                <select value={form.scope} onChange={e => setForm({...form, scope: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="CAMPAIGN">Campaign</option>
                  <option value="ACCOUNT">Account</option>
                </select>
              </div>
            </div>

            {/* Target selector */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Ad Account (optional)</label>
                <select value={form.adAccountId} onChange={e => setForm({...form, adAccountId: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">All accounts</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Campaign (optional)</label>
                <select value={form.campaignId} onChange={e => setForm({...form, campaignId: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">All campaigns</option>
                  {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            {/* Conditions */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Conditions ({form.logic})</label>
              <div className="space-y-2">
                {form.conditions.map((cond, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <select value={cond.metric} onChange={e => updateCondition(i, 'metric', e.target.value)}
                      className="border rounded-lg px-3 py-2 text-sm w-40">
                      {METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </select>
                    <select value={cond.operator} onChange={e => updateCondition(i, 'operator', e.target.value)}
                      className="border rounded-lg px-3 py-2 text-sm w-16">
                      {OPERATORS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                    </select>
                    <input type="number" value={cond.value} onChange={e => updateCondition(i, 'value', parseFloat(e.target.value) || 0)}
                      className="border rounded-lg px-3 py-2 text-sm w-24" step="0.01" />
                    <span className="text-xs text-gray-400 w-8">{METRICS.find(m => m.key === cond.metric)?.unit}</span>
                    <button onClick={() => removeCondition(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                  </div>
                ))}
              </div>
              <button onClick={addCondition} className="mt-2 text-sm text-blue-600 hover:text-blue-800">+ Add condition</button>
              <div className="mt-2 flex gap-4 text-sm">
                <label className="flex items-center gap-1">
                  <input type="radio" name="logic" checked={form.logic === 'ALL'} onChange={() => setForm({...form, logic: 'ALL'})} />
                  ALL conditions must match
                </label>
                <label className="flex items-center gap-1">
                  <input type="radio" name="logic" checked={form.logic === 'ANY'} onChange={() => setForm({...form, logic: 'ANY'})} />
                  ANY condition matches
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Actions</label>
              <div className="flex flex-wrap gap-2">
                {ACTIONS.map(a => (
                  <button key={a.key}
                    onClick={() => {
                      const acts = form.actions.includes(a.key)
                        ? form.actions.filter(x => x !== a.key)
                        : [...form.actions, a.key];
                      setForm({...form, actions: acts});
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                      form.actions.includes(a.key)
                        ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                    }`}>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cooldown */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Cooldown (minutes)</label>
                <input type="number" value={form.cooldownMinutes}
                  onChange={e => setForm({...form, cooldownMinutes: parseInt(e.target.value) || 60})}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Optional description" />
              </div>
            </div>

            <button onClick={saveRule}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium">
              {editId ? '💾 Update Rule' : '💾 Save Rule'}
            </button>
          </div>
        )}

        {/* Rules List */}
        {rules.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
            <p className="text-4xl mb-3">⚡</p>
            <p className="text-gray-500 text-lg mb-4">No rules yet</p>
            <button onClick={() => setShowForm(true)}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium">
              + Create your first rule
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {rules.map((rule) => (
              <div key={rule.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold">{rule.name}</h3>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          rule.isEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>{rule.isEnabled ? 'Active' : 'Disabled'}</span>
                        <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full">{SCOPE_LABELS[rule.scope] || rule.scope}</span>
                      </div>
                      {rule.description && <p className="text-sm text-gray-500 mb-2">{rule.description}</p>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => editRule(rule)}
                        className="px-3 py-1 text-xs rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium">
                        ✏️ Edit
                      </button>
                      <button onClick={() => toggleRule(rule.id)}
                        className={`px-3 py-1 text-xs rounded-lg font-medium ${
                          rule.isEnabled ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}>
                        {rule.isEnabled ? 'Disable' : 'Enable'}
                      </button>
                      <button onClick={() => deleteRule(rule.id, rule.name)}
                        className="px-3 py-1 text-xs rounded-lg bg-red-50 text-red-500 hover:bg-red-100">
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Conditions */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(rule.conditions as RuleCondition[]).map((c, i) => (
                      <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md">
                        {metricLabel(c.metric)} {operatorLabel(c.operator)} {c.value}
                      </span>
                    ))}
                    <span className="px-2 py-1 bg-gray-50 text-gray-500 text-xs rounded-md font-medium">
                      {rule.logic}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {rule.actions.map((a, i) => (
                      <span key={i} className={`px-2 py-1 text-xs rounded-md ${actionColor(a)}`}>
                        {actionLabel(a)}
                      </span>
                    ))}
                  </div>

                  {/* Meta */}
                  <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
                    <span>🔄 Triggered {rule.triggerCount} times</span>
                    <span>⏱ Cooldown: {rule.cooldownMinutes}m</span>
                    {rule.remainingCooldown > 0 && (
                      <span className="text-orange-500 font-medium">
                        ⏳ Cooldown remaining: {Math.floor(rule.remainingCooldown / 60)}m {rule.remainingCooldown % 60}s
                      </span>
                    )}
                    <span>📋 Logs: {rule._count?.logs || 0}</span>
                    {rule.lastTriggeredAt && <span>Last fired: {fmtDate(rule.lastTriggeredAt)}</span>}
                    {rule.campaign && <span>🎯 {rule.campaign.name} ({rule.campaign.status})</span>}
                  </div>

                  {/* View logs button */}
                  <button onClick={() => viewLogs(rule.id)}
                    className="mt-2 text-xs text-blue-600 hover:text-blue-800">
                    {showLogs === rule.id ? 'Hide logs' : 'View logs'}
                  </button>

                  {/* Logs */}
                  {showLogs === rule.id && (
                    <div className="mt-3 border-t pt-3">
                      {loadingLogs ? (
                        <p className="text-sm text-gray-400">Loading...</p>
                      ) : logs.length === 0 ? (
                        <p className="text-sm text-gray-400">No logs yet</p>
                      ) : (
                        <div className="max-h-60 overflow-y-auto space-y-1">
                          {logs.map((log: any) => (
                            <div key={log.id} className={`text-xs p-2 rounded ${
                              log.success ? 'bg-green-50' : 'bg-red-50'
                            }`}>
                              <span className="font-medium">{fmtDate(log.triggeredAt)}</span>
                              {' — '}
                              <span className={log.success ? 'text-green-600' : 'text-red-600'}>
                                {log.success ? '✅ Success' : `❌ ${log.errorMessage || 'Failed'}`}
                              </span>
                              {' — '}
                              <span className="text-gray-500">
                                {JSON.stringify(log.action)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
