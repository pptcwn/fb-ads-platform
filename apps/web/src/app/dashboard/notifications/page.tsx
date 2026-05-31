'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';

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

const METRIC_LABELS: Record<string, string> = {
  BUDGET_USAGE: '💰 Budget Usage',
  INSIGHT_IMPRESSIONS: '👁️ Impressions',
  INSIGHT_CLICKS: '🖱️ Clicks',
  INSIGHT_SPEND: '💵 Spend',
  INSIGHT_CTR: '📈 CTR',
  INSIGHT_CPC: '💲 CPC',
  INSIGHT_CPA: '🎯 CPA',
  INSIGHT_ROAS: '📊 ROAS',
  CAMPAIGN_REJECTED: '❌ Campaign Rejected',
  CAMPAIGN_COMPLETED: '✅ Campaign Completed',
  TOKEN_EXPIRING: '🔑 Token Expiring',
  A_B_TEST_DONE: '🔁 A/B Test Done',
  SYNC_FAILED: '⚠️ Sync Failed',
};

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: 'border-l-4 border-red-500 bg-red-50',
  WARNING: 'border-l-4 border-yellow-500 bg-yellow-50',
  INFO: 'border-l-4 border-blue-500 bg-blue-50',
};

const CATEGORY_COLORS: Record<string, string> = {
  BUDGET: 'bg-orange-100 text-orange-700',
  PERFORMANCE: 'bg-purple-100 text-purple-700',
  CAMPAIGN: 'bg-blue-100 text-blue-700',
  TOKEN: 'bg-red-100 text-red-700',
  AB_TEST: 'bg-green-100 text-green-700',
  SYNC: 'bg-gray-100 text-gray-700',
  SYSTEM: 'bg-slate-100 text-slate-700',
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
      const token = localStorage.getItem('token');
      if (!token) { window.location.href = '/'; return; }
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      const [configsRes, alertsRes, tgRes] = await Promise.all([
        axios.get('/api/alerts/configs').catch(() => ({ data: [] })),
        axios.get('/api/alerts/history?limit=50'),
        axios.get('/api/alerts/telegram').catch(() => ({ data: null })),
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
      await axios.post('/api/alerts/init-defaults');
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
      await axios.post('/api/alerts/configs', form);
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
      await axios.post(`/api/alerts/configs/${id}/toggle`);
      await fetchAll();
    } catch { setMsg('❌ Toggle failed'); }
  };

  const deleteConfig = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await axios.delete(`/api/alerts/configs/${id}`);
      await fetchAll();
    } catch { setMsg('❌ Delete failed'); }
  };

  const markRead = async (id?: string) => {
    try {
      await axios.post('/api/alerts/history/read', id ? { id } : {});
      await fetchAll();
    } catch { setMsg('❌ Failed to mark read'); }
  };

  const deleteAlert = async (id: string) => {
    try {
      await axios.delete(`/api/alerts/history/${id}`);
      await fetchAll();
    } catch { setMsg('❌ Delete failed'); }
  };

  // ─── Telegram ───

  const saveTelegram = async () => {
    if (!tgBotToken.trim() || !tgChatId.trim()) { setMsg('❌ Bot Token and Chat ID are required'); return; }
    setTgSaving(true); setMsg('');
    try {
      await axios.post('/api/alerts/telegram', { botToken: tgBotToken.trim(), chatId: tgChatId.trim() });
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
      const { data } = await axios.post('/api/alerts/telegram/test');
      if (data.success) {
        const botSuffix = data.botName ? ' (Bot: ' + data.botName + ')' : '';
        setMsg('✅ Telegram test sent! Check your Telegram chat.' + botSuffix);
      } else {
        setMsg(`❌ ${data.error || 'Test failed'}`);
      }
    } catch (err: any) {
      setMsg(`❌ ${err?.response?.data?.message || err.message}`);
    } finally { setTgTesting(false); }
  };

  const disconnectTelegram = async () => {
    if (!confirm('Disconnect Telegram?')) return;
    try {
      await axios.delete('/api/alerts/telegram');
      setMsg('✅ Telegram disconnected');
      setTgSettings(null);
    } catch { setMsg('❌ Disconnect failed'); }
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
              <a href="/dashboard/abtest" className="text-gray-500 hover:text-gray-800">🔁 A/B Test</a>
              <a href="/dashboard/budget" className="text-gray-500 hover:text-gray-800">💰 Budget</a>
              <a href="/dashboard/notifications" className="text-blue-600 font-medium hover:text-blue-800">🔔 Alerts</a>
              <a href="/dashboard/creatives" className="text-gray-500 hover:text-gray-800">🎨 Creatives</a>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => { localStorage.removeItem('token'); window.location.href = '/'; }}
              className="text-sm text-gray-500 hover:text-red-600">Sign Out</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">🔔 Notifications</h2>
          <div className="flex gap-2">
            <button onClick={() => setTab('configs')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'configs' ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
              ⚙️ Alert Configs
            </button>
            <button onClick={() => setTab('history')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'history' ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
              📋 History {alerts.unreadCount > 0 && `(${alerts.unreadCount})`}
            </button>
            <button onClick={() => setTab('telegram')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'telegram' ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
              🤖 Telegram
            </button>
          </div>
        </div>

        {msg && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${msg.includes('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {msg}
          </div>
        )}

        {tab === 'configs' && (
          <>
            {/* Alert Configs */}
            <div className="bg-white rounded-xl shadow-sm border mb-6">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h3 className="text-lg font-semibold">⚙️ Alert Configurations</h3>
                <div className="flex gap-2">
                  <button onClick={initDefaults} disabled={saving}
                    className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-full hover:bg-green-200 disabled:opacity-50 font-medium">
                    📥 Add Defaults
                  </button>
                  <button onClick={() => setShowForm(!showForm)}
                    className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full hover:bg-blue-200 font-medium">
                    + New Config
                  </button>
                </div>
              </div>

              {showForm && (
                <div className="px-6 py-4 border-b bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Name</label>
                      <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                        placeholder="e.g. Budget alert" className="w-full border rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Metric</label>
                      <select value={form.metric} onChange={e => setForm({...form, metric: e.target.value})}
                        className="w-full border rounded-lg px-3 py-2 text-sm">
                        {Object.entries(METRIC_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Condition</label>
                      <select value={form.condition} onChange={e => setForm({...form, condition: e.target.value})}
                        className="w-full border rounded-lg px-3 py-2 text-sm">
                        <option value="ABOVE">Above</option>
                        <option value="BELOW">Below</option>
                        <option value="EQUALS">Equals</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Threshold</label>
                      <input type="number" value={form.threshold} onChange={e => setForm({...form, threshold: Number(e.target.value) || 0})}
                        className="w-full border rounded-lg px-3 py-2 text-sm" min={0} step={0.1} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Unit</label>
                      <select value={form.unit} onChange={e => setForm({...form, unit: e.target.value})}
                        className="w-full border rounded-lg px-3 py-2 text-sm">
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
                        <span className="text-sm">Notify Telegram</span>
                      </label>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-3">
                    <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                    <button onClick={createConfig} disabled={saving}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                      {saving ? 'Creating...' : 'Create'}
                    </button>
                  </div>
                </div>
              )}

              {configs.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-400">
                  No alert configs yet. Click &quot;Add Defaults&quot; to get started or create one manually.
                </div>
              ) : (
                <div className="divide-y">
                  {configs.map((cfg) => (
                    <div key={cfg.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{cfg.name}</p>
                          <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${cfg.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {cfg.enabled ? 'ON' : 'OFF'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {METRIC_LABELS[cfg.metric] || cfg.metric} · {cfg.condition} {cfg.threshold}{cfg.unit === 'percent' ? '%' : cfg.unit ? ` ${cfg.unit}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleConfig(cfg.id)}
                          className={`text-xs px-3 py-1 rounded-full font-medium ${cfg.enabled ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                          {cfg.enabled ? 'Pause' : 'Enable'}
                        </button>
                        <button onClick={() => deleteConfig(cfg.id, cfg.name)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium">
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
          <>
            {/* Alert History */}
            <div className="bg-white rounded-xl shadow-sm border mb-6">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h3 className="text-lg font-semibold">📋 Alert History</h3>
                {alerts.alerts.some(a => !a.isRead) && (
                  <button onClick={() => markRead()}
                    className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full hover:bg-blue-200 font-medium">
                    Mark All Read
                  </button>
                )}
              </div>

              {alerts.alerts.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-400">
                  No alerts yet. They will appear here when conditions are met.
                </div>
              ) : (
                <div className="divide-y">
                  {alerts.alerts.map((alert) => (
                    <div key={alert.id} className={`px-6 py-4 ${SEVERITY_STYLES[alert.severity] || 'bg-white'} ${!alert.isRead ? 'font-medium' : ''}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold">{alert.title}</p>
                            {!alert.isRead && <span className="w-2 h-2 bg-blue-500 rounded-full" title="Unread" />}
                            <span className={`px-2 py-0.5 text-[10px] rounded-full ${CATEGORY_COLORS[alert.category] || 'bg-gray-100 text-gray-700'}`}>
                              {alert.category}
                            </span>
                            <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${
                              alert.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                              alert.severity === 'WARNING' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {alert.severity}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(alert.createdAt).toLocaleString('th', { dateStyle: 'medium', timeStyle: 'short' })}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {!alert.isRead && (
                            <button onClick={() => markRead(alert.id)}
                              className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1">
                              Read
                            </button>
                          )}
                          <button onClick={() => deleteAlert(alert.id)}
                            className="text-xs text-red-500 hover:text-red-700 px-2 py-1">
                            Del
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'telegram' && (
          <>
            {/* Telegram Settings */}
            <div className="bg-white rounded-xl shadow-sm border mb-6">
              <div className="px-6 py-4 border-b">
                <h3 className="text-lg font-semibold">🤖 Telegram Integration</h3>
              </div>
              <div className="px-6 py-6">
                {tgSettings?.hasBotToken && tgSettings?.hasChatId ? (
                  <div className="space-y-4">
                    {/* Connected status */}
                    <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                      <span className="w-3 h-3 bg-green-500 rounded-full" />
                      <div>
                        <p className="font-medium text-green-800 text-sm">✅ Telegram Connected</p>
                        <p className="text-xs text-green-600">
                          Bot: {tgSettings.botTokenPreview} · Chat ID: {tgSettings.chatId}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={testTelegram} disabled={tgTesting}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                        {tgTesting ? 'Sending...' : '📨 Send Test Message'}
                      </button>
                      <button onClick={disconnectTelegram}
                        className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50">
                        🔌 Disconnect
                      </button>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                      <p className="text-sm font-medium text-blue-800">📝 How to set up:</p>
                      <ol className="text-xs text-blue-700 mt-2 list-decimal list-inside space-y-1">
                        <li>Create a bot at <a href="https://t.me/BotFather" target="_blank" className="underline">@BotFather</a> on Telegram</li>
                        <li>Get your Bot Token from BotFather</li>
                        <li>Find your Chat ID — send a message to your bot, then visit <code className="bg-blue-100 px-1 rounded">https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code></li>
                        <li>Enter new Bot Token + Chat ID below to overwrite</li>
                      </ol>
                    </div>

                    {/* Reconfigure */}
                    <div className="border-t pt-4">
                      <p className="text-sm font-medium mb-3">Update Settings</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium mb-1">Bot Token</label>
                          <input type="password" value={tgBotToken} onChange={e => setTgBotToken(e.target.value)}
                            placeholder={tgSettings.botTokenPreview || '123456:ABC-DEF...'}
                            className="w-full border rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Chat ID</label>
                          <input value={tgChatId} onChange={e => setTgChatId(e.target.value)}
                            placeholder={tgSettings.chatId || '-1001234567890'}
                            className="w-full border rounded-lg px-3 py-2 text-sm" />
                        </div>
                      </div>
                      <button onClick={saveTelegram} disabled={tgSaving || !tgBotToken.trim() || !tgChatId.trim()}
                        className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                        {tgSaving ? 'Saving...' : 'Save & Update'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Not connected */}
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
                      <p className="font-medium text-yellow-800 text-sm">⚠️ Telegram Not Connected</p>
                      <p className="text-xs text-yellow-700 mt-1">Enter your Bot Token and Chat ID to receive alerts on Telegram.</p>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                      <p className="text-sm font-medium text-blue-800">📝 How to get started:</p>
                      <ol className="text-xs text-blue-700 mt-2 list-decimal list-inside space-y-2">
                        <li>Open Telegram and search for <a href="https://t.me/BotFather" target="_blank" className="underline font-medium">@BotFather</a></li>
                        <li>Send <code className="bg-blue-100 px-1 rounded">/newbot</code> and follow the prompts</li>
                        <li>Copy the Bot Token (looks like <code className="bg-blue-100 px-1 rounded">123456:ABC-DEF...</code>)</li>
                        <li>Start a chat with your new bot and send <code className="bg-blue-100 px-1 rounded">/start</code></li>
                        <li>Find your Chat ID: visit <code className="bg-blue-100 px-1 rounded break-all">https://api.telegram.org/bot/TOKEN/getUpdates</code> in browser</li>
                        <li>Look for <code className="bg-blue-100 px-1 rounded">chat -> id: YOUR_CHAT_ID</code> in the response</li>
                      </ol>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1">Bot Token</label>
                        <input type="password" value={tgBotToken} onChange={e => setTgBotToken(e.target.value)}
                          placeholder="e.g. 7234567890:AAGhT..."
                          className="w-full border rounded-lg px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Chat ID</label>
                        <input value={tgChatId} onChange={e => setTgChatId(e.target.value)}
                          placeholder="e.g. -1001234567890 or 123456789"
                          className="w-full border rounded-lg px-3 py-2 text-sm" />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={saveTelegram} disabled={tgSaving || !tgBotToken.trim() || !tgChatId.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                        {tgSaving ? 'Saving...' : '🔗 Connect'}
                      </button>
                      <button onClick={testTelegram} disabled={tgTesting || !tgSettings?.hasBotToken}
                        className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">
                        {tgTesting ? 'Testing...' : 'Test Connection'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
