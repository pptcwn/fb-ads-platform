'use client';

import Link from 'next/link';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import type { AdAccount } from '@/lib/api-client';
import {
  META_BUSINESS_SETTINGS_URL,
  statusBadgeClass,
  type AdAccountCapabilities,
} from '@/lib/ad-account-utils';

type AccountRow = AdAccountCapabilities &
  Pick<AdAccount, 'accountId' | 'accountStatusCode' | 'disableReason'>;

interface RestrictedAccountsPanelProps {
  accounts: AccountRow[];
  className?: string;
}

export default function RestrictedAccountsPanel({ accounts, className = '' }: RestrictedAccountsPanelProps) {
  if (accounts.length === 0) return null;

  return (
    <div className={`card border border-warning-border bg-warning-muted/30 p-5 mb-6 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" aria-hidden />
          <div>
            <h2 className="text-sm font-semibold text-ink">
              บัญชีต้องแก้ไข ({accounts.length})
            </h2>
            <p className="text-xs text-ink-200 mt-1">
              บัญชีเหล่านี้ไม่สามารถสร้างแคมเปญใหม่ได้ — แก้สถานะใน Meta Business Manager แล้วกด Sync
            </p>
          </div>
        </div>
        <a
          href={META_BUSINESS_SETTINGS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary btn-sm inline-flex items-center gap-1 shrink-0"
        >
          <ExternalLink className="w-3.5 h-3.5" aria-hidden />
          Meta Business
        </a>
      </div>

      <ul className="space-y-3">
        {accounts.map((acc) => (
          <li
            key={acc.id}
            className="rounded-lg border border-surface-300 bg-surface-100/80 px-4 py-3"
          >
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-medium text-sm text-ink">{acc.name}</span>
              <span className={`badge text-[10px] ${statusBadgeClass(acc.status)}`}>
                {acc.statusLabelTh || acc.status}
              </span>
              <span className="text-xs text-ink-300">{acc.currency}</span>
            </div>
            {acc.restrictionMessage && (
              <p className="text-xs text-ink-200 leading-relaxed">{acc.restrictionMessage}</p>
            )}
            <p className="text-[11px] text-ink-300 mt-1 font-mono">
              {acc.accountId}
              {acc.accountStatusCode != null && ` · Meta status ${acc.accountStatusCode}`}
              {acc.disableReason != null && acc.disableReason > 0 && ` · reason ${acc.disableReason}`}
            </p>
          </li>
        ))}
      </ul>

      <p className="text-xs text-ink-200 mt-4">
        ยังดูแคมเปญและข้อมูลเก่าของบัญชีเหล่านี้ได้ — เลือกจากเมนูบัญชีด้านบน (กลุ่มจำกัด/ปิด)
      </p>
    </div>
  );
}

interface UsableAccountsSummaryProps {
  count: number;
  className?: string;
}

export function UsableAccountsSummary({ count, className = '' }: UsableAccountsSummaryProps) {
  if (count === 0) return null;
  return (
    <div className={`card p-4 mb-6 border border-success-border/40 bg-success-muted/20 ${className}`}>
      <p className="text-sm text-ink">
        <span className="font-semibold text-success">{count}</span> บัญชีพร้อมสร้างแคมเปญ
        <Link href="/dashboard/campaigns/create" className="text-brand hover:underline ml-2">
          สร้างแคมเปญ →
        </Link>
      </p>
    </div>
  );
}