import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Business Helpers (preserved) ───

export const objLabel = (o: string) =>
  ({ OUTCOME_AWARENESS: 'Awareness', OUTCOME_ENGAGEMENT: 'Engagement', OUTCOME_TRAFFIC: 'Traffic', OUTCOME_LEADS: 'Leads', OUTCOME_SALES: 'Sales', OUTCOME_APP_PROMOTION: 'App Promotion' }[o] || o);

export const fmtCurr = (val: number, cur: string = 'USD') =>
  new Intl.NumberFormat('en', { style: 'currency', currency: cur, minimumFractionDigits: 0 }).format(val);

export const fmtNum = (n: number) =>
  n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString();

export const fmtPct = (v: number) => (v * 100).toFixed(2) + '%';

export const daysAgo = (d: number) => {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  return dt.toISOString().slice(0, 10);
};

export const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'badge-success',
  PAUSED: 'badge-warning',
  DELETED: 'badge-danger',
  ARCHIVED: 'badge-ink',
};
