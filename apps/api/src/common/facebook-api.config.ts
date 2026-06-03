/** Single source of truth for Facebook Graph API version in the API app. */
export const FB_API_VERSION = (process.env.FB_API_VERSION?.trim() || 'v24.0');

export const FB_GRAPH_BASE_URL = `https://graph.facebook.com/${FB_API_VERSION}`;

/**
 * @see docs/meta-advantage-plus-2026.md — review before May 2026 Advantage+ API changes.
 */
export const META_API_CHANGE_REVIEW_DATE = '2026-05-01';

export function fbOAuthDialogBaseUrl(): string {
  return `https://www.facebook.com/${FB_API_VERSION}/dialog/oauth`;
}