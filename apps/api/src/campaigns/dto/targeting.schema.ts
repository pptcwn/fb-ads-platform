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
  genders: z.array(z.number().refine((v: number) => [0, 1, 2].includes(v))).optional(),
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
