'use client';

import Link from 'next/link';
import { Bell, RefreshCw } from 'lucide-react';
import AccountSwitcher from './AccountSwitcher';

interface TopBarProps {
  onSync?: () => void;
  syncing?: boolean;
}

export default function TopBar({ onSync, syncing }: TopBarProps) {
  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-surface-300 bg-surface-50/95 backdrop-blur-sm"
      role="banner"
    >
      <AccountSwitcher />
      <div className="flex items-center gap-2">
        {onSync && (
          <button
            type="button"
            onClick={onSync}
            disabled={syncing}
            className="btn-secondary btn-sm"
            aria-label="ซิงค์ข้อมูลจาก Meta"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} aria-hidden />
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