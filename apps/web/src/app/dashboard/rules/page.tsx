'use client';

import { useEffect, useState } from 'react';
import { accountsApi, rulesApi } from '@/lib/api-client';
import { Zap, TrendingUp, TrendingDown, Bell, Pencil, Timer, Hourglass, ClipboardList, Target, RefreshCw, Trash2, Save, X } from 'lucide-react';
import Shell from '@/components/Shell';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/Modal';
import { ConfirmModal } from '@/components/Modal';

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
  { key: 'PAUSE_CAMPAIGN', label: <span className="inline-flex items-center gap-1"><Timer className="w-3 h-3" /> Pause Campaign</span>, color: 'badge-danger' },
  { key: 'PAUSE_ADSET', label: <span className="inline-flex items-center gap-1"><Timer className="w-3 h-3" /> Pause AdSet</span>, color: 'badge-danger' },
  { key: 'INCREASE_BUDGET_10', label: <span className="inline-flex items-center gap-1"><TrendingUp className="w-3 h-3" /> +10% Budget</span>, color: 'bg-success-muted text-success border border-success-border' },
  { key: 'INCREASE_BUDGET_20', label: <span className="inline-flex items-center gap-1"><TrendingUp className="w-3 h-3" /> +20% Budget</span>, color: 'bg-success-muted text-success border border-success-border' },
  { key: 'INCREASE_BUDGET_50', label: <span className="inline-flex items-center gap-1"><TrendingUp className="w-3 h-3" /> +50% Budget</span>, color: 'bg-success-muted text-success border border-success-border' },
  { key: 'DECREASE_BUDGET_10', label: <span className="inline-flex items-center gap-1"><TrendingDown className="w-3 h-3" /> -10% Budget</span>, color: 'badge-warning' },
  { key: 'DECREASE_BUDGET_20', label: <span className="inline-flex items-center gap-1"><TrendingDown className="w-3 h-3" /> -20% Budget</span>, color: 'badge-warning' },
  { key: 'NOTIFY', label: <span className="inline-flex items-center gap-1"><Bell className="w-3 h-3" /> Notify</span>, color: 'bg-accent-muted text-accent border border-accent-border' },
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

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [rulesRes, acctsRes] = await Promise.all([
        rulesApi.list(),
        accountsApi.list().catch(() => ({ data: [] })),
      ]);
      setRules(rulesRes.data);
      setAccounts(acctsRes.data);

      const allCamps: { id: string; name: string; accountId: string }[] = [];
      for (const acct of acctsRes.data) {
        try {
          const { data } = await accountsApi.campaigns(acct.id);
          allCamps.push(...data.map((c) => ({ id: c.id, name: c.name, accountId: acct.id })));
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
        await rulesApi.update(editId, dto);
        setMsg('✅ Rule updated!');
      } else {
        await rulesApi.create(dto);
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
      await rulesApi.toggle(id);
      loadAll();
    } catch {}
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await rulesApi.remove(deleteConfirm.id);
      setMsg('🗑️ Rule deleted');
      setDeleteConfirm(null);
      loadAll();
    } catch {}
    setDeleting(false);
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
      const { data } = await rulesApi.logs(ruleId);
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
  const actionColor = (key: string) => ACTIONS.find(a => a.key === key)?.color || 'badge-ink';
  const operatorLabel = (key: string) => OPERATORS.find(o => o.key === key)?.label || key;
  const fmtDate = (d: string) => new Date(d).toLocaleString('th');

  if (loading) return (
    <Shell>
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-ink-300 animate-pulse">Loading rules...</p>
      </div>
    </Shell>
  );

  return (
    <Shell>
      <div className="p-6 space-y-6">
        <PageHeader
          title="⚡ Rule Engine"
          subtitle={rules.length > 0 ? `${rules.length} rules configured` : undefined}
          actions={
            <button onClick={openNewRule} className="btn-primary btn-sm inline-flex items-center gap-1">
              {showForm ? <><X className="w-4 h-4" /> Close</> : '+ New Rule'}
            </button>
          }
        />

        {/* Messages */}
        {msg && <div className={`${msg.includes('✅') || msg.includes('🗑️') ? 'msg-success' : 'msg-error'}`}>{msg}<button className="float-right" onClick={() => setMsg('')}><X className="w-4 h-4" /></button></div>}
        {error && <div className="msg-error">{error}<button className="float-right" onClick={() => setError('')}><X className="w-4 h-4" /></button></div>}

        {/* Create Form */}
        {showForm && (
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4 text-ink inline-flex items-center gap-2">{editId ? <><Pencil className="w-4 h-4" /> Edit Rule</> : 'Create Rule'}</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Rule Name</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full border border-surface-200 rounded-lg px-3 py-2 text-sm bg-surface-50 text-ink" placeholder="e.g. Stop if CPA too high" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Scope</label>
                <select value={form.scope} onChange={e => setForm({...form, scope: e.target.value})}
                  className="w-full border border-surface-200 rounded-lg px-3 py-2 text-sm bg-surface-50 text-ink">
                  <option value="CAMPAIGN">Campaign</option>
                  <option value="ACCOUNT">Account</option>
                </select>
              </div>
            </div>

            {/* Target selector */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Ad Account (optional)</label>
                <select value={form.adAccountId} onChange={e => setForm({...form, adAccountId: e.target.value})}
                  className="w-full border border-surface-200 rounded-lg px-3 py-2 text-sm bg-surface-50 text-ink">
                  <option value="">All accounts</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Campaign (optional)</label>
                <select value={form.campaignId} onChange={e => setForm({...form, campaignId: e.target.value})}
                  className="w-full border border-surface-200 rounded-lg px-3 py-2 text-sm bg-surface-50 text-ink">
                  <option value="">All campaigns</option>
                  {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            {/* Conditions */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-ink mb-2">Conditions ({form.logic})</label>
              <div className="space-y-2">
                {form.conditions.map((cond, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <select value={cond.metric} onChange={e => updateCondition(i, 'metric', e.target.value)}
                      className="border border-surface-200 rounded-lg px-3 py-2 text-sm bg-surface-50 text-ink w-40">
                      {METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </select>
                    <select value={cond.operator} onChange={e => updateCondition(i, 'operator', e.target.value)}
                      className="border border-surface-200 rounded-lg px-3 py-2 text-sm bg-surface-50 text-ink w-16">
                      {OPERATORS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                    </select>
                    <input type="number" value={cond.value} onChange={e => updateCondition(i, 'value', parseFloat(e.target.value) || 0)}
                      className="border border-surface-200 rounded-lg px-3 py-2 text-sm bg-surface-50 text-ink w-24" step="0.01" />
                    <span className="text-xs text-ink-300 w-8">{METRICS.find(m => m.key === cond.metric)?.unit}</span>
                    <button onClick={() => removeCondition(i)} className="text-danger hover:text-danger/80 text-xs"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
              <button onClick={addCondition} className="mt-2 text-sm text-accent hover:text-accent/80">+ Add condition</button>
              <div className="mt-2 flex gap-4 text-sm text-ink">
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
              <label className="block text-sm font-medium text-ink mb-2">Actions</label>
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
                        ? 'bg-accent-muted text-accent border-accent-border'
                        : 'bg-white text-ink-300 border-surface-200 hover:border-ink-100'
                    }`}>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cooldown */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Cooldown (minutes)</label>
                <input type="number" value={form.cooldownMinutes}
                  onChange={e => setForm({...form, cooldownMinutes: parseInt(e.target.value) || 60})}
                  className="w-full border border-surface-200 rounded-lg px-3 py-2 text-sm bg-surface-50 text-ink" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Description</label>
                <input value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                  className="w-full border border-surface-200 rounded-lg px-3 py-2 text-sm bg-surface-50 text-ink" placeholder="Optional description" />
              </div>
            </div>

            <button onClick={saveRule}
              className="btn-primary btn-sm inline-flex items-center gap-1">
              {editId ? <><Save className="w-4 h-4" /> Update Rule</> : <><Save className="w-4 h-4" /> Save Rule</>}
            </button>
          </div>
        )}

        {/* Rules List */}
        {rules.length === 0 ? (
          <div className="card p-12 text-center">
            <Zap className="w-12 h-12 mx-auto mb-3 text-ink-200" />
            <p className="text-ink-300 text-lg mb-4">No rules yet</p>
            <button onClick={() => setShowForm(true)}
              className="btn-primary btn-sm inline-flex items-center gap-1">
              + Create your first rule
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {rules.map((rule) => (
              <div key={rule.id} className="card overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-ink">{rule.name}</h3>
                        <span className={`badge-${rule.isEnabled ? 'success' : 'ink'} text-xs`}>{rule.isEnabled ? 'Active' : 'Disabled'}</span>
                        <span className="badge-ink text-xs">{SCOPE_LABELS[rule.scope] || rule.scope}</span>
                      </div>
                      {rule.description && <p className="text-sm text-ink-300 mb-2">{rule.description}</p>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => editRule(rule)}
                        className="btn-secondary btn-xs inline-flex items-center gap-1">
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                      <button onClick={() => toggleRule(rule.id)}
                        className={`btn-xs ${rule.isEnabled ? 'btn bg-warning-muted text-warning border border-warning-border hover:bg-warning/20' : 'btn bg-success-muted text-success border border-success-border hover:bg-success/20'}`}>
                        {rule.isEnabled ? 'Disable' : 'Enable'}
                      </button>
                      <button onClick={() => setDeleteConfirm({ id: rule.id, name: rule.name })}
                        className="btn-danger btn-xs">
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Conditions */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(rule.conditions as RuleCondition[]).map((c, i) => (
                      <span key={i} className="px-2 py-1 bg-accent-muted text-accent text-xs rounded-md">
                        {metricLabel(c.metric)} {operatorLabel(c.operator)} {c.value}
                      </span>
                    ))}
                    <span className="px-2 py-1 bg-surface-100 text-ink-300 text-xs rounded-md font-medium">
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
                  <div className="mt-3 flex items-center gap-4 text-xs text-ink-300">
                    <span className="inline-flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Triggered {rule.triggerCount} times</span>
                    <span className="inline-flex items-center gap-1"><Timer className="w-3 h-3" /> Cooldown: {rule.cooldownMinutes}m</span>
                    {rule.remainingCooldown > 0 && (
                      <span className="text-warning font-medium inline-flex items-center gap-1">
                        <Hourglass className="w-3 h-3" /> Cooldown remaining: {Math.floor(rule.remainingCooldown / 60)}m {rule.remainingCooldown % 60}s
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1"><ClipboardList className="w-3 h-3" /> Logs: {rule._count?.logs || 0}</span>
                    {rule.lastTriggeredAt && <span>Last fired: {fmtDate(rule.lastTriggeredAt)}</span>}
                    {rule.campaign && <span className="inline-flex items-center gap-1"><Target className="w-3 h-3" /> {rule.campaign.name} ({rule.campaign.status})</span>}
                  </div>

                  {/* View logs button */}
                  <button onClick={() => viewLogs(rule.id)}
                    className="mt-2 text-xs text-accent hover:text-accent/80">
                    {showLogs === rule.id ? 'Hide logs' : 'View logs'}
                  </button>

                  {/* Logs */}
                  {showLogs === rule.id && (
                    <div className="mt-3 pt-3 border-t border-surface-300">
                      {loadingLogs ? (
                        <p className="text-sm text-ink-300">Loading...</p>
                      ) : logs.length === 0 ? (
                        <p className="text-sm text-ink-300">No logs yet</p>
                      ) : (
                        <div className="max-h-60 overflow-y-auto space-y-1">
                          {logs.map((log: any) => (
                            <div key={log.id} className={`text-xs p-2 rounded ${
                              log.success ? 'bg-success-muted' : 'bg-danger-muted'
                            }`}>
                              <span className="font-medium text-ink">{fmtDate(log.triggeredAt)}</span>
                              {' — '}
                              <span className={log.success ? 'text-success' : 'text-danger'}>
                                {log.success ? 'Success' : `Failed: ${log.errorMessage || ''}`}
                              </span>
                              {' — '}
                              <span className="text-ink-300">
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
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={confirmDelete}
        title="Delete Rule"
        message={deleteConfirm ? `Are you sure you want to delete "${deleteConfirm.name}"?` : ''}
        busy={deleting}
        icon="🗑️"
        danger
      />
    </Shell>
  );
}
