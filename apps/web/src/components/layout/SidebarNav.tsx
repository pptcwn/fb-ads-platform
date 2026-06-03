'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Megaphone,
  Users,
  Image,
  Zap,
  Calendar,
  Banknote,
  ShieldCheck,
  FlaskConical,
  BarChart3,
  Bell,
  LogOut,
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  exact: boolean;
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'หน้าหลัก',
    items: [{ label: 'ภาพรวม', href: '/dashboard', icon: LayoutDashboard, exact: true }],
  },
  {
    label: 'โฆษณา',
    items: [
      { label: 'แคมเปญ', href: '/dashboard/campaigns', icon: Megaphone, exact: false },
      { label: 'ครีเอทีฟ', href: '/dashboard/creatives', icon: Image, exact: false },
      { label: 'กลุ่มเป้าหมาย', href: '/dashboard/audiences', icon: Users, exact: false },
    ],
  },
  {
    label: 'อัตโนมัติ',
    items: [
      { label: 'กฎ', href: '/dashboard/rules', icon: Zap, exact: false },
      { label: 'ตารางเวลา', href: '/dashboard/schedules', icon: Calendar, exact: false },
      { label: 'งบประมาณ', href: '/dashboard/budget', icon: Banknote, exact: false },
      { label: 'อนุมัติ', href: '/dashboard/approvals', icon: ShieldCheck, exact: false },
    ],
  },
  {
    label: 'ทดลอง',
    items: [{ label: 'A/B Test', href: '/dashboard/abtest', icon: FlaskConical, exact: false }],
  },
  {
    label: 'ข้อมูลและแจ้งเตือน',
    items: [
      { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3, exact: false },
      { label: 'การแจ้งเตือน', href: '/dashboard/notifications', icon: Bell, exact: false },
    ],
  },
];

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');

  return (
    <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5" aria-label="เมนูหลัก">
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
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent ${
                  active
                    ? 'text-ink font-medium bg-surface-200'
                    : 'text-ink-100 hover:text-ink hover:bg-surface-100'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export default function SidebarNav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="lg:hidden fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full bg-accent text-white shadow-elevated flex items-center justify-center"
        onClick={() => setMobileOpen(true)}
        aria-label="เปิดเมนู"
      >
        <Menu className="w-5 h-5" />
      </button>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed lg:sticky top-0 z-40 lg:z-auto w-56 shrink-0 h-screen flex flex-col bg-surface-50 border-r border-surface-300 transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        role="navigation"
        aria-label="เมนูด้านข้าง"
      >
        <div className="px-5 py-4 border-b border-surface-300 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5 group" aria-label="FB Ads Platform">
            <span className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-white text-xs font-bold">
              F
            </span>
            <span className="font-semibold text-sm text-ink">FB Ads</span>
          </Link>
          <button
            type="button"
            className="lg:hidden p-1 text-ink-200 hover:text-ink"
            onClick={() => setMobileOpen(false)}
            aria-label="ปิดเมนู"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <NavContent onNavigate={() => setMobileOpen(false)} />

        <div className="px-3 py-4 border-t border-surface-300">
          <button
            type="button"
            onClick={async () => {
              try {
                await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
              } catch {
                /* ignore */
              }
              window.location.href = '/';
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-ink-100 hover:text-danger hover:bg-danger-muted transition-all"
            aria-label="ออกจากระบบ"
          >
            <LogOut className="w-4 h-4" aria-hidden />
            ออกจากระบบ
          </button>
        </div>
      </aside>
    </>
  );
}