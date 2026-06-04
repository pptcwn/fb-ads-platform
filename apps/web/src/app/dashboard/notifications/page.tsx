'use client';

import { useEffect, useState, useCallback } from 'react';
import { alertsApi } from '@/lib/api-client';
import PageLayout from '@/components/layout/PageLayout';
import {
  Settings,
  ClipboardList,
  Bot,
  Download,
  Send,
  Unplug,
  FileText,
  Link,
  Wallet,
  Eye,
  MousePointer,
  DollarSign,
  TrendingUp,
  Target,
  BarChart3,
  XCircle,
  CheckCircle,
  Key,
  RefreshCw,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';

interface AlertConfig {
  id: string;
  name: string;
  metric: string;
  condition: string;
  threshold: number | null;
  unit: string | null;
  campaignId: string | null;
  adAccountId: string | null;
  enabled: boolean;
  notifyTelegram: boolean;
  createdAt: string;
}

interface AlertItem {
  id: string;
  title: string;
  message: string;
  severity: string;
  category: string;
  isRead: boolean;
  createdAt: string;
  metadata: any;
}

const METRIC_META: Record<string, { label: string; icon: LucideIcon }> = {
  BUDGET_USAGE: { label: 'Budget Usage', icon: Wallet },
  INSIGHT_IMPRESSIONS: { label: 'Impressions', icon: Eye },
  INSIGHT_CLICKS: { label: 'Clicks', icon: MousePointer },
  INSIGHT_SPEND: { label: 'Spend', icon: DollarSign },
  INSIGHT_CTR: { label: 'CTR', icon: TrendingUp },
  INSIGHT_CPC: { label: 'CPC', icon: DollarSign },
  INSIGHT_CPA: { label: 'CPA', icon: Target },
  INSIGHT_ROAS: { label: 'ROAS', icon: BarChart3 },
  CAMPAIGN_REJECTED: { label: 'Campaign Rejected', icon: XCircle },
  CAMPAIGN_COMPLETED: { label: 'Campaign Completed', icon: CheckCircle },
  TOKEN_EXPIRING: { label: 'Token Expiring', icon: Key },
  A_B_TEST_DONE: { label: 'A/B Test Done', icon: RefreshCw },
  SYNC_FAILED: { label: 'Sync Failed', icon: AlertTriangle },
};

function metricLabel(metric: string) {
  return METRIC_META[metric]?.label ?? metric;
}

function MetricIcon({ metric, className = 'w-3.5 h-3.5' }: { metric: string; className?: string }) {
  const Icon = METRIC_META[metric]?.icon;
  if (!Icon) return null;
  return <Icon className={className} aria-hidden />;
}

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: 'border-l-4 border-danger bg-danger-muted',
  WARNING: 'border-l-4 border-warning bg-warning-muted',
  INFO: 'border-l-4 border-brand bg-brand-muted',
};

const CATEGORY_COLORS: Record<string, string> = {
  BUDGET: 'bg-warning-muted text-warning border border-warning-border',
  PERFORMANCE: 'bg-surface-100 text-ink border border-surface-200',
  CAMPAIGN: 'bg-brand-muted text-brand border border-brand-border',
  TOKEN: 'badge-danger',
  AB_TEST: 'bg-success-muted text-success border border-success-border',
  SYNC: 'badge-ink',
  SYSTEM: 'badge-ink',
};

