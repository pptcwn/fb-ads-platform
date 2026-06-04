import type { TargetingDto } from '../campaigns/dto/targeting.schema';

/** Strip UI-only fields and shape targeting for Marketing API ad set creation. */
export function sanitizeTargetingForGraph(targeting: TargetingDto): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  if (targeting.geo_locations && typeof targeting.geo_locations === 'object') {
    const geo: Record<string, unknown> = {};
    if (targeting.geo_locations.countries?.length) geo.countries = targeting.geo_locations.countries;
    if (targeting.geo_locations.regions?.length) geo.regions = targeting.geo_locations.regions;
    if (targeting.geo_locations.cities?.length) geo.cities = targeting.geo_locations.cities;
    if (targeting.geo_locations.location_types?.length) geo.location_types = targeting.geo_locations.location_types;
    if (Object.keys(geo).length > 0) out.geo_locations = geo;
  }

  if (targeting.age_min != null) out.age_min = targeting.age_min;
  if (targeting.age_max != null) out.age_max = targeting.age_max;
  if (targeting.genders?.length) out.genders = targeting.genders;

  const idList = (items?: Array<{ id: string }>) =>
    items?.filter((i) => i?.id).map((i) => ({ id: String(i.id) }));

  const interests = idList(targeting.interests);
  if (interests?.length) out.interests = interests;
  const behaviors = idList(targeting.behaviors);
  if (behaviors?.length) out.behaviors = behaviors;
  const demographics = idList(targeting.demographics);
  if (demographics?.length) out.demographics = demographics;
  const custom = idList(targeting.custom_audiences);
  if (custom?.length) out.custom_audiences = custom;
  const excluded = idList(targeting.excluded_custom_audiences);
  if (excluded?.length) out.excluded_custom_audiences = excluded;

  if (targeting.publisher_platforms?.length) out.publisher_platforms = targeting.publisher_platforms;
  if (targeting.facebook_positions?.length) out.facebook_positions = targeting.facebook_positions;
  if (targeting.device_platforms?.length) out.device_platforms = targeting.device_platforms;

  if (!out.geo_locations) {
    out.geo_locations = { countries: ['TH'] };
  }

  return out;
}