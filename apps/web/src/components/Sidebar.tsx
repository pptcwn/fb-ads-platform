'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: '▦' },
  { label: 'All Campaigns', href: '/dashboard/all-campaigns', icon: '📋' },
  { label: 'New Campaign', href: '/dashboard/campaigns/new', icon: '✨' },
  { label: 'Analytics', href: '/dashboard/analytics', icon: '📊' },
  { label: 'Audiences', href: '/dashboard/audiences', icon: '🎯' },
  { label: 'Creatives', href: '/dashboard/creatives', icon: '🖼' },
  { label: 'Schedules', href: '/dashboard/schedules', icon: '📅' },
  { label: 'Rules', href: '/dashboard/rules', icon: '⚡' },
  { label: 'A/B Test', href: '/dashboard/abtest', icon: '🔬' },
  { label: 'Budget', href: '/dashboard/budget', icon: '💰' },
  { label: 'Templates', href: '/dashboard/templates', icon: '📦' },
  { label: 'Alerts', href: '/dashboard/notifications', icon: '🔔' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 h-screen sticky top-0 flex flex-col bg-surface-50 border-r border-surface-300"
    >
      {/* Brand */}
      <div className="px-5 py-4 border-b border-surface-300">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <span className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-white text-xs font-bold transition-transform group-hover:scale-105"
            style={{ letterSpacing: '-0.02em' }}
          >F</span>
          <span className="font-semibold text-sm text-ink" style={{ letterSpacing: '-0.02em' }}>FB Ads</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all ${
                isActive
                  ? 'text-ink font-medium bg-surface-200'
                  : 'text-ink-100 hover:text-ink hover:bg-surface-100'
              }`}
              style={{
                letterSpacing: '-0.01em',
              }}
            >
              <span className="w-5 text-center text-base">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-surface-300">
        <button
          onClick={() => { localStorage.removeItem('token'); window.location.href = '/'; }}
          className="flex w-full items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-ink-100 hover:text-danger transition-all hover:bg-danger-muted cursor-pointer"
          style={{ letterSpacing: '-0.01em' }}
        >
          <span className="w-5 text-center">🚪</span>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
