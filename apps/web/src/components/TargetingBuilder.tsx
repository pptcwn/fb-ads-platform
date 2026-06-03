'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { audiencesApi, targetingApi } from '@/lib/api-client';
import { ChevronRight, X, BarChart3, User, MapPin, Target, Users, Smartphone, Settings } from 'lucide-react';

// ─── Types ───
interface Interest { id: string; name: string; audienceSize?: number | null; }
interface Location { key: string; name: string; type: string; countryCode?: string; }
interface AudienceItem { id: string; fbAudienceId: string; name: string; type: string; approximateCount: number | null; }
export interface TargetingState {
  age_min?: number; age_max?: number; genders?: number[];
  geo_locations?: { countries?: string[]; regions?: { key: string }[]; cities?: { key: string }[]; };
  interests?: { id: string; name: string }[];
  behaviors?: { id: string; name: string }[];
  demographics?: { id: string; name: string }[];
  custom_audiences?: { id: string }[];
  excluded_custom_audiences?: { id: string }[];
  publisher_platforms?: string[];
  facebook_positions?: string[];
  device_platforms?: string[];
  targeting_optimization?: string;
}

interface Props {
  value: TargetingState;
  onChange: (v: TargetingState) => void;
  adAccountId: string;
  currency?: string;
}

// ─── Constants ───
const AGE_OPTIONS = Array.from({ length: 53 }, (_, i) => i + 13);
const PLATFORM_OPTIONS = ['facebook', 'instagram', 'messenger', 'audience_network'] as const;
const POSITION_OPTIONS = [
  { key: 'feed', label: 'Feed' },
  { key: 'story', label: 'Story' },
  { key: 'reels', label: 'Reels' },
  { key: 'instream_video', label: 'In-Stream Video' },
  { key: 'search', label: 'Search' },
  { key: 'marketplace', label: 'Marketplace' },
  { key: 'video_feeds', label: 'Video Feeds' },
  { key: 'profile_feed', label: 'Profile Feed' },
] as const;

// ─── Helpers ───
function fmtNum(n: number | null) {
  if (!n) return '-';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return n.toLocaleString();
}

// ─── Sub-components ───
function SectionCard({ title, icon, children, defaultOpen = false }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-50 transition-colors rounded-t-lg"
      >
        <span className="text-sm font-medium text-ink flex items-center gap-2">
          {icon} {title}
        </span>
        <span className="text-ink-200 text-xs transition-transform duration-150" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0)' }}>
          <ChevronRight className="w-4 h-4" />
        </span>
      </button>
      {open && <div className="px-4 pb-4 space-y-2">{children}</div>}
    </div>
  );
}

function TagPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-accent-muted text-accent border border-accent-border">
      {label}
      <button onClick={onRemove} className="hover:text-danger transition-colors"><X className="w-4 h-4" /></button>
    </span>
  );
}

