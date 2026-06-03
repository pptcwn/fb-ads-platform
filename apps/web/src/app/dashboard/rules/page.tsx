'use client';

import { useEffect, useState } from 'react';
import { accountsApi, rulesApi } from '@/lib/api-client';
import { Zap, TrendingUp, TrendingDown, Bell, Pencil, Timer, Hourglass, ClipboardList, Target, RefreshCw, Trash2, Save, X } from 'lucide-react';
import Shell from '@/components/Shell';
import AutomationLayout from '@/components/layout/AutomationLayout';
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
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
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
      setSelectedRuleId(null);
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
      if (deleteConfirm.id === selectedRuleId) setSelectedRuleId(null);
      loadAll();
    } catch {}
    setDeleting(false);
  };

  const selectRule = (rule: Rule) => {
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
    setSelectedRuleId(rule.id);
  };

  const openNewRule = () => {
    resetForm();
    setEditId(null);
    setSelectedRuleId('new');
  };

  const selectedRule = selectedRuleId && selectedRuleId !== 'new'
    ? rules.find((r) => r.id === selectedRuleId)
    : null;

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

  const ruleForm = (
    <>
      <h3 className="text-lg font-semibold mb-4 text-ink inline-flex items-center gap-2">
        {editId ? <><Pencil className="w-4 h-4" /> แก้ไขกฎ</> : 'สร้างกฎใหม่'}
      </h3>
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

      <div className="flex gap-2 mt-4">
        <button onClick={saveRule} className="btn-primary btn-sm inline-flex items-center gap-1">
          {editId ? <><Save className="w-4 h-4" /> บันทึก</> : <><Save className="w-4 h-4" /> สร้างกฎ</>}
        </button>
        {selectedRule && (
          <button onClick={() => setDeleteConfirm({ id: selectedRule.id, name: selectedRule.name })}
            className="btn-danger btn-sm inline-flex items-center gap-1">
            <Trash2 className="w-4 h-4" /> ลบ
          </button>
        )}
      </div>
    </>
  );

  return (
    <Shell>
      {msg && <div className={`mb-4 ${msg.includes('✅') || msg.includes('🗑️') ? 'msg-success' : 'msg-error'}`}>{msg}<button className="float-right" onClick={() => setMsg('')}><X className="w-4 h-4" /></button></div>}
      {error && <div className="msg-error mb-4">{error}<button className="float-right" onClick={() => setError('')}><X className="w-4 h-4" /></button></div>}

      <AutomationLayout
        title="กฎอัตโนมัติ"
        subtitle={rules.length > 0 ? `${rules.length} กฎ` : undefined}
        selectedId={selectedRuleId}
        actions={
          <button onClick={openNewRule} className="btn-primary btn-sm inline-flex items-center gap-1">
            + สร้างใหม่
          </button>
        }
        list={
          rules.length === 0 ? (
            <p className="text-sm text-ink-300 text-center py-8">ยังไม่มีกฎ</p>
          ) : (
            <div className="space-y-1">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`flex items-stretch gap-1 rounded-lg transition-colors ${
                    selectedRuleId === rule.id ? 'bg-accent-muted border border-accent-border' : 'hover:bg-surface-100'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectRule(rule)}
                    className="flex-1 text-left p-3 min-w-0"
                  >
                    <span className="font-medium text-sm text-ink truncate block">{rule.name}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`badge-${rule.isEnabled ? 'success' : 'ink'} text-[10px]`}>
                        {rule.isEnabled ? 'ใช้งาน' : 'ปิด'}
                      </span>
                      <span className="text-[10px] text-ink-300">{SCOPE_LABELS[rule.scope] || rule.scope}</span>
                      <span className="text-[10px] text-ink-300">{rule.triggerCount}x</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleRule(rule.id)}
                    className={`shrink-0 self-center mx-2 btn-xs ${rule.isEnabled ? 'bg-warning-muted text-warning border border-warning-border' : 'bg-success-muted text-success border border-success-border'}`}
                    title={rule.isEnabled ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                  >
                    {rule.isEnabled ? 'ปิด' : 'เปิด'}
                  </button>
                </div>
              ))}
            </div>
          )
        }
        detail={
          selectedRuleId ? (
            <>
              <button
                type="button"
                onClick={() => setSelectedRuleId(null)}
                className="lg:hidden text-sm text-accent mb-4 inline-flex items-center gap-1"
              >
                ← กลับ
              </button>
              {ruleForm}
              {selectedRule && (
                <div className="mt-6 pt-4 border-t border-surface-300 space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {(selectedRule.conditions as RuleCondition[]).map((c, i) => (
                      <span key={i} className="px-2 py-1 bg-accent-muted text-accent text-xs rounded-md">
                        {metricLabel(c.metric)} {operatorLabel(c.operator)} {c.value}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-ink-300">
                    <span className="inline-flex items-center gap-1"><RefreshCw className="w-3 h-3" /> ทริกเกอร์ {selectedRule.triggerCount} ครั้ง</span>
                    <span className="inline-flex items-center gap-1"><ClipboardList className="w-3 h-3" /> ล็อก {selectedRule._count?.logs || 0}</span>
                    {selectedRule.campaign && (
                      <span className="inline-flex items-center gap-1"><Target className="w-3 h-3" /> {selectedRule.campaign.name}</span>
                    )}
                  </div>
                  <button onClick={() => viewLogs(selectedRule.id)} className="text-xs text-accent hover:text-accent/80">
                    {showLogs === selectedRule.id ? 'ซ่อนล็อก' : 'ดูล็อก'}
                  </button>
                  {showLogs === selectedRule.id && (
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {loadingLogs ? (
                        <p className="text-sm text-ink-300">กำลังโหลด...</p>
                      ) : logs.length === 0 ? (
                        <p className="text-sm text-ink-300">ยังไม่มีล็อก</p>
                      ) : (
                        logs.map((log: any) => (
                          <div key={log.id} className={`text-xs p-2 rounded ${log.success ? 'bg-success-muted' : 'bg-danger-muted'}`}>
                            <span className="font-medium text-ink">{fmtDate(log.triggeredAt)}</span>
                            {' — '}
                            <span className={log.success ? 'text-success' : 'text-danger'}>
                              {log.success ? 'สำเร็จ' : `ล้มเหลว: ${log.errorMessage || ''}`}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[320px] text-center text-ink-300">
              <Zap className="w-10 h-10 mb-3 text-ink-200" />
              <p>เลือกรายการจากด้านซ้าย</p>
              <button onClick={openNewRule} className="btn-primary btn-sm mt-4">+ สร้างใหม่</button>
            </div>
          )
        }
      />

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
