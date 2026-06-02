'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: '▦', exact: true },
    ],
  },
  {
    label: 'Campaigns',
    items: [
      { label: 'Campaigns', href: '/dashboard/campaigns', icon: '📋', exact: false },
      { label: 'Audiences', href: '/dashboard/audiences', icon: '🎯', exact: false },
      { label: 'Creatives', href: '/dashboard/creatives', icon: '🖼', exact: false },
      { label: 'Templates', href: '/dashboard/templates', icon: '📦', exact: false },
    ],
  },
  {
    label: 'Automation',
    items: [
      { label: 'Rules', href: '/dashboard/rules', icon: '⚡', exact: false },
      { label: 'Schedules', href: '/dashboard/schedules', icon: '📅', exact: false },
      { label: 'Budget', href: '/dashboard/budget', icon: '💰', exact: false },
      { label: 'A/B Test', href: '/dashboard/abtest', icon: '🔬', exact: false },
    ],
  },
  {
    label: 'Insights',
    items: [
      { label: 'Analytics', href: '/dashboard/analytics', icon: '📊', exact: false },
      { label: 'Alerts', href: '/dashboard/notifications', icon: '🔔', exact: false },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/') || pathname.startsWith(href + '?');

  return (
    <aside className="w-56 shrink-0 h-screen sticky top-0 flex flex-col bg-surface-50 border-r border-surface-300">
      {/* Brand */}
      <div className="px-5 py-4 border-b border-surface-300">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <span
            className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-white text-xs font-bold transition-transform group-hover:scale-105"
            style={{ letterSpacing: '-0.02em' }}
          >F</span>
          <span className="font-semibold text-sm text-ink" style={{ letterSpacing: '-0.02em' }}>FB Ads</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-300 px-3 mb-1 mt-4 first:mt-1">
              {group.label}
            </p>
            {group.items.map((item) => {
              const active = isActive(item.href, item.exact);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all ${
                    active
                      ? 'text-ink font-medium bg-surface-200'
                      : 'text-ink-100 hover:text-ink hover:bg-surface-100'
                  }`}
                  style={{ letterSpacing: '-0.01em' }}
                >
                  <span className="w-5 text-center text-base">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
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
