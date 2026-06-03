# Targeting Builder — Implementation Plan

> **For Hermes:** Use this plan task-by-task. Each task is self-contained with exact file paths and code.

**Goal:** Replace `targeting?: any` with a full targeting UI in campaign creation wizard + validated DTO + Facebook targeting search endpoints.

**Architecture:** Backend adds targeting search endpoints (interests, locations, demographics) via Facebook Graph API, Zod validation for targeting JSON, and a new `targeting` field shape in CreateCampaignDto. Frontend adds a `TargetingBuilder` component (age, gender, locations, interests, custom audiences, platforms) wired into Wizard step 2 and Quick mode.

**Tech Stack:** NestJS + Zod, Next.js 14 + Tailwind, Facebook Graph API `/search`, Prisma for audience lookup

---

## Pre-Flight Checks

```bash
cd /opt/fb-ads-platform
git status                     # should be clean except docker-compose.yml
docker compose ps              # all services running
curl -s localhost:4001/api/health  # API healthy
curl -s -o /dev/null -w "%{http_code}" localhost:3001/dashboard  # 200
```

---

### Task 1: Add Zod + targeting search endpoints to FacebookService

**Objective:** Add methods for searching Facebook targeting options (interests, locations, demographics) and estimate audience size.

**Files:**
- Modify: `apps/api/src/facebook/facebook.service.ts` — add 4 new methods
- No new files yet

**Step 1: Add targeting search methods to FacebookService**

Open `facebook.service.ts` and add these methods AFTER the existing `createAdSet` method (after line ~364):

```typescript
  // ─── Targeting Search ───

  async searchTargetingInterests(query: string, accessToken: string, limit = 25) {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.baseUrl.replace('/v22.0', '/v22.0')}search`, {
          params: {
            type: 'adinterest',
            q: query,
            limit,
            access_token: accessToken,
          },
        }),
      );
      return (data?.data || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        audienceSize: item.audience_size_lower_bound || item.audience_size || null,
        topic: item.topic || null,
        path: item.path || [],
      }));
    } catch (err: any) {
      this.logger.error(`Failed to search interests: ${err?.response?.data?.error?.message || err.message}`);
      throw new InternalServerErrorException('Failed to search targeting interests');
    }
  }

  async searchTargetingLocations(query: string, accessToken: string, locationTypes: string[] = ['country', 'region', 'city'], limit = 25) {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.baseUrl.replace('/v22.0', '/v22.0')}search`, {
          params: {
            type: 'adgeolocation',
            q: query,
            location_types: JSON.stringify(locationTypes),
            limit,
            access_token: accessToken,
          },
        }),
      );
      return (data?.data || []).map((item: any) => ({
        key: item.key,
        name: item.name,
        type: item.type,
        countryCode: item.country_code || null,
        countryName: item.country_name || null,
        region: item.region || null,
        regionId: item.region_id || null,
      }));
    } catch (err: any) {
      this.logger.error(`Failed to search locations: ${err?.response?.data?.error?.message || err.message}`);
      throw new InternalServerErrorException('Failed to search locations');
    }
  }

  async searchTargetingDemographics(query: string, accessToken: string, limit = 25) {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.baseUrl.replace('/v22.0', '/v22.0')}search`, {
          params: {
            type: 'addemographic',
            q: query,
            limit,
            access_token: accessToken,
          },
        }),
      );
      return (data?.data || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        type: item.type || null,
        audienceSize: item.audience_size_lower_bound || item.audience_size || null,
      }));
    } catch (err: any) {
      this.logger.error(`Failed to search demographics: ${err?.response?.data?.error?.message || err.message}`);
      throw new InternalServerErrorException('Failed to search demographics');
    }
  }

  async estimateAudienceSize(targeting: any, accessToken: string, adAccountId: string) {
    try {
      const { data } = await firstValueFrom(
        this.http.post(`${this.baseUrl}/act_${adAccountId}/delivery_estimate`, null, {
          params: {
            targeting: JSON.stringify(targeting),
            optimization_goal: 'REACH',
            access_token: accessToken,
          },
        }),
      );
      return {
        dailyUniqueReach: data?.data?.[0]?.estimate_dau || 0,
        monthlyUniqueReach: data?.data?.[0]?.estimate_mau || 0,
      };
    } catch (err: any) {
      this.logger.warn(`Failed to estimate audience: ${err?.response?.data?.error?.message || err.message}`);
      return { dailyUniqueReach: 0, monthlyUniqueReach: 0 };
    }
  }
