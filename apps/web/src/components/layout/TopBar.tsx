'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, RefreshCw } from 'lucide-react';
import AccountSwitcher from './AccountSwitcher';
import { useFbStatus, useTriggerSync } from '@/hooks/use-dashboard';

export default function TopBar() {
  const pathname = usePathname();
  const { data: fbStatus } = useFbStatus();
  const triggerSync = useTriggerSync();
  const showOverviewSync = pathname === '/dashboard' && !!fbStatus?.connected;

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-surface-300 bg-surface-50/95 backdrop-blur-sm"
      role="banner"
    >
      <AccountSwitcher />
      <div className="flex items-center gap-2">
        {showOverviewSync && (
          <button
            type="button"
            onClick={() => triggerSync.mutate()}
            disabled={triggerSync.isPending}
            className="btn-secondary btn-sm"
            aria-label="ซิงค์ข้อมูลจาก Meta"
          >
            <RefreshCw className={`w-4 h-4 ${triggerSync.isPending ? 'animate-spin' : ''}`} aria-hidden />
            <span className="hidden sm:inline">ซิงค์</span>
          </button>
        )}
        <Link
          href="/dashboard/notifications"
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-ink-100 hover:text-ink hover:bg-surface-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="การแจ้งเตือน"
        >
          <Bell className="w-4 h-4" aria-hidden />
        </Link>
      </div>
    </header>
  );
}