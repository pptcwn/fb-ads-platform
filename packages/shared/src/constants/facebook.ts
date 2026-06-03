/**
 * Default Facebook Graph API settings for shared types/constants.
 * The API app reads `process.env.FB_API_VERSION` at runtime — keep default aligned with `.env.example`.
 */
export const DEFAULT_FB_API_VERSION = 'v24.0';

export const FB_API_VERSION = DEFAULT_FB_API_VERSION;
export const FB_API_BASE = `https://graph.facebook.com/${DEFAULT_FB_API_VERSION}`;
export const FB_RATE_LIMIT = 180; // per hour per user
export const FB_TOKEN_LIFETIME_DAYS = 60;
export const FB_TOKEN_REFRESH_THRESHOLD_DAYS = 7;
export const FB_MAX_AD_ACCOUNTS_PER_USER = 2;