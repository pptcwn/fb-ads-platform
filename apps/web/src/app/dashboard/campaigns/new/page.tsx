'use client';

import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import Shell from '@/components/Shell';
import PageHeader from '@/components/PageHeader';

const OBJECTIVES = [
  { key: 'OUTCOME_AWARENESS', label: '💡 Awareness', desc: 'Reach the most people' },
  { key: 'OUTCOME_TRAFFIC', label: '🖱️ Traffic', desc: 'Drive visits to your website' },
  { key: 'OUTCOME_ENGAGEMENT', label: '💬 Engagement', desc: 'Get more likes, comments, shares' },
  { key: 'OUTCOME_LEADS', label: '📋 Leads', desc: 'Collect leads and sign-ups' },
  { key: 'OUTCOME_SALES', label: '💰 Sales', desc: 'Drive conversions and sales' },
  { key: 'OUTCOME_APP_PROMOTION', label: '📱 App Promotion', desc: 'Promote your app installs' },
];

const OPTIMIZATION_GOALS = [
  { key: 'REACH', label: 'Reach' },
  { key: 'IMPRESSIONS', label: 'Impressions' },
  { key: 'LINK_CLICKS', label: 'Link Clicks' },
  { key: 'LANDING_PAGE_VIEWS', label: 'Landing Page Views' },
  { key: 'VALUE', label: 'Value' },
  { key: 'CONVERSIONS', label: 'Conversions' },
];

type Mode = 'wizard' | 'quick';

interface FormErrors {
  name?: string;
  dailyBudget?: string;
  adAccountId?: string;
  adName?: string;
}

// --- Helper: daily cost estimator ---
function estimateBudgetBreakdown(budget: number) {
  const estimatedDailyReach = Math.round(budget * 120);
  const estimatedCpc = budget > 0 ? (budget / (estimatedDailyReach * 0.05)).toFixed(2) : '0.00';
  const estimatedCpm = budget > 0 ? (budget / (estimatedDailyReach / 1000)).toFixed(2) : '0.00';
  const dailySpend = Math.round(budget * 100) / 100;
  return { dailySpend, estimatedDailyReach, estimatedCpc, estimatedCpm };
}

