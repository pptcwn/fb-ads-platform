import { AccountStatus } from '@prisma/client';

/** Meta Ad Account disable_reason (subset — extend as needed). */
const DISABLE_REASON_TH: Record<number, string> = {
  0: '',
  1: 'นโยบายโฆษณา / ความสมบูรณ์ของบัญชี',
  2: 'ความเสี่ยงด้านการชำระเงิน',
  3: 'ค่าใช้จ่ายค้างชำระ',
  4: 'การละเมิดนโยบายโฆษณา',
  5: 'บัญชีไม่ได้ใช้งาน',
  6: 'บัญชีถูกปิดชั่วคราว',
  7: 'บัญชีถูกปิดถาวร',
  8: 'บัญชีถูกปิดการใช้งาน',
  9: 'บัญชีถูกปิดการใช้งานโดย Meta',
};

const STATUS_TH: Record<AccountStatus, string> = {
  ACTIVE: 'ใช้งานได้',
  LIMITED: 'ถูกจำกัดชั่วคราว',
  DISABLED: 'ปิดใช้งาน / รอตรวจ',
  BANNED: 'ปิดถาวร',
};

/** Map Meta account_status numeric code → Prisma AccountStatus. */
export function mapMetaAccountStatus(code: number | null | undefined): AccountStatus {
  switch (code) {
    case 1:
      return 'ACTIVE';
    case 2:
      return 'DISABLED';
    case 3:
      return 'DISABLED'; // UNSETTLED
    case 7:
      return 'DISABLED'; // PENDING_RISK_REVIEW
    case 8:
      return 'LIMITED'; // PENDING_SETTLEMENT
    case 9:
      return 'LIMITED'; // IN_GRACE_PERIOD
    case 100:
      return 'DISABLED'; // PENDING_CLOSURE
    case 101:
      return 'BANNED'; // CLOSED
    default:
      return 'DISABLED';
  }
}

export function canCreateAds(status: AccountStatus): boolean {
  return status === 'ACTIVE';
}

export function canSpendActions(status: AccountStatus): boolean {
  return status === 'ACTIVE';
}

/** OQ1 default: show all including BANNED in switcher (grouped). */
export function isVisibleInSwitcher(_status: AccountStatus): boolean {
  return true;
}

export function getStatusLabelTh(status: AccountStatus): string {
  return STATUS_TH[status] ?? status;
}

export function getDisableReasonTh(code: number | null | undefined): string | null {
  if (code == null || code === 0) return null;
  return DISABLE_REASON_TH[code] ?? `รหัสจำกัด (${code})`;
}

export function buildRestrictionMessage(
  status: AccountStatus,
  disableReason: number | null | undefined,
): string | null {
  if (canCreateAds(status)) return null;
  const parts: string[] = [getStatusLabelTh(status)];
  const reason = getDisableReasonTh(disableReason);
  if (reason) parts.push(reason);
  return `บัญชีโฆษณานี้ถูกจำกัด — ${parts.join(' · ')}`;
}

export function buildStatusLabelTh(
  status: AccountStatus,
  disableReason: number | null | undefined,
): string {
  const base = getStatusLabelTh(status);
  const reason = getDisableReasonTh(disableReason);
  return reason ? `${base} (${reason})` : base;
}

export type AdAccountCapabilityFields = {
  status: AccountStatus;
  disableReason?: number | null;
};

export function assertCanCreateAdsOnStatus(status: AccountStatus): boolean {
  return canCreateAds(status);
}

export function enrichAdAccountCapabilities<T extends AdAccountCapabilityFields>(
  account: T,
): T & {
  canCreateAds: boolean;
  canSpendActions: boolean;
  restrictionMessage: string | null;
  statusLabelTh: string;
} {
  return {
    ...account,
    canCreateAds: canCreateAds(account.status),
    canSpendActions: canSpendActions(account.status),
    restrictionMessage: buildRestrictionMessage(account.status, account.disableReason),
    statusLabelTh: buildStatusLabelTh(account.status, account.disableReason),
  };
}