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

/** Normalize stored account_id (act_123) to numeric id for Graph act_XXX paths. */
export function fbAdAccountActId(accountId: string): string {
  return accountId.replace(/^act_/, '');
}

/** Graph path segment for ad account endpoints. */
export function actPath(adAccountId: string): string {
  return `act_${fbAdAccountActId(adAccountId)}`;
}

/** Meta Marketing API bid_strategy values (Graph API v24+). */
export const FB_BID_STRATEGIES = [
  'LOWEST_COST_WITHOUT_CAP',
  'LOWEST_COST_WITH_BID_CAP',
  'COST_CAP',
  'LOWEST_COST_WITH_MIN_ROAS',
] as const;

export type FbBidStrategy = (typeof FB_BID_STRATEGIES)[number];

/** Default: lowest cost without bid cap (replaces deprecated LOWEST_COST_NO_BID). */
export const DEFAULT_FB_BID_STRATEGY: FbBidStrategy = 'LOWEST_COST_WITHOUT_CAP';

/** Map legacy stored values to a valid Graph API bid_strategy. */
export function normalizeBidStrategy(strategy?: string | null): FbBidStrategy {
  if (!strategy) return DEFAULT_FB_BID_STRATEGY;
  if (strategy === 'LOWEST_COST_NO_BID') return DEFAULT_FB_BID_STRATEGY;
  if ((FB_BID_STRATEGIES as readonly string[]).includes(strategy)) {
    return strategy as FbBidStrategy;
  }
  return DEFAULT_FB_BID_STRATEGY;
}