// --- Loading Spinner Component ---
function Spinner({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const sizeClass = size === 'md' ? 'w-5 h-5' : 'w-4 h-4';
  return (
    <svg className={`animate-spin ${sizeClass} text-white inline-block`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

export default function NewCampaignPage() {
  const [mode, setMode] = useState<Mode>('wizard');
  const [step, setStep] = useState(1);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const [form, setForm] = useState({
    adAccountId: '',
    name: '',
    objective: 'OUTCOME_TRAFFIC',
    dailyBudget: 300,
    status: 'PAUSED',
    adSetName: '',
    optimizationGoal: 'REACH',
    billingEvent: 'IMPRESSIONS',
    adName: '',
    creativeMessage: '',
    creativeLink: '',
    pageId: '',
    createAd: false,
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/'; return; }
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const { data } = await axios.get('/api/adaccounts');
      setAccounts(data);
      if (data.length > 0) setForm(f => ({ ...f, adAccountId: data[0].id }));
    } catch { setError('Failed to load ad accounts'); }
    finally { setLoading(false); }
  };

  // --- Validation ---
  const validate = (): FormErrors => {
    const errs: FormErrors = {};
    if (!form.name.trim()) errs.name = 'Campaign name is required';
    else if (form.name.trim().length < 2) errs.name = 'Name must be at least 2 characters';
    if (form.dailyBudget === undefined || form.dailyBudget === null || form.dailyBudget < 10)
      errs.dailyBudget = 'Daily budget must be at least 10 THB';
    if (!form.adAccountId) errs.adAccountId = 'Please select an ad account';
    if (form.createAd && !form.adName.trim()) errs.adName = 'Ad name is required when creating an ad';
    return errs;
  };

  const validateStep = (s: number): boolean => {
    const errs = validate();
    const stepErrs: FormErrors = {};
    if (s === 1) {
      if (errs.name) stepErrs.name = errs.name;
      if (errs.adAccountId) stepErrs.adAccountId = errs.adAccountId;
    }
    if (s === 2) {
      if (errs.dailyBudget) stepErrs.dailyBudget = errs.dailyBudget;
    }
    if (s === 3) {
      if (errs.adName) stepErrs.adName = errs.adName;
    }
    setErrors(errs);
    setTouched(prev => ({ ...prev, ...Object.keys(stepErrs).reduce((a, k) => ({ ...a, [k]: true }), {}) }));
    return Object.keys(stepErrs).length === 0;
  };

  const createCampaign = async () => {
    const allErrs = validate();
    setErrors(allErrs);
    setTouched({ name: true, dailyBudget: true, adAccountId: true, adName: true });
    if (Object.keys(allErrs).length > 0) return;

    setSaving(true); setError(''); setMsg('');
    try {
      const dto: any = {
        adAccountId: form.adAccountId,
        name: form.name,
        objective: form.objective,
        dailyBudget: form.dailyBudget,
        status: form.status,
      };
      if (form.adSetName) {
        dto.adSetName = form.adSetName;
        dto.optimizationGoal = form.optimizationGoal;
        dto.billingEvent = form.billingEvent;
      }
      if (form.createAd && form.adName) {
        dto.adName = form.adName;
        dto.creativeMessage = form.creativeMessage || 'Check this out!';
        dto.creativeLink = form.creativeLink || 'https://example.com';
      }
      const { data } = await axios.post('/api/campaigns', dto);
      setMsg(`🎉 Campaign created! ID: ${data.campaignId}`);
      setStep(4);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message);
    } finally { setSaving(false); }
  };

  const handleNext = (s: number) => {
    if (validateStep(s)) setStep(s + 1);
  };

  // --- Live Budget Preview ---
  const budgetPreview = useMemo(() => estimateBudgetBreakdown(form.dailyBudget), [form.dailyBudget]);

  // --- Budget Preview Card ---
  const BudgetPreview = () => (
    <div className="card p-4 mb-4">
      <h3 className="text-xs font-semibold text-accent uppercase tracking-wide mb-2">📊 Budget Preview</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <p className="text-ink-200 text-xs">Daily Spend</p>
          <p className="font-bold text-ink">฿{budgetPreview.dailySpend.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-ink-200 text-xs">Est. Daily Reach</p>
          <p className="font-bold text-ink">{budgetPreview.estimatedDailyReach.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-ink-200 text-xs">Est. CPC</p>
          <p className="font-bold text-ink">฿{budgetPreview.estimatedCpc}</p>
        </div>
        <div>
          <p className="text-ink-200 text-xs">Est. CPM</p>
          <p className="font-bold text-ink">฿{budgetPreview.estimatedCpm}</p>
        </div>
      </div>
    </div>
  );

  if (loading) return (
    <Shell>
      <div className="flex items-center justify-center py-24">
        <p className="text-ink-300">Loading...</p>
      </div>
    </Shell>
  );

  // --- Reusable Form Fields ---
  const renderNameField = () => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-ink mb-1">Campaign Name <span className="text-danger">*</span></label>
      <input
        value={form.name}
        onChange={e => { setForm({...form, name: e.target.value}); setTouched({...touched, name: true}); }}
        className={`w-full px-3 py-2 text-sm rounded-lg border bg-surface-100 text-ink placeholder-ink-200 transition-colors ${
          errors.name && touched.name ? 'border-danger' : 'border-surface-300'
        }`}
        placeholder="e.g. Summer Sale 2026"
      />
      {errors.name && touched.name && <p className="text-danger text-xs mt-1">{errors.name}</p>}
    </div>
  );

  const renderAccountField = () => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-ink mb-1">Ad Account</label>
      <select
        value={form.adAccountId}
        onChange={e => setForm({...form, adAccountId: e.target.value})}
        className={`w-full px-3 py-2 text-sm rounded-lg border bg-surface-100 text-ink transition-colors ${
          errors.adAccountId && touched.adAccountId ? 'border-danger' : 'border-surface-300'
        }`}
      >
        <option value="" className="text-ink-200">Select an account...</option>
        {accounts.map(a => <option key={a.id} value={a.id} className="text-ink">{a.name} ({a.accountId})</option>)}
      </select>
      {errors.adAccountId && touched.adAccountId && <p className="text-danger text-xs mt-1">{errors.adAccountId}</p>}
    </div>
  );

  const renderBudgetField = () => (
    <div>
      <label className="block text-sm font-medium text-ink mb-1">Daily Budget (THB) <span className="text-danger">*</span></label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-200 text-sm">฿</span>
        <input
          type="number"
          value={form.dailyBudget}
          onChange={e => { setForm({...form, dailyBudget: parseInt(e.target.value) || 0}); setTouched({...touched, dailyBudget: true}); }}
          className={`w-full pl-7 pr-3 py-2 text-sm rounded-lg border bg-surface-100 text-ink transition-colors ${
            errors.dailyBudget && touched.dailyBudget ? 'border-danger' : 'border-surface-300'
          }`}
          min={10}
          placeholder="300"
        />
      </div>
      {errors.dailyBudget && touched.dailyBudget && <p className="text-danger text-xs mt-1">{errors.dailyBudget}</p>}
    </div>
  );

  return (
    <Shell>
      <div className="px-6 py-6 max-w-4xl mx-auto">
        <PageHeader title="🎯 New Campaign" />

        {/* Quick/Wizard Mode Toggle */}
        <div className="flex items-center gap-1 bg-surface-200 p-1 rounded-lg mb-6 w-fit">
          <button
            onClick={() => setMode('wizard')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              mode === 'wizard' ? 'bg-surface-100 text-accent' : 'text-ink-200 hover:text-ink'
            }`}
          >
            📋 Wizard
          </button>
          <button
            onClick={() => setMode('quick')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              mode === 'quick' ? 'bg-surface-100 text-accent' : 'text-ink-200 hover:text-ink'
            }`}
          >
            ⚡ Quick
          </button>
        </div>

        {error && <div className="msg-error mb-6">{error}</div>}
        {msg && <div className="msg-success mb-6">{msg}</div>}

        {/* === QUICK MODE === */}
        {mode === 'quick' && (
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-ink mb-4">⚡ Quick Campaign</h2>
            <p className="text-sm text-ink-200 mb-6">Set up your campaign fast with essential fields.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
              {OBJECTIVES.map(obj => (
                <button
                  key={obj.key}
                  onClick={() => setForm({...form, objective: obj.key})}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${
                    form.objective === obj.key ? 'border-accent bg-accent-muted' : 'border-surface-300 hover:border-surface-400'
                  }`}
                >
                  <p className="font-semibold text-ink">{obj.label}</p>
                  <p className="text-xs text-ink-200 mt-1">{obj.desc}</p>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {renderAccountField()}
              {renderNameField()}
              {renderBudgetField()}
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm({...form, status: e.target.value})}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-surface-300 bg-surface-100 text-ink transition-colors"
                >
                  <option value="PAUSED" className="text-ink">⏸ Paused (start later)</option>
                  <option value="ACTIVE" className="text-ink">▶️ Active (start now)</option>
                </select>
              </div>
            </div>

            <BudgetPreview />

            <button
              onClick={createCampaign}
              disabled={saving}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <><Spinner /> Creating...</> : '🚀 Launch Campaign'}
            </button>
          </div>
        )}

        {/* === WIZARD MODE === */}
        {mode === 'wizard' && (
          <>
            {/* Enhanced Step Indicators */}
            <div className="flex items-center justify-between mb-8 px-2">
              {[
                { step: 1, label: 'Objective', icon: '🎯' },
                { step: 2, label: 'Budget', icon: '💰' },
                { step: 3, label: 'Creative', icon: '🎨' },
                { step: 4, label: 'Review', icon: '✅' },
              ].map((item, i) => {
                const isActive = step === item.step;
                const isComplete = step > item.step;
                const isLast = i === 3;
                return (
                  <div key={item.step} className="flex items-center flex-1">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                          isComplete
                            ? 'bg-success text-white'
                            : isActive
                              ? 'bg-accent text-white ring-4 ring-accent-muted'
                              : 'bg-surface-200 text-ink-200'
                        }`}
                      >
                        {isComplete ? '✓' : item.icon}
                      </div>
                      <span
                        className={`text-xs mt-1.5 font-medium ${
                          isActive ? 'text-accent' : isComplete ? 'text-success' : 'text-ink-200'
                        }`}
                      >
                        {item.label}
                      </span>
                    </div>
                    {!isLast && (
                      <div
                        className={`flex-1 h-0.5 mx-3 mt-[-1.25rem] ${
                          isComplete ? 'bg-success' : 'bg-surface-300'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {step === 1 && (
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-ink mb-4">Choose Campaign Objective</h2>
                <p className="text-sm text-ink-200 mb-4">What would you like to achieve with this campaign?</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                  {OBJECTIVES.map(obj => (
                    <button
                      key={obj.key}
                      onClick={() => setForm({...form, objective: obj.key})}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${
                        form.objective === obj.key ? 'border-accent bg-accent-muted' : 'border-surface-300 hover:border-surface-400'
                      }`}
                    >
                      <p className="font-semibold text-ink">{obj.label}</p>
                      <p className="text-xs text-ink-200 mt-1">{obj.desc}</p>
                    </button>
                  ))}
                </div>

                {renderAccountField()}
                {renderNameField()}

                <button
                  onClick={() => handleNext(1)}
                  disabled={!form.adAccountId}
                  className="btn-primary disabled:opacity-50"
                >
                  Next: Budget →
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-ink mb-4">Budget & Targeting</h2>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  {renderBudgetField()}
                  <div>
                    <label className="block text-sm font-medium text-ink mb-1">Status</label>
                    <select
                      value={form.status}
                      onChange={e => setForm({...form, status: e.target.value})}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-surface-300 bg-surface-100 text-ink transition-colors"
                    >
                      <option value="PAUSED" className="text-ink">⏸ Paused (start later)</option>
                      <option value="ACTIVE" className="text-ink">▶️ Active (start now)</option>
                    </select>
                  </div>
                </div>

                <BudgetPreview />

                <div className="border-t border-surface-300 pt-4 mb-4">
                  <label className="flex items-center gap-2 text-sm font-medium text-ink mb-3">
                    <input
                      type="checkbox"
                      checked={!!form.adSetName}
                      onChange={e => setForm({...form, adSetName: e.target.checked ? 'Ad Set 1' : ''})}
                    />
                    Create Ad Set
                  </label>
                  {form.adSetName && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-ink mb-1">Ad Set Name</label>
                        <input
                          value={form.adSetName}
                          onChange={e => setForm({...form, adSetName: e.target.value})}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-surface-300 bg-surface-100 text-ink transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-ink mb-1">Optimization Goal</label>
                        <select
                          value={form.optimizationGoal}
                          onChange={e => setForm({...form, optimizationGoal: e.target.value})}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-surface-300 bg-surface-100 text-ink transition-colors"
                        >
                          {OPTIMIZATION_GOALS.map(g => <option key={g.key} value={g.key} className="text-ink">{g.label}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setStep(1)} className="btn-secondary">← Back</button>
                  <button onClick={() => handleNext(2)} className="btn-primary">
                    Next: Creative →
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-ink mb-4">Ad Creative</h2>

                <label className="flex items-center gap-2 text-sm font-medium text-ink mb-3">
                  <input
                    type="checkbox"
                    checked={form.createAd}
                    onChange={e => setForm({...form, createAd: e.target.checked})}
                  />
                  Create an Ad
                </label>

                {form.createAd && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-ink mb-1">Ad Name</label>
                      <input
                        value={form.adName}
                        onChange={e => { setForm({...form, adName: e.target.value}); setTouched({...touched, adName: true}); }}
                        className={`w-full px-3 py-2 text-sm rounded-lg border bg-surface-100 text-ink placeholder-ink-200 transition-colors ${
                          errors.adName && touched.adName ? 'border-danger' : 'border-surface-300'
                        }`}
                        placeholder="e.g. Summer Sale Ad 1"
                      />
                      {errors.adName && touched.adName && <p className="text-danger text-xs mt-1">{errors.adName}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink mb-1">Message / Body Text</label>
                      <textarea
                        value={form.creativeMessage}
                        onChange={e => setForm({...form, creativeMessage: e.target.value})}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-surface-300 bg-surface-100 text-ink placeholder-ink-200 transition-colors"
                        rows={3}
                        placeholder="Your ad text here..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink mb-1">Destination URL</label>
                      <input
                        value={form.creativeLink}
                        onChange={e => setForm({...form, creativeLink: e.target.value})}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-surface-300 bg-surface-100 text-ink placeholder-ink-200 transition-colors"
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-3 mt-4">
                  <button onClick={() => setStep(2)} className="btn-secondary">← Back</button>
                  <button
                    onClick={createCampaign}
                    disabled={saving}
                    className="btn-primary flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? <><Spinner /> Creating...</> : '🚀 Launch Campaign'}
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="card p-12 text-center">
                <p className="text-6xl mb-4">🎉</p>
                <h2 className="text-2xl font-bold text-ink mb-2">Campaign Created!</h2>
                <p className="text-ink-200 mb-6">Your campaign has been submitted to Facebook.</p>
                <a href="/dashboard" className="btn-primary inline-block">
                  ← Back to Dashboard
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}
