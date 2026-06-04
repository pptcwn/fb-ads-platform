'use client';

import Link from 'next/link';
import { Bell, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AccountSwitcher from './AccountSwitcher';
import { useDashboardSync } from '@/contexts/dashboard-sync-context';

export default function TopBar() {
  const { onSync, syncing } = useDashboardSync();

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-surface-300 bg-surface-50/95 backdrop-blur-sm"
      role="banner"
    >
      <AccountSwitcher />
      <div className="flex items-center gap-2">
        {onSync && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void onSync()}
            disabled={syncing}
            aria-label="ซิงค์ข้อมูลจาก Meta"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} aria-hidden />
            <span className="hidden sm:inline">ซิงค์</span>
          </Button>
        )}
        <Link
          href="/dashboard/notifications"
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-ink-100 hover:text-ink hover:bg-surface-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          aria-label="การแจ้งเตือน"
        >
          <Bell className="w-4 h-4" aria-hidden />
        </Link>
      </div>
    </header>
  );
}