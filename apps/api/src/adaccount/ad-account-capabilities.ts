import { AccountStatus } from '@prisma/client';

/**
 * Meta Ad Account disable_reason — see Marketing API Ad Account reference.
 * @see https://developers.facebook.com/docs/marketing-api/reference/ad-account/
 */
const DISABLE_REASON_TH: Record<number, string> = {
  0: '',
  1: 'นโยบายโฆษณา / ความสมบูรณ์ของบัญชี (Ads Integrity)',
  2: 'ความเสี่ยงด้านการชำระเงิน',
  3: 'ตั๋ว/reseller ไม่ได้ใช้งาน',
  4: 'บัญชีไม่ได้ใช้งาน',
  5: 'บัญชีร่ม (Umbrella) ถูกจำกัด',
  6: 'ความสมบูรณ์ทางธุรกิจ (Business Integrity)',
  7: 'ข้อมูลธุรกิจไม่ตรง / การแสดงตัวตน',
  8: 'ฟีเจอร์โฆษณาถูกปิด (AOBA)',
  9: 'ความสมบูรณ์ทางธุรกิจ (RAR)',
  10: 'การละเมิดนโยบายโฆษณา',
  11: 'บัญชีถูกระงับชั่วคราว',
  12: 'การชำระเงินล้มเหลว',
  13: 'เกินวงเงินหรือ spend cap',
  14: 'บัญชีรอการตรวจสอบ',
  15: 'บัญชีถูกปิดโดย Meta',
};

/** Meta account_status code labels (for support / Overview). */
const ACCOUNT_STATUS_CODE_TH: Record<number, string> = {
  1: 'ใช้งานได้ (Active)',
  2: 'ปิดใช้งาน (Disabled)',
  3: 'ค้างชำระ (Unsettled)',
  7: 'รอตรวจความเสี่ยง',
  8: 'รอชำระเงิน',
  9: 'ช่วง Grace period',
  100: 'รอปิดบัญชี',
  101: 'ปิดแล้ว (Closed)',
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
  return DISABLE_REASON_TH[code] ?? `รหัสจำกัด disable_reason=${code}`;
}

export function getAccountStatusCodeTh(code: number | null | undefined): string | null {
  if (code == null) return null;
  return ACCOUNT_STATUS_CODE_TH[code] ?? `สถานะ Meta #${code}`;
}

export function isRestrictedAdAccountStatus(status: AccountStatus): boolean {
  return !canCreateAds(status);
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