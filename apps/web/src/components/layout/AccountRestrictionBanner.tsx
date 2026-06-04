'use client';

import { AlertTriangle } from 'lucide-react';
import type { AdAccountCapabilities } from '@/lib/ad-account-utils';
import { META_BUSINESS_SETTINGS_URL, statusBadgeClass } from '@/lib/ad-account-utils';

interface AccountRestrictionBannerProps {
  account: AdAccountCapabilities;
  className?: string;
}

export default function AccountRestrictionBanner({
  account,
  className = 'mb-4',
}: AccountRestrictionBannerProps) {
  const message =
    account.restrictionMessage ||
    `บัญชี "${account.name}" ถูกจำกัด — ดูข้อมูลได้อย่างเดียว ไม่สามารถสร้างหรือแก้ไขโฆษณาได้`;

  return (
    <div
      className={`flex gap-3 rounded-lg border border-warning-border bg-warning-muted px-4 py-3 text-sm text-ink ${className}`}
      role="status"
    >
      <AlertTriangle className="w-5 h-5 shrink-0 text-warning" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium flex flex-wrap items-center gap-2">
          <span>{account.name}</span>
          <span className={`badge text-[10px] ${statusBadgeClass(account.status)}`}>
            {account.statusLabelTh || account.status}
          </span>
        </p>
        <p className="text-ink-100 leading-snug">{message}</p>
        <a
          href={META_BUSINESS_SETTINGS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-brand hover:underline"
        >
          เปิด Meta Business Settings →
        </a>
      </div>
    </div>
  );
}