/** Meta Marketing API / Advantage+ reference constants (2026). */
export const META_MARKETING_API_NOTES = {
  advantagePlusDeadline: '2026-05-01',
  webhooksMtlsDeadline: '2026-03-01',
  defaultApiVersion: 'v24.0',
} as const;

/** Fields that may be restricted or renamed in newer Graph versions — verify before use. */
export const DEPRECATED_OR_SENSITIVE_CAMPAIGN_FIELDS = [
  'smart_promotion_type', // Advantage+ campaign indicator — verify per API version
  'special_ad_categories',
] as const;

export const RECOMMENDED_INSIGHTS_PRESETS = [
  'yesterday',
  'last_7d',
  'last_30d',
] as const;