// ─── Main Component ───
export default function TargetingBuilder({ value, onChange, adAccountId }: Props) {
  const [interestQuery, setInterestQuery] = useState('');
  const [interests, setInterests] = useState<Interest[]>([]);
  const [locationQuery, setLocationQuery] = useState('');
  const [locations, setLocations] = useState<Location[]>([]);
  const [audiences, setAudiences] = useState<AudienceItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [audienceSize, setAudienceSize] = useState<{ daily: number; monthly: number } | null>(null);
  const interestSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locationSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Load audiences ───
  useEffect(() => {
    audiencesApi.list().then(r => setAudiences(r.data || [])).catch(() => {});
  }, []);

  // ─── Estimate audience size ───
  useEffect(() => {
    if (!adAccountId || Object.keys(value).length === 0) return;
    const timer = setTimeout(async () => {
      try {
        const { data } = await targetingApi.estimate(value as Record<string, unknown>, adAccountId);
        setAudienceSize({ daily: data.dailyUniqueReach || 0, monthly: data.monthlyUniqueReach || 0 });
      } catch { setAudienceSize(null); }
    }, 800);
    return () => clearTimeout(timer);
  }, [value, adAccountId]);

  // ─── Interest search ───
  const doInterestSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setInterests([]); return; }
    setSearching(true);
    try {
      const { data } = await targetingApi.interests(q);
      setInterests(data || []);
    } catch { setInterests([]); }
    finally { setSearching(false); }
  }, []);

  useEffect(() => {
    if (interestSearchTimer.current) clearTimeout(interestSearchTimer.current);
    interestSearchTimer.current = setTimeout(() => doInterestSearch(interestQuery), 400);
    return () => { if (interestSearchTimer.current) clearTimeout(interestSearchTimer.current); };
  }, [interestQuery, doInterestSearch]);

  // ─── Location search ───
  const doLocationSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setLocations([]); return; }
    setSearching(true);
    try {
      const { data } = await targetingApi.locations(q, 'country,region,city');
      setLocations(data || []);
    } catch { setLocations([]); }
    finally { setSearching(false); }
  }, []);

  useEffect(() => {
    if (locationSearchTimer.current) clearTimeout(locationSearchTimer.current);
    locationSearchTimer.current = setTimeout(() => doLocationSearch(locationQuery), 400);
    return () => { if (locationSearchTimer.current) clearTimeout(locationSearchTimer.current); };
  }, [locationQuery, doLocationSearch]);

  // ─── Helpers ───
  const update = (patch: Partial<TargetingState>) => onChange({ ...value, ...patch });

  const addInterest = (item: Interest) => {
    const current = value.interests || [];
    if (current.some(i => i.id === item.id)) return;
    update({ interests: [...current, { id: item.id, name: item.name }] });
    setInterestQuery('');
    setInterests([]);
  };

  const removeInterest = (id: string) => {
    update({ interests: (value.interests || []).filter(i => i.id !== id) });
  };

  const addLocation = (loc: Location) => {
    const geo = value.geo_locations || {};
    if (loc.type === 'country') {
      const countries = [...(geo.countries || [])];
      if (!countries.includes(loc.key)) {
        update({ geo_locations: { ...geo, countries: [...countries, loc.key] } });
      }
    } else if (loc.type === 'region') {
      const regions = [...(geo.regions || [])];
      if (!regions.some(r => r.key === loc.key)) {
        update({ geo_locations: { ...geo, regions: [...regions, { key: loc.key }] } });
      }
    } else {
      const cities = [...(geo.cities || [])];
      if (!cities.some(c => c.key === loc.key)) {
        update({ geo_locations: { ...geo, cities: [...cities, { key: loc.key }] } });
      }
    }
    setLocationQuery('');
    setLocations([]);
  };

  const removeLocation = (key: string, type: string) => {
    const geo = { ...value.geo_locations };
    if (type === 'country') geo.countries = (geo.countries || []).filter(c => c !== key);
    else if (type === 'region') geo.regions = (geo.regions || []).filter(r => r.key !== key);
    else geo.cities = (geo.cities || []).filter(c => c.key !== key);
    update({ geo_locations: geo });
  };

  const toggleAudience = (fbAudienceId: string, exclude = false) => {
    const key = exclude ? 'excluded_custom_audiences' : 'custom_audiences';
    const list = value[key] || [];
    const exists = list.some(a => a.id === fbAudienceId);
    if (exists) {
      update({ [key]: list.filter(a => a.id !== fbAudienceId) });
    } else {
      update({ [key]: [...list, { id: fbAudienceId }] });
    }
  };

  return (
    <div className="space-y-3">
      {/* ─── Audience Estimate Banner ─── */}
      {audienceSize && (audienceSize.daily > 0 || audienceSize.monthly > 0) && (
        <div className="flex items-center gap-4 px-4 py-3 rounded-lg bg-surface-100 border border-surface-200 text-xs">
          <span className="text-ink-200"><BarChart3 className="w-4 h-4" /> Est. Audience</span>
          <span className="font-semibold text-ink">{fmtNum(audienceSize.daily)} <span className="text-ink-300 font-normal">daily</span></span>
          <span className="text-ink-300">·</span>
          <span className="font-semibold text-ink">{fmtNum(audienceSize.monthly)} <span className="text-ink-300 font-normal">monthly</span></span>
        </div>
      )}

      {/* ─── Age & Gender ─── */}
      <SectionCard title="Age & Gender" icon={<User className="w-4 h-4" />} defaultOpen={true}>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-ink-200 w-8">Age</span>
            <select
              value={value.age_min || 18}
              onChange={e => update({ age_min: parseInt(e.target.value) })}
              className="bg-surface-100 border border-surface-300 rounded-md px-2 py-1.5 text-xs text-ink"
            >
              {AGE_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <span className="text-xs text-ink-200">–</span>
            <select
              value={value.age_max || 65}
              onChange={e => update({ age_max: parseInt(e.target.value) })}
              className="bg-surface-100 border border-surface-300 rounded-md px-2 py-1.5 text-xs text-ink"
            >
              {AGE_OPTIONS.map(a => <option key={a} value={a}>{a}{a === 65 ? '+' : ''}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-200 w-8">Gender</span>
            {[
              { val: 1, label: '♂ Male' },
              { val: 2, label: '♀ Female' },
            ].map(g => {
              const active = (value.genders || []).includes(g.val);
              return (
                <button
                  key={g.val}
                  onClick={() => {
                    const current = value.genders || [];
                    const next = active ? current.filter(v => v !== g.val) : [...current, g.val];
                    update({ genders: next.length === 2 ? undefined : next.length === 0 ? [1, 2] : next });
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    active ? 'bg-accent-muted text-accent border border-accent-border' : 'bg-surface-100 text-ink-200 border border-surface-300 hover:border-surface-400'
                  }`}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        </div>
      </SectionCard>

      {/* ─── Locations ─── */}
      <SectionCard title="Locations" icon={<MapPin className="w-4 h-4" />}>
        <div className="relative mb-2">
          <input
            type="text"
            value={locationQuery}
            onChange={e => setLocationQuery(e.target.value)}
            placeholder="Search countries, regions, cities..."
            className="w-full bg-surface-100 border border-surface-300 rounded-md px-3 py-2 text-xs text-ink placeholder-ink-300"
          />
          {searching && <span className="absolute right-3 top-2 text-xs text-ink-300 animate-pulse">...</span>}
        </div>
        <div className="flex flex-wrap gap-1 mb-2">
          {(value.geo_locations?.countries || []).map(c => (
            <TagPill key={c} label={c} onRemove={() => removeLocation(c, 'country')} />
          ))}
          {(value.geo_locations?.regions || []).map(r => (
            <TagPill key={r.key} label={r.key} onRemove={() => removeLocation(r.key, 'region')} />
          ))}
          {(value.geo_locations?.cities || []).map(c => (
            <TagPill key={c.key} label={c.key} onRemove={() => removeLocation(c.key, 'city')} />
          ))}
        </div>
        {locations.length > 0 && (
          <div className="max-h-40 overflow-y-auto border border-surface-200 rounded-md divide-y divide-surface-200">
            {locations.map(loc => (
              <button
                key={loc.key}
                onClick={() => addLocation(loc)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-surface-100 transition-colors flex items-center justify-between group"
              >
                <span>
                  <span className="text-ink">{loc.name}</span>
                  <span className="text-ink-300 ml-1.5">· {loc.type}</span>
                  {loc.countryCode && <span className="text-ink-300 ml-1">({loc.countryCode})</span>}
                </span>
                <span className="opacity-0 group-hover:opacity-100 text-accent text-[10px]">+ Add</span>
              </button>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ─── Interests ─── */}
      <SectionCard title="Interests" icon={<Target className="w-4 h-4" />}>
        <div className="relative mb-2">
          <input
            type="text"
            value={interestQuery}
            onChange={e => setInterestQuery(e.target.value)}
            placeholder="Search interests (e.g., shopping, fitness, travel)..."
            className="w-full bg-surface-100 border border-surface-300 rounded-md px-3 py-2 text-xs text-ink placeholder-ink-300"
          />
          {searching && <span className="absolute right-3 top-2 text-xs text-ink-300 animate-pulse">...</span>}
        </div>
        <div className="flex flex-wrap gap-1 mb-2">
          {(value.interests || []).map(item => (
            <TagPill key={item.id} label={item.name} onRemove={() => removeInterest(item.id)} />
          ))}
        </div>
        {interests.length > 0 && (
          <div className="max-h-48 overflow-y-auto border border-surface-200 rounded-md divide-y divide-surface-200">
            {interests.map(item => (
              <button
                key={item.id}
                onClick={() => addInterest(item)}
                disabled={(value.interests || []).some(i => i.id === item.id)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-surface-100 transition-colors disabled:opacity-40 flex items-center justify-between group"
              >
                <span>
                  <span className="text-ink">{item.name}</span>
                  {item.audienceSize && (
                    <span className="text-ink-300 ml-2">({fmtNum(item.audienceSize)})</span>
                  )}
                </span>
                <span className="opacity-0 group-hover:opacity-100 text-accent text-[10px]">
                  {(value.interests || []).some(i => i.id === item.id) ? 'Added' : '+ Add'}
                </span>
              </button>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ─── Custom Audiences ─── */}
      <SectionCard title="Custom Audiences" icon={<Users className="w-4 h-4" />}>
        {audiences.length === 0 ? (
          <p className="text-xs text-ink-300 py-2">No audiences yet — create one in the Audiences page.</p>
        ) : (
          <div className="max-h-48 overflow-y-auto space-y-1">
            {audiences.map(a => {
              const included = (value.custom_audiences || []).some(x => x.id === a.fbAudienceId);
              const excluded = (value.excluded_custom_audiences || []).some(x => x.id === a.fbAudienceId);
              return (
                <div key={a.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-surface-100 transition-colors">
                  <div className="min-w-0">
                    <p className="text-xs text-ink truncate">{a.name}</p>
                    <p className="text-[10px] text-ink-300">{a.type} · {fmtNum(a.approximateCount)}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => toggleAudience(a.fbAudienceId, false)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                        included
                          ? 'bg-success-muted text-success border border-success-border'
                          : 'bg-surface-100 text-ink-300 border border-surface-200 hover:border-surface-400'
                      }`}
                    >
                      {included ? '✓ Include' : 'Include'}
                    </button>
                    <button
                      onClick={() => toggleAudience(a.fbAudienceId, true)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                        excluded
                          ? 'bg-danger-muted text-danger border border-danger/20'
                          : 'bg-surface-100 text-ink-300 border border-surface-200 hover:border-surface-400'
                      }`}
                    >
                      {excluded ? '✕ Exclude' : 'Exclude'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* ─── Platforms & Placements ─── */}
      <SectionCard title="Platforms & Placements" icon={<Smartphone className="w-4 h-4" />}>
        <div className="space-y-3">
          <div>
            <p className="text-[10px] text-ink-300 mb-1.5">Platforms</p>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORM_OPTIONS.map(p => {
                const active = (value.publisher_platforms || ['facebook', 'instagram']).includes(p);
                return (
                  <button
                    key={p}
                    onClick={() => {
                      const current = value.publisher_platforms || ['facebook', 'instagram'];
                      const next = active ? current.filter(v => v !== p) : [...current, p];
                      update({ publisher_platforms: next.length === 0 ? undefined : next });
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                      active ? 'bg-accent-muted text-accent border border-accent-border' : 'bg-surface-100 text-ink-200 border border-surface-300 hover:border-surface-400'
                    }`}
                  >
                    {p.replace('_', ' ')}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-[10px] text-ink-300 mb-1.5">Placements</p>
            <div className="flex flex-wrap gap-1.5">
              {POSITION_OPTIONS.map(pos => {
                const active = (value.facebook_positions || ['feed']).includes(pos.key);
                return (
                  <button
                    key={pos.key}
                    onClick={() => {
                      const current = value.facebook_positions || ['feed'];
                      const next = active ? current.filter(v => v !== pos.key) : [...current, pos.key];
                      update({ facebook_positions: next.length === 0 ? undefined : next });
                    }}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors ${
                      active ? 'bg-accent-muted text-accent border border-accent-border' : 'bg-surface-100 text-ink-200 border border-surface-300 hover:border-surface-400'
                    }`}
                  >
                    {pos.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-[10px] text-ink-300 mb-1.5">Devices</p>
            <div className="flex gap-2">
              {['mobile', 'desktop'].map(d => {
                const active = (value.device_platforms || ['mobile', 'desktop']).includes(d);
                return (
                  <button
                    key={d}
                    onClick={() => {
                      const current = value.device_platforms || ['mobile', 'desktop'];
                      const next = active ? current.filter(v => v !== d) : [...current, d];
                      update({ device_platforms: next.length === 0 ? undefined : next });
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                      active ? 'bg-accent-muted text-accent border border-accent-border' : 'bg-surface-100 text-ink-200 border border-surface-300 hover:border-surface-400'
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ─── Advanced ─── */}
      <SectionCard title="Advanced" icon={<Settings className="w-4 h-4" />}>
        <div>
          <p className="text-[10px] text-ink-300 mb-1.5">Targeting Optimization</p>
          <select
            value={value.targeting_optimization || 'none'}
            onChange={e => update({ targeting_optimization: e.target.value })}
            className="bg-surface-100 border border-surface-300 rounded-md px-3 py-2 text-xs text-ink"
          >
            <option value="none">None — strict targeting only</option>
            <option value="expansion_all">Advantage+ audience expansion</option>
            <option value="expansion_interest">Interest-based expansion</option>
            <option value="expansion_lookalike">Lookalike expansion</option>
          </select>
        </div>
      </SectionCard>
    </div>
  );
}