```

**Step 2: Verify no syntax errors**

```bash
cd /opt/fb-ads-platform
docker compose restart api
sleep 5
docker compose logs api --tail 10
# Expected: "Nest application successfully started" — no errors
```

---

### Task 2: Create TargetingController with search endpoints

**Objective:** Expose targeting search as REST endpoints so the frontend can query interests/locations/demographics.

**Files:**
- Create: `apps/api/src/campaigns/targeting.controller.ts`
- Modify: `apps/api/src/campaigns/campaigns.module.ts`

**Step 1: Create targeting controller**

```typescript
// apps/api/src/campaigns/targeting.controller.ts
import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FacebookService } from '../facebook/facebook.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('targeting')
@UseGuards(AuthGuard('jwt'))
export class TargetingController {
  constructor(
    private readonly facebookService: FacebookService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('interests')
  async searchInterests(@Query('q') query: string, @Req() req: any) {
    if (!query || query.length < 2) return [];
    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId: req.user.id } });
    if (!fbUser) return [];
    const token = await this.facebookService.getDecryptedToken(fbUser.id);
    return this.facebookService.searchTargetingInterests(query, token);
  }

  @Get('locations')
  async searchLocations(
    @Query('q') query: string,
    @Query('types') types: string,
    @Req() req: any,
  ) {
    if (!query || query.length < 2) return [];
    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId: req.user.id } });
    if (!fbUser) return [];
    const token = await this.facebookService.getDecryptedToken(fbUser.id);
    const locationTypes = types ? types.split(',') : ['country', 'region', 'city'];
    return this.facebookService.searchTargetingLocations(query, token, locationTypes);
  }

  @Get('demographics')
  async searchDemographics(@Query('q') query: string, @Req() req: any) {
    if (!query || query.length < 2) return [];
    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId: req.user.id } });
    if (!fbUser) return [];
    const token = await this.facebookService.getDecryptedToken(fbUser.id);
    return this.facebookService.searchTargetingDemographics(query, token);
  }

  @Get('estimate')
  async estimateAudience(
    @Query('targeting') targetingJson: string,
    @Query('adAccountId') adAccountId: string,
    @Req() req: any,
  ) {
    if (!targetingJson) return { dailyUniqueReach: 0, monthlyUniqueReach: 0 };
    const fbUser = await this.prisma.fbUser.findFirst({ where: { userId: req.user.id } });
    if (!fbUser) return { dailyUniqueReach: 0, monthlyUniqueReach: 0 };
    const token = await this.facebookService.getDecryptedToken(fbUser.id);
    const targeting = JSON.parse(targetingJson);
    const account = await this.prisma.adAccount.findFirst({
      where: { id: adAccountId, fbUser: { userId: req.user.id } },
    });
    const fbAccountId = account ? account.accountId.replace('act_', '') : '';
    return this.facebookService.estimateAudienceSize(targeting, token, fbAccountId);
  }
}
```

**Step 2: Wire into module**

Open `campaigns.module.ts`, add `TargetingController` to the controllers array:

```typescript
import { TargetingController } from './targeting.controller';

@Module({
  controllers: [
    CampaignsController,
    TargetingController,  // <-- add this line
  ],
  // ... rest stays the same
})
```

**Step 3: Verify**

```bash
docker compose restart api
sleep 5
docker compose logs api --tail 10
# Expected: "Nest application successfully started"
# Test: curl -s "http://localhost:4001/api/targeting/interests?q=shopping" -H "Authorization: Bearer <token>"
```

---

### Task 3: Add Zod validation for targeting DTO

**Objective:** Replace `targeting?: any` with a structured, validated targeting type.

**Files:**
- Create: `apps/api/src/campaigns/dto/targeting.schema.ts`
- Modify: `apps/api/src/campaigns/dto/create-campaign.dto.ts`
- Modify: `apps/api/src/campaigns/campaigns.service.ts` (line 64)

**Step 1: Create Zod targeting schema**

```typescript
// apps/api/src/campaigns/dto/targeting.schema.ts
import { z } from 'zod';

