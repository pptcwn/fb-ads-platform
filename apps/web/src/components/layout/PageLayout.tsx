'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageLayoutProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
  children: ReactNode;
}

export default function PageLayout({
  title,
  subtitle,
  breadcrumbs,
  actions,
  children,
}: PageLayoutProps) {
  return (
    <div className="space-y-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="breadcrumb" className="flex items-center gap-1 text-xs text-ink-200 flex-wrap">
          {breadcrumbs.map((item, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              {i > 0 && <ChevronRight className="w-3 h-3" aria-hidden />}
              {item.href ? (
                <Link href={item.href} className="hover:text-ink transition-colors">
                  {item.label}
                </Link>
              ) : (
                <span className="text-ink-100">{item.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-ink tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-ink-100 mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>}
      </div>
      {children}
    </div>
  );
}