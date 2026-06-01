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
    <aside className="w-56 shrink-0 h-screen sticky top-0 flex flex-col bg-surface-50"
      style={{ boxShadow: 'inset -1px 0 0 0 rgba(255,255,255,0.06)' }}
    >
      {/* Brand */}
      <div className="px-5 py-4" style={{ boxShadow: 'inset 0 -1px 0 0 rgba(255,255,255,0.06)' }}>
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-white text-xs font-bold"
            style={{ letterSpacing: '-0.02em' }}
          >F</span>
          <span className="font-semibold text-sm text-ink" style={{ letterSpacing: '-0.02em' }}>FB Ads</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                isActive
                  ? 'text-ink font-medium'
                  : 'text-ink-200 hover:text-ink'
              }`}
              style={{
                letterSpacing: '-0.01em',
                ...(isActive
                  ? {
                      background: 'rgba(255,255,255,0.06)',
                      boxShadow: 'inset 2px 0 0 0 #0070f3',
                    }
                  : {}),
              }}
            >
              <span className="w-5 text-center text-base">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3" style={{ boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.06)' }}>
        <button
          onClick={() => { localStorage.removeItem('token'); window.location.href = '/'; }}
          className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-ink-200 hover:text-danger transition-all hover:bg-danger-muted"
          style={{ letterSpacing: '-0.01em' }}
        >
          <span className="w-5 text-center">🚪</span>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
