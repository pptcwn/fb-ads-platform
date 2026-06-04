'use client';

import type { ReactNode } from 'react';
import PageLayout from './PageLayout';

interface AutomationLayoutProps {
  title: string;
  subtitle?: string;
  list: ReactNode;
  detail: ReactNode;
  actions?: ReactNode;
  /** When set, mobile shows detail; list hidden until cleared unless stackOnMobile */
  selectedId?: string | null;
  /** Keep list visible below lg while detail is open (e.g. create form) */
  stackOnMobile?: boolean;
}

export default function AutomationLayout({
  title,
  subtitle,
  list,
  detail,
  actions,
  selectedId = null,
  stackOnMobile = false,
}: AutomationLayoutProps) {
  const showDetailMobile = selectedId != null;
  const hideListOnMobile = showDetailMobile && !stackOnMobile;

  return (
    <PageLayout title={title} subtitle={subtitle} actions={actions}>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(240px,320px)_1fr] gap-6 min-h-[480px]">
        <div
          className={`card p-3 overflow-y-auto max-h-[70vh] lg:max-h-none ${
            hideListOnMobile ? 'hidden lg:block' : 'block'
          }`}
        >
          {list}
        </div>
        <div
          className={`card p-5 overflow-y-auto ${
            showDetailMobile ? 'block' : 'hidden lg:block'
          }`}
        >
          {detail}
        </div>
      </div>
    </PageLayout>
  );
}