export default function NotificationsPage() {
  const [tab, setTab] = useState<'configs' | 'history' | 'telegram'>('configs');
  const [configs, setConfigs] = useState<AlertConfig[]>([]);
  const [alerts, setAlerts] = useState<{ alerts: AlertItem[]; unreadCount: number }>({ alerts: [], unreadCount: 0 });
  const [loading, setLoading] = useState(true);

  // Create config form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', metric: 'BUDGET_USAGE', condition: 'ABOVE', threshold: 80, unit: 'percent', notifyTelegram: false });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // Telegram
  const [tgSettings, setTgSettings] = useState<{ hasBotToken: boolean; hasChatId: boolean; chatId: string | null; botTokenPreview: string | null } | null>(null);
  const [tgBotToken, setTgBotToken] = useState('');
  const [tgChatId, setTgChatId] = useState('');
  const [tgTesting, setTgTesting] = useState(false);
  const [tgSaving, setTgSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [configsRes, alertsRes, tgRes] = await Promise.all([
        alertsApi.listConfigs().catch(() => ({ data: [] })),
        alertsApi.history(50).catch(() => ({ data: { alerts: [], unreadCount: 0 } })),
        alertsApi.getTelegram().catch(() => ({ data: null })),
      ]);
      setConfigs(configsRes.data);
      setAlerts(alertsRes.data);
      if (tgRes.data) setTgSettings(tgRes.data);
    } catch { setMsg('❌ Failed to load data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Initialize default configs
  const initDefaults = async () => {
    setSaving(true);
    try {
      await alertsApi.initDefaults();
      setMsg('✅ Default configs created!');
      await fetchAll();
    } catch (err: any) {
      setMsg(`❌ ${err?.response?.data?.message || err.message}`);
    } finally { setSaving(false); }
  };

  const createConfig = async () => {
    if (!form.name.trim()) { setMsg('❌ Please enter a name'); return; }
    setSaving(true); setMsg('');
    try {
      await alertsApi.createConfig(form);
      setMsg('✅ Config created!');
      setShowForm(false);
      setForm({ name: '', metric: 'BUDGET_USAGE', condition: 'ABOVE', threshold: 80, unit: 'percent', notifyTelegram: false });
      await fetchAll();
    } catch (err: any) {
      setMsg(`❌ ${err?.response?.data?.message || err.message}`);
    } finally { setSaving(false); }
  };

  const toggleConfig = async (id: string) => {
    try {
      await alertsApi.toggleConfig(id);
      await fetchAll();
    } catch { setMsg('❌ Toggle failed'); }
  };

  const deleteConfig = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await alertsApi.deleteConfig(id);
      await fetchAll();
    } catch { setMsg('❌ Delete failed'); }
  };

  const markRead = async (id?: string) => {
    try {
      await alertsApi.markHistoryRead(id);
      await fetchAll();
    } catch { setMsg('❌ Failed to mark read'); }
  };

  const handleAlertClick = async (alert: AlertItem) => {
    if (alert.isRead) return;
    await markRead(alert.id);
  };

  const deleteAlert = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await alertsApi.deleteHistory(id);
      await fetchAll();
    } catch { setMsg('❌ Delete failed'); }
  };

  // ─── Telegram ───

  const saveTelegram = async () => {
    if (!tgBotToken.trim() || !tgChatId.trim()) { setMsg('❌ Bot Token and Chat ID are required'); return; }
    setTgSaving(true); setMsg('');
    try {
      await alertsApi.saveTelegram(tgBotToken.trim(), tgChatId.trim());
      setMsg('✅ Telegram settings saved!');
      setTgBotToken('');
      setTgChatId('');
      await fetchAll();
    } catch (err: any) {
      setMsg(`❌ ${err?.response?.data?.message || err.message}`);
    } finally { setTgSaving(false); }
  };

  const testTelegram = async () => {
    setTgTesting(true); setMsg('');
    try {
      const { data } = await alertsApi.testTelegram();
      const result = data as { success?: boolean; error?: string; botName?: string };
      if (result.success) {
        const botSuffix = result.botName ? ' (Bot: ' + result.botName + ')' : '';
        setMsg('✅ Telegram test sent! Check your Telegram chat.' + botSuffix);
      } else {
        setMsg(`❌ ${result.error || 'Test failed'}`);
      }
    } catch (err: any) {
      setMsg(`❌ ${err?.response?.data?.message || err.message}`);
    } finally { setTgTesting(false); }
  };

  const disconnectTelegram = async () => {
    if (!confirm('Disconnect Telegram?')) return;
    try {
      await alertsApi.disconnectTelegram();
      setMsg('✅ Telegram disconnected');
      setTgSettings(null);
    } catch { setMsg('❌ Disconnect failed'); }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-ink-300 animate-pulse">Loading notifications...</p>
      </div>
    );

  const tabButtons = (
    <div className="flex gap-2 flex-wrap">
      <button
        type="button"
        onClick={() => setTab('configs')}
        className={`btn-sm inline-flex items-center gap-1.5 ${tab === 'configs' ? 'btn-primary' : 'btn-secondary'}`}
      >
        <Settings className="w-4 h-4" /> ตั้งค่า
      </button>
      <button
        type="button"
        onClick={() => setTab('history')}
        className={`btn-sm inline-flex items-center gap-1.5 ${tab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
      >
        <ClipboardList className="w-4 h-4" /> ประวัติ
        {alerts.unreadCount > 0 && (
          <span className="ml-0.5 px-1.5 py-0.5 text-[10px] rounded-full bg-brand text-white font-medium">
            {alerts.unreadCount}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={() => setTab('telegram')}
        className={`btn-sm inline-flex items-center gap-1.5 ${tab === 'telegram' ? 'btn-primary' : 'btn-secondary'}`}
      >
        <Bot className="w-4 h-4" /> Telegram
      </button>
    </div>
  );

  return (
    <div className="p-6">
        <PageLayout
          title="การแจ้งเตือน"
          subtitle={alerts.unreadCount > 0 ? `${alerts.unreadCount} ยังไม่อ่าน` : undefined}
          actions={tabButtons}
        >
          {msg && <div className={`${msg.includes('✅') ? 'msg-success' : 'msg-error'}`}>{msg}</div>}

          {tab === 'configs' && (
            <>
              <div className="card">
                <div className="px-6 py-4 flex items-center justify-between border-b border-surface-300">
                  <h3 className="text-sm font-semibold text-ink inline-flex items-center gap-2">
                    <Settings className="w-4 h-4" /> Alert Configurations
                  </h3>
                  <div className="flex gap-2">
                    <button onClick={initDefaults} disabled={saving}
                      className="btn-sm bg-success-muted text-success border border-success-border hover:bg-success/20 disabled:opacity-50 font-medium">
                      <Download className="w-4 h-4" /> Add Defaults
                    </button>
                    <button onClick={() => setShowForm(!showForm)}
                      className="btn-sm bg-brand-muted text-brand border border-brand-border hover:bg-brand/20 font-medium">
                      + New Config
                    </button>
                  </div>
                </div>

                {showForm && (
                  <div className="px-6 py-4 bg-surface-50 border-b border-surface-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-ink mb-1">Name</label>
                        <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                          placeholder="e.g. Budget alert" className="w-full px-3 py-2 text-sm bg-white text-ink" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-ink mb-1">Metric</label>
                        <select value={form.metric} onChange={e => setForm({...form, metric: e.target.value})}
                          className="w-full px-3 py-2 text-sm bg-white text-ink">
                          {Object.entries(METRIC_META).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-ink mb-1">Condition</label>
                        <select value={form.condition} onChange={e => setForm({...form, condition: e.target.value})}
                          className="w-full px-3 py-2 text-sm bg-white text-ink">
                          <option value="ABOVE">Above</option>
                          <option value="BELOW">Below</option>
                          <option value="EQUALS">Equals</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-ink mb-1">Threshold</label>
                        <input type="number" value={form.threshold} onChange={e => setForm({...form, threshold: Number(e.target.value) || 0})}
                          className="w-full px-3 py-2 text-sm bg-white text-ink" min={0} step={0.1} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-ink mb-1">Unit</label>
                        <select value={form.unit} onChange={e => setForm({...form, unit: e.target.value})}
                          className="w-full px-3 py-2 text-sm bg-white text-ink">
                          <option value="percent">Percent</option>
                          <option value="amount">Amount</option>
                          <option value="days">Days</option>
                          <option value="ratio">Ratio</option>
                          <option value="">None</option>
                        </select>
                      </div>
                      <div className="flex items-end pb-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={form.notifyTelegram} onChange={e => setForm({...form, notifyTelegram: e.target.checked})}
                            className="rounded" />
                          <span className="text-sm text-ink">Notify Telegram</span>
                        </label>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-3">
                      <button onClick={() => setShowForm(false)} className="btn-secondary btn-sm">Cancel</button>
                      <button onClick={createConfig} disabled={saving}
                        className="btn-primary btn-sm">
                        {saving ? 'Creating...' : 'Create'}
                      </button>
                    </div>
                  </div>
                )}

                {configs.length === 0 ? (
                  <div className="px-6 py-8 text-center text-ink-300">
                    No alert configs yet. Click &quot;Add Defaults&quot; to get started or create one manually.
                  </div>
                ) : (
                  <div className="divide-y" style={{ boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.06)' }}>
                    {configs.map((cfg) => (
                      <div key={cfg.id} className="px-6 py-4 flex items-center justify-between hover:bg-surface-100">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm text-ink">{cfg.name}</p>
                            <span className={`badge-${cfg.enabled ? 'success' : 'ink'} text-[10px]`}>
                              {cfg.enabled ? 'ON' : 'OFF'}
                            </span>
                          </div>
                          <p className="text-xs text-ink-300 mt-0.5 inline-flex items-center gap-1.5">
                            <MetricIcon metric={cfg.metric} />
                            {metricLabel(cfg.metric)} · {cfg.condition} {cfg.threshold}{cfg.unit === 'percent' ? '%' : cfg.unit ? ` ${cfg.unit}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => toggleConfig(cfg.id)}
                            className={`btn-xs ${cfg.enabled ? 'btn-secondary' : 'bg-success-muted text-success border border-success-border hover:bg-success/20'}`}>
                            {cfg.enabled ? 'Pause' : 'Enable'}
                          </button>
                          <button onClick={() => deleteConfig(cfg.id, cfg.name)}
                            className="btn-xs text-danger hover:text-danger/80 font-medium">
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {tab === 'history' && (
            <div className="card overflow-hidden">
              <div className="px-6 py-4 flex items-center justify-between border-b border-surface-300">
                <h3 className="text-sm font-semibold text-ink inline-flex items-center gap-2">
                  <ClipboardList className="w-4 h-4" /> ประวัติการแจ้งเตือน
                </h3>
                {alerts.alerts.some(a => !a.isRead) && (
                  <button
                    type="button"
                    onClick={() => markRead()}
                    className="btn-sm bg-brand-muted text-brand border border-brand-border hover:bg-brand/20 font-medium"
                  >
                    อ่านทั้งหมด
                  </button>
                )}
              </div>

              {alerts.alerts.length === 0 ? (
                <div className="px-6 py-8 text-center text-ink-300">
                  ยังไม่มีการแจ้งเตือน — จะแสดงที่นี่เมื่อเงื่อนไขถูกต้อง
                </div>
              ) : (
                <ul className="divide-y divide-surface-300" role="list">
                  {alerts.alerts.map((alert) => (
                    <li key={alert.id}>
                      <button
                        type="button"
                        onClick={() => handleAlertClick(alert)}
                        className={`w-full text-left px-6 py-4 transition-colors hover:bg-surface-100 ${
                          SEVERITY_STYLES[alert.severity] || ''
                        } ${!alert.isRead ? 'bg-surface-50/80' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {!alert.isRead && (
                                <span
                                  className="w-2 h-2 shrink-0 bg-brand rounded-full"
                                  title="ยังไม่อ่าน"
                                  aria-hidden
                                />
                              )}
                              <p className={`text-sm truncate ${!alert.isRead ? 'font-semibold text-ink' : 'font-medium text-ink-200'}`}>
                                {alert.title}
                              </p>
                              <span className={`px-2 py-0.5 text-[10px] rounded-full ${CATEGORY_COLORS[alert.category] || 'badge-ink'}`}>
                                {alert.category}
                              </span>
                              <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${
                                alert.severity === 'CRITICAL' ? 'badge-danger' :
                                alert.severity === 'WARNING' ? 'badge-warning' : 'bg-brand-muted text-brand border border-brand-border'
                              }`}>
                                {alert.severity}
                              </span>
                            </div>
                            <p className={`text-sm mt-1 ${!alert.isRead ? 'text-ink' : 'text-ink-200'}`}>{alert.message}</p>
                            <p className="text-xs text-ink-300 mt-1">
                              {new Date(alert.createdAt).toLocaleString('th', { dateStyle: 'medium', timeStyle: 'short' })}
                            </p>
                          </div>
                          <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                            {!alert.isRead && (
                              <button
                                type="button"
                                onClick={() => markRead(alert.id)}
                                className="btn-xs text-brand hover:text-brand/80"
                              >
                                อ่านแล้ว
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => deleteAlert(alert.id, e)}
                              className="btn-xs text-danger hover:text-danger/80"
                            >
                              ลบ
                            </button>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === 'telegram' && (
            <div className="card">
              <div className="px-6 py-4 border-b border-surface-300">
                <h3 className="text-sm font-semibold text-ink inline-flex items-center gap-2">
                  <Bot className="w-4 h-4" /> Telegram Integration
                </h3>
              </div>
              <div className="px-6 py-6">
                {tgSettings?.hasBotToken && tgSettings?.hasChatId ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 bg-success-muted border border-success-border rounded-lg px-4 py-3">
                      <span className="w-3 h-3 bg-success rounded-full" />
                      <div>
                        <p className="font-medium text-sm text-success">Telegram Connected</p>
                        <p className="text-xs text-success/80">
                          Bot: {tgSettings.botTokenPreview} · Chat ID: {tgSettings.chatId}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={testTelegram} disabled={tgTesting}
                        className="btn-primary btn-sm">
                        {tgTesting ? 'Sending...' : <><Send className="w-4 h-4" /> Send Test Message</>}
                      </button>
                      <button onClick={disconnectTelegram}
                        className="btn-sm border border-danger-border text-danger hover:bg-danger-muted">
                        <Unplug className="w-4 h-4" /> Disconnect
                      </button>
                    </div>

                    <div className="bg-brand-muted border border-brand-border rounded-lg px-4 py-3">
                      <p className="text-sm font-medium text-brand inline-flex items-center gap-1">
                        <FileText className="w-4 h-4" /> How to set up:
                      </p>
                      <ol className="text-xs text-brand/80 mt-2 list-decimal list-inside space-y-1">
                        <li>Create a bot at <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="underline">@BotFather</a> on Telegram</li>
                        <li>Get your Bot Token from BotFather</li>
                        <li>Find your Chat ID — send a message to your bot, then visit <code className="bg-brand-muted px-1 rounded">https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code></li>
                        <li>Enter new Bot Token + Chat ID below to overwrite</li>
                      </ol>
                    </div>

                    <div className="pt-4 border-t border-surface-300">
                      <p className="text-sm font-medium text-ink mb-3">Update Settings</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-ink mb-1">Bot Token</label>
                          <input type="password" value={tgBotToken} onChange={e => setTgBotToken(e.target.value)}
                            placeholder={tgSettings.botTokenPreview || '123456:ABC-DEF...'}
                            className="w-full px-3 py-2 text-sm bg-surface-50 text-ink" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-ink mb-1">Chat ID</label>
                          <input value={tgChatId} onChange={e => setTgChatId(e.target.value)}
                            placeholder={tgSettings.chatId || '-1001234567890'}
                            className="w-full px-3 py-2 text-sm bg-surface-50 text-ink" />
                        </div>
                      </div>
                      <button onClick={saveTelegram} disabled={tgSaving || !tgBotToken.trim() || !tgChatId.trim()}
                        className="mt-3 btn-primary btn-sm">
                        {tgSaving ? 'Saving...' : 'Save & Update'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-warning-muted border border-warning-border rounded-lg px-4 py-3">
                      <p className="font-medium text-sm text-warning">Telegram Not Connected</p>
                      <p className="text-xs text-warning/80 mt-1">Enter your Bot Token and Chat ID to receive alerts on Telegram.</p>
                    </div>

                    <div className="bg-brand-muted border border-brand-border rounded-lg px-4 py-3">
                      <p className="text-sm font-medium text-brand inline-flex items-center gap-1">
                        <FileText className="w-4 h-4" /> How to get started:
                      </p>
                      <ol className="text-xs text-brand/80 mt-2 list-decimal list-inside space-y-2">
                        <li>Open Telegram and search for <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="underline font-medium">@BotFather</a></li>
                        <li>Send <code className="bg-brand-muted px-1 rounded">/newbot</code> and follow the prompts</li>
                        <li>Copy the Bot Token (looks like <code className="bg-brand-muted px-1 rounded">123456:ABC-DEF...</code>)</li>
                        <li>Start a chat with your new bot and send <code className="bg-brand-muted px-1 rounded">/start</code></li>
                        <li>Find your Chat ID: visit <code className="bg-brand-muted px-1 rounded break-all">https://api.telegram.org/bot/TOKEN/getUpdates</code> in browser</li>
                        <li>Look for <code className="bg-brand-muted px-1 rounded">chat -&gt; id: YOUR_CHAT_ID</code> in the response</li>
                      </ol>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-ink mb-1">Bot Token</label>
                        <input type="password" value={tgBotToken} onChange={e => setTgBotToken(e.target.value)}
                          placeholder="e.g. 7234567890:AAGhT..."
                          className="w-full px-3 py-2 text-sm bg-surface-50 text-ink" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-ink mb-1">Chat ID</label>
                        <input value={tgChatId} onChange={e => setTgChatId(e.target.value)}
                          placeholder="e.g. -1001234567890 or 123456789"
                          className="w-full px-3 py-2 text-sm bg-surface-50 text-ink" />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={saveTelegram} disabled={tgSaving || !tgBotToken.trim() || !tgChatId.trim()}
                        className="btn-primary btn-sm">
                        {tgSaving ? 'Saving...' : <><Link className="w-4 h-4" /> Connect</>}
                      </button>
                      <button onClick={testTelegram} disabled={tgTesting || !tgSettings?.hasBotToken}
                        className="btn-secondary btn-sm">
                        {tgTesting ? 'Testing...' : 'Test Connection'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </PageLayout>
      </div>
    );
}