// apps/api/src/campaigns/dto/targeting.schema.ts
// Targeting validation using class-validator (already installed, no zod needed)

export interface TargetingDto {
  geo_locations?: {
    countries?: string[];
    regions?: { key: string }[];
    cities?: { key: string }[];
    zips?: { key: string }[];
    location_types?: Array<'home' | 'recent' | 'traveling'>;
  };
  age_min?: number;
  age_max?: number;
  genders?: number[];
  interests?: Array<{ id: string; name: string }>;
  behaviors?: Array<{ id: string; name: string }>;
  demographics?: Array<{ id: string; name: string }>;
  custom_audiences?: Array<{ id: string }>;
  excluded_custom_audiences?: Array<{ id: string }>;
  publisher_platforms?: Array<'facebook' | 'instagram' | 'messenger' | 'audience_network'>;
  facebook_positions?: Array<
    'feed' | 'story' | 'instream_video' | 'search' | 'marketplace' |
    'video_feeds' | 'reels' | 'profile_feed'
  >;
  device_platforms?: Array<'mobile' | 'desktop'>;
  targeting_optimization?: 'none' | 'expansion_all' | 'expansion_interest' | 'expansion_lookalike';
}

const VALID_GENDERS = [0, 1, 2];
const VALID_PLATFORMS = ['facebook', 'instagram', 'messenger', 'audience_network'];
const VALID_POSITIONS = ['feed', 'story', 'instream_video', 'search', 'marketplace', 'video_feeds', 'reels', 'profile_feed'];
const VALID_DEVICES = ['mobile', 'desktop'];
const VALID_OPTIMIZATIONS = ['none', 'expansion_all', 'expansion_interest', 'expansion_lookalike'];

export function validateTargeting(data: unknown): TargetingDto {
  if (!data || typeof data !== 'object') return {};
  const t = data as Record<string, any>;
  const result: TargetingDto = {};

  // Age
  if (typeof t.age_min === 'number' && t.age_min >= 13 && t.age_min <= 65) result.age_min = t.age_min;
  if (typeof t.age_max === 'number' && t.age_max >= 13 && t.age_max <= 65) result.age_max = t.age_max;

  // Gender
  if (Array.isArray(t.genders)) {
    const filtered = t.genders.filter((g: any) => VALID_GENDERS.includes(g));
    if (filtered.length > 0) result.genders = filtered;
  }

  // Geo
  if (t.geo_locations && typeof t.geo_locations === 'object') {
    const geo: TargetingDto['geo_locations'] = {};
    if (Array.isArray(t.geo_locations.countries)) geo.countries = t.geo_locations.countries.filter((c: any) => typeof c === 'string');
    if (Array.isArray(t.geo_locations.regions)) geo.regions = t.geo_locations.regions.filter((r: any) => r && typeof r.key === 'string');
    if (Array.isArray(t.geo_locations.cities)) geo.cities = t.geo_locations.cities.filter((c: any) => c && typeof c.key === 'string');
    if (Array.isArray(t.geo_locations.location_types)) {
      const lts = t.geo_locations.location_types.filter((lt: any) => ['home', 'recent', 'traveling'].includes(lt));
      if (lts.length > 0) geo.location_types = lts;
    }
    if (Object.keys(geo).length > 0) result.geo_locations = geo;
  }

  // Interests / behaviors / demographics
  if (Array.isArray(t.interests)) {
    result.interests = t.interests.filter((i: any) => i && typeof i.id === 'string' && typeof i.name === 'string');
  }
  if (Array.isArray(t.behaviors)) {
    result.behaviors = t.behaviors.filter((b: any) => b && typeof b.id === 'string' && typeof b.name === 'string');
  }
  if (Array.isArray(t.demographics)) {
    result.demographics = t.demographics.filter((d: any) => d && typeof d.id === 'string' && typeof d.name === 'string');
  }

  // Audiences
  if (Array.isArray(t.custom_audiences)) {
    result.custom_audiences = t.custom_audiences.filter((a: any) => a && typeof a.id === 'string');
  }
  if (Array.isArray(t.excluded_custom_audiences)) {
    result.excluded_custom_audiences = t.excluded_custom_audiences.filter((a: any) => a && typeof a.id === 'string');
  }

  // Platforms
  if (Array.isArray(t.publisher_platforms)) {
    const filtered = t.publisher_platforms.filter((p: any) => VALID_PLATFORMS.includes(p));
    if (filtered.length > 0) result.publisher_platforms = filtered;
  }
  if (Array.isArray(t.facebook_positions)) {
    const filtered = t.facebook_positions.filter((p: any) => VALID_POSITIONS.includes(p));
    if (filtered.length > 0) result.facebook_positions = filtered;
  }
  if (Array.isArray(t.device_platforms)) {
    const filtered = t.device_platforms.filter((d: any) => VALID_DEVICES.includes(d));
    if (filtered.length > 0) result.device_platforms = filtered;
  }
  if (VALID_OPTIMIZATIONS.includes(t.targeting_optimization)) {
    result.targeting_optimization = t.targeting_optimization;
  }

  return result;
}