export const GeoSchema = z.object({
  countries: z.array(z.string()).optional(),
  regions: z.array(z.object({ key: z.string() })).optional(),
  cities: z.array(z.object({ key: z.string() })).optional(),
  zips: z.array(z.object({ key: z.string() })).optional(),
  location_types: z.array(z.enum(['home', 'recent', 'traveling'])).optional(),
});

export const TargetingSchema = z.object({
  geo_locations: GeoSchema.optional(),
  age_min: z.number().min(13).max(65).optional(),
  age_max: z.number().min(13).max(65).optional(),
  genders: z.array(z.number().refine(v => [0, 1, 2].includes(v))).optional(),
  interests: z.array(z.object({
    id: z.string(),
    name: z.string(),
  })).optional(),
  behaviors: z.array(z.object({
    id: z.string(),
    name: z.string(),
  })).optional(),
  demographics: z.array(z.object({
    id: z.string(),
    name: z.string(),
  })).optional(),
  custom_audiences: z.array(z.object({ id: z.string() })).optional(),
  excluded_custom_audiences: z.array(z.object({ id: z.string() })).optional(),
  publisher_platforms: z.array(z.enum(['facebook', 'instagram', 'messenger', 'audience_network'])).optional(),
  facebook_positions: z.array(z.enum([
    'feed', 'story', 'instream_video', 'search', 'marketplace',
    'video_feeds', 'reels', 'profile_feed',
  ])).optional(),
  device_platforms: z.array(z.enum(['mobile', 'desktop'])).optional(),
  targeting_optimization: z.enum(['none', 'expansion_all', 'expansion_interest', 'expansion_lookalike']).optional(),
});

export type TargetingDto = z.infer<typeof TargetingSchema>;

