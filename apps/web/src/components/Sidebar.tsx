'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Megaphone,
  Users,
  Image,
  Package,
  Zap,
  Calendar,
  Banknote,
  ShieldCheck,
  FlaskConical,
  BarChart3,
  Bell,
  LogOut,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  exact: boolean;
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
    ],
  },
  {
    label: 'Campaigns',
    items: [
      { label: 'Campaigns', href: '/dashboard/campaigns', icon: Megaphone, exact: false },
      { label: 'Audiences', href: '/dashboard/audiences', icon: Users, exact: false },
      { label: 'Creatives', href: '/dashboard/creatives', icon: Image, exact: false },
      { label: 'Templates', href: '/dashboard/templates', icon: Package, exact: false },
    ],
  },
  {
    label: 'Automation',
    items: [
      { label: 'Rules', href: '/dashboard/rules', icon: Zap, exact: false },
      { label: 'Schedules', href: '/dashboard/schedules', icon: Calendar, exact: false },
      { label: 'Budget', href: '/dashboard/budget', icon: Banknote, exact: false },
      { label: 'Approvals', href: '/dashboard/approvals', icon: ShieldCheck, exact: false },
      { label: 'A/B Test', href: '/dashboard/abtest', icon: FlaskConical, exact: false },
    ],
  },
  {
    label: 'Insights',
    items: [
      { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3, exact: false },
      { label: 'Alerts', href: '/dashboard/notifications', icon: Bell, exact: false },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');

  return (
    <aside className="w-56 shrink-0 h-screen sticky top-0 flex flex-col bg-surface-50 border-r border-surface-300" role="navigation" aria-label="Main navigation">
      {/* Brand */}
      <div className="px-5 py-4 border-b border-surface-300">
        <Link href="/dashboard" className="flex items-center gap-2.5 group focus:outline-none focus:ring-2 focus:ring-accent rounded-lg" aria-label="FB Ads Platform home">
          <span
            className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-white text-xs font-bold transition-transform group-hover:scale-105"
            style={{ letterSpacing: '-0.02em' }}
          >F</span>
          <span className="font-semibold text-sm text-ink" style={{ letterSpacing: '-0.02em' }}>FB Ads</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5" aria-label="Page navigation">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} role="group" aria-label={group.label}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-300 px-3 mb-1 mt-4 first:mt-1">
              {group.label}
            </p>
            {group.items.map((item) => {
              const active = isActive(item.href, item.exact);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent ${
                    active
                      ? 'text-ink font-medium bg-surface-200'
                      : 'text-ink-100 hover:text-ink hover:bg-surface-100'
                  }`}
                  style={{ letterSpacing: '-0.01em' }}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
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
          onClick={async () => {
            try {
              await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
            } catch { /* ignore */ }
            window.location.href = '/';
          }}
          className="flex w-full items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-ink-100 hover:text-danger transition-all hover:bg-danger-muted cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent"
          style={{ letterSpacing: '-0.01em' }}
          aria-label="Sign out"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