export function validateTargeting(data: unknown): TargetingDto {
  return TargetingSchema.parse(data);
}
```

**Step 2: Update CreateCampaignDto**

Replace `targeting?: any` with this in `create-campaign.dto.ts`:

```typescript
import { IsObject, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// Remove the old line 34-35 (@IsOptional() targeting?: any;)
// Add:
  @IsOptional()
  @IsObject()
  targeting?: Record<string, any>;
```

**Step 3: Add validation in service**

In `campaigns.service.ts`, after importing:

```typescript
import { TargetingSchema } from './dto/targeting.schema';

// Inside create() method, BEFORE the targeting line (~line 59):
// Replace:
//   dto.targeting || { geo_locations: { countries: ['TH'] } }
// With:
    const targeting = dto.targeting
      ? TargetingSchema.parse(dto.targeting)
      : { geo_locations: { countries: ['TH'] } };
```

Then use `targeting` variable instead of the inline expression on line 64.

---

### Task 4: Build TargetingBuilder frontend component

**Objective:** Create the main targeting configuration UI component with subsections for each targeting dimension.

**Files:**
- Create: `apps/web/src/components/TargetingBuilder.tsx`

**Step 1: Create TargetingBuilder component**

This is the main component. It takes `value` (current targeting), `onChange` callback, `adAccountId`, and `currency`.

Key subsections (each is a collapsible card):
1. Age & Gender
2. Locations (with search)
3. Interests (with search)
4. Custom Audiences (from managed audiences)
5. Platforms & Placements

See the complete component below. Create this file:

```tsx
// apps/web/src/components/TargetingBuilder.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

// ─── Types ───
interface Interest { id: string; name: string; audienceSize?: number | null; }
interface Location { key: string; name: string; type: string; countryCode?: string; }
interface Audience { id: string; fbAudienceId: string; name: string; type: string; approximateCount: number | null; }
interface TargetingState {
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
const AGE_OPTIONS = Array.from({ length: 53 }, (_, i) => i + 13); // 13-65
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

// ─── Sub-components ───
function SectionCard({ title, icon, children, defaultOpen = false }: {
  title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-50 transition-colors rounded-t-lg"
      >
        <span className="text-sm font-medium text-ink flex items-center gap-2">
          <span>{icon}</span> {title}
        </span>
        <span className="text-ink-200 text-xs transition-transform" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0)' }}>
          ▶
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
      <button onClick={onRemove} className="hover:text-danger transition-colors">×</button>
    </span>
  );
}

// ─── Main Component ───
export default function TargetingBuilder({ value, onChange, adAccountId }: Props) {
  const [interestQuery, setInterestQuery] = useState('');
  const [interests, setInterests] = useState<Interest[]>([]);
  const [locationQuery, setLocationQuery] = useState('');
  const [locations, setLocations] = useState<Location[]>([]);
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [searching, setSearching] = useState(false);
  const [audienceSize, setAudienceSize] = useState<{ daily: number; monthly: number } | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Load audiences ───
  useEffect(() => {
    axios.get('/api/audiences').then(r => setAudiences(r.data || [])).catch(() => {});
  }, []);

  // ─── Estimate audience size ───
  useEffect(() => {
    if (!adAccountId || Object.keys(value).length === 0) return;
    const timer = setTimeout(async () => {
      try {
        const { data } = await axios.get('/api/targeting/estimate', {
          params: { targeting: JSON.stringify(value), adAccountId },
        });
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
      const { data } = await axios.get('/api/targeting/interests', { params: { q } });
      setInterests(data || []);
    } catch { setInterests([]); }
    finally { setSearching(false); }
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => doInterestSearch(interestQuery), 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [interestQuery, doInterestSearch]);

  // ─── Location search ───
  const doLocationSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setLocations([]); return; }
    setSearching(true);
    try {
      const { data } = await axios.get('/api/targeting/locations', { params: { q, types: 'country,region,city' } });
      setLocations(data || []);
    } catch { setLocations([]); }
    finally { setSearching(false); }
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => doLocationSearch(locationQuery), 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
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

  const fmtNum = (n: number | null) => n ? (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : n.toLocaleString()) : '-';

  return (
    <div className="space-y-3">
      {/* ─── Audience Estimate Banner ─── */}
      {audienceSize && (audienceSize.daily > 0 || audienceSize.monthly > 0) && (
        <div className="flex items-center gap-4 px-4 py-3 rounded-lg bg-surface-100 border border-surface-200 text-xs">
          <span className="text-ink-200">📊 Est. Audience</span>
          <span className="font-semibold text-ink">{fmtNum(audienceSize.daily)} <span className="text-ink-300">daily</span></span>
          <span className="text-ink-200">·</span>
          <span className="font-semibold text-ink">{fmtNum(audienceSize.monthly)} <span className="text-ink-300">monthly</span></span>
        </div>
      )}

      {/* ─── Age & Gender ─── */}
      <SectionCard title="Age & Gender" icon="👤" defaultOpen={true}>
        <div className="space-y-3">
          {/* Age */}
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

          {/* Gender */}
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
      <SectionCard title="Locations" icon="📍">
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
        {/* Selected locations */}
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
        {/* Search results */}
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
      <SectionCard title="Interests" icon="🎯">
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
        {/* Selected interests */}
        <div className="flex flex-wrap gap-1 mb-2">
          {(value.interests || []).map(item => (
            <TagPill key={item.id} label={item.name} onRemove={() => removeInterest(item.id)} />
          ))}
        </div>
        {/* Search results */}
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
      <SectionCard title="Custom Audiences" icon="👥">
        {audiences.length === 0 ? (
          <p className="text-xs text-ink-300 py-2">No audiences yet — head to the Audiences page to create one.</p>
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
      <SectionCard title="Platforms & Placements" icon="📱">
        <div className="space-y-3">
          {/* Platforms */}
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
          {/* Positions */}
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
          {/* Devices */}
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

      {/* ─── Targeting Optimization ─── */}
      <SectionCard title="Advanced" icon="⚙">
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
```

**Step 2: Verify component compiles**

```bash
cd /opt/fb-ads-platform
# Component is auto-compiled by Next.js dev server, no manual build needed
docker compose logs web --tail 5
# Expected: no compile errors in console
```

---

### Task 5: Wire TargetingBuilder into Campaign Wizard

**Objective:** Integrate the TargetingBuilder into Step 2 of the Wizard and Quick mode of `/dashboard/campaigns/new/page.tsx`.

**File:**
- Modify: `apps/web/src/app/dashboard/campaigns/new/page.tsx`

**Step 1: Add import**

At the top of the file, add:

```typescript
import TargetingBuilder from '@/components/TargetingBuilder';
```

**Step 2: Add targeting to form state**

In the `form` state initialization (after line 80), add:

```typescript
    targeting: {} as Record<string, any>,
```

**Step 3: Wire targeting into Wizard Step 2**

Find the Wizard Step 2 section (~line 412). After the Budget Preview and before the Ad Set section, add the TargetingBuilder. Replace the current Step 2 content to include targeting.

The key insert point is after `BudgetPreview` in step 2. Add:

```tsx
                <div className="mb-4">
                  <TargetingBuilder
                    value={form.targeting || {}}
                    onChange={(v) => setForm({ ...form, targeting: v })}
                    adAccountId={form.adAccountId}
                  />
                </div>
```

**Step 4: Wire targeting into Quick mode**

In Quick mode section (~line 283), add the same TargetingBuilder after the BudgetPreview and before the Launch button.

**Step 5: Send targeting in API call**

In the `createCampaign` function (~line 136), add the targeting to the DTO when an adSetName is set:

```typescript
      if (form.adSetName) {
        dto.adSetName = form.adSetName;
        dto.optimizationGoal = form.optimizationGoal;
        dto.billingEvent = form.billingEvent;
        dto.targeting = form.targeting;  // <-- add this line
      }
```

---

### Task 6: Install zod dependency and rebuild

**Objective:** Install zod in the NestJS API, rebuild Docker, verify.

**Step 1: Install zod**

```bash
cd /opt/fb-ads-platform
# Since api is an alpine container, install via docker exec
docker exec -w /app/apps/api fb-ads-platform-api-1 sh -c "npm install zod"
```

**Step 2: Rebuild API container (Prisma schema unchanged, but new files added to src/ which IS volume-mounted)**

Since we only added files to `apps/api/src/` (which IS volume-mounted), a restart should suffice:

```bash
docker compose restart api
sleep 8
docker compose logs api --tail 15
# Expected: "Nest application successfully started"
```

**Step 3: Verify targeting search works**

Need a JWT token first:
```bash
# Login to get token
TOKEN=$(curl -s -X POST http://localhost:4001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","password":"test"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")
echo "Token: ${TOKEN:0:20}..."

# Test interest search
curl -s "http://localhost:4001/api/targeting/interests?q=shopping" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | head -20
# Expected: array of interests with id, name, audienceSize

# Test location search
curl -s "http://localhost:4001/api/targeting/locations?q=Bangkok&types=city" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | head -20
# Expected: array of locations with key, name, type
```

**Step 4: Verify frontend**

```bash
# Ensure the page loads
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/dashboard/campaigns/new
# Expected: 200

# Check TargetingBuilder renders (no compile errors in browser console)
# Open https://fb-ads.minstance.cloud/dashboard/campaigns/new
# Wizard Step 2 should show TargetingBuilder under Budget
```

---

### Task 7: Add targeting display to ad set modal

**Objective:** Show the current targeting in the Ad Sets modal on the All Campaigns page so users can see what targeting was configured.

**File:**
- Modify: `apps/web/src/app/dashboard/all-campaigns/page.tsx` — add targeting preview in the ad set card

**Step 1: Add targeting summary to ad set card**

In the ad set modal, for each ad set item, add a targeting summary after the meta info row. Add a small collapsible section or a simple summary line:

```tsx
{/* Targeting summary */}
{adset.targeting && Object.keys(adset.targeting).length > 0 && (
  <div className="text-[10px] text-ink-300 mt-1">
    {adset.targeting.geo_locations?.countries?.length > 0 && (
      <span>📍 {adset.targeting.geo_locations.countries.join(', ')} </span>
    )}
    {adset.targeting.age_min && adset.targeting.age_max && (
      <span>· 👤 {adset.targeting.age_min}-{adset.targeting.age_max} </span>
    )}
    {adset.targeting.interests?.length > 0 && (
      <span>· 🎯 {adset.targeting.interests.length} interests </span>
    )}
  </div>
)}
```

---

### Task 8: Final Build & End-to-End Test

**Objective:** Full stack test — create a campaign with advanced targeting and verify it reaches Facebook.

**Step 1: Full rebuild if needed**

```bash
cd /opt/fb-ads-platform
docker compose restart api web
sleep 10
docker compose ps
# All services should be healthy
```

**Step 2: End-to-end test via curl**

```bash
TOKEN=$(curl -s -X POST http://localhost:4001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","password":"test"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")

# Get ad account ID
ACC_ID=$(curl -s http://localhost:4001/api/adaccounts -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'] if d else '')")

# Create campaign with full targeting
curl -s -X POST http://localhost:4001/api/campaigns \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"adAccountId\": \"$ACC_ID\",
    \"name\": \"Test Targeting $(date +%s)\",
    \"objective\": \"OUTCOME_TRAFFIC\",
    \"dailyBudget\": 100,
    \"status\": \"PAUSED\",
    \"adSetName\": \"Test AdSet\",
    \"optimizationGoal\": \"REACH\",
    \"billingEvent\": \"IMPRESSIONS\",
    \"targeting\": {
      \"geo_locations\": { \"countries\": [\"TH\"] },
      \"age_min\": 25,
      \"age_max\": 45,
      \"genders\": [1],
      \"publisher_platforms\": [\"facebook\", \"instagram\"],
      \"facebook_positions\": [\"feed\", \"story\"]
    }
  }" | python3 -m json.tool
# Expected: { campaignId: "...", adSetId: "...", status: "PAUSED" }
```

**Step 3: Commit**

```bash
cd /opt/fb-ads-platform
git add apps/api/src/campaigns/dto/targeting.schema.ts
git add apps/api/src/campaigns/targeting.controller.ts
git add apps/api/src/campaigns/dto/create-campaign.dto.ts
git add apps/api/src/campaigns/campaigns.service.ts
git add apps/api/src/facebook/facebook.service.ts
git add apps/api/src/campaigns/campaigns.module.ts
git add apps/web/src/components/TargetingBuilder.tsx
git add apps/web/src/app/dashboard/campaigns/new/page.tsx
git add apps/web/src/app/dashboard/all-campaigns/page.tsx
git commit -m "feat: targeting builder — full targeting UI in campaign wizard
- Add targeting search endpoints (interests, locations, demographics)
- Add Zod targeting schema validation
- Build TargetingBuilder component (age, gender, location, interest, audience, platform)
- Wire into campaign wizard Step 2 and Quick mode
- Add live audience size estimation
- Show targeting summary in ad set modal"
```

---

## Verification Checklist

- [ ] `GET /api/targeting/interests?q=shopping` returns interest results
- [ ] `GET /api/targeting/locations?q=Bangkok` returns location results
- [ ] `GET /api/targeting/estimate?targeting=...&adAccountId=...` returns audience size
- [ ] Creating campaign with targeting JSON works (no Graph API rejection)
- [ ] TargetingBuilder renders in Wizard Step 2
- [ ] TargetingBuilder renders in Quick mode
- [ ] Interest search works (type → results appear → click to add → shows as tag)
- [ ] Location search works
- [ ] Custom audiences appear in picker (if any exist)
- [ ] Audience estimate banner updates when targeting changes
- [ ] Ad set modal shows targeting summary
- [ ] No TypeScript/SWC compile errors in web container logs
- [ ] No NestJS startup errors in api container logs
