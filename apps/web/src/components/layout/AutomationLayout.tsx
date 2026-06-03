'use client';

import type { ReactNode } from 'react';
import PageLayout from './PageLayout';

interface AutomationLayoutProps {
  title: string;
  subtitle?: string;
  list: ReactNode;
  detail: ReactNode;
  actions?: ReactNode;
  /** When set, mobile shows detail full-screen; list hidden until cleared */
  selectedId?: string | null;
}

export default function AutomationLayout({
  title,
  subtitle,
  list,
  detail,
  actions,
  selectedId = null,
}: AutomationLayoutProps) {
  const showDetailMobile = selectedId != null;

  return (
    <PageLayout title={title} subtitle={subtitle} actions={actions}>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(240px,320px)_1fr] gap-6 min-h-[480px]">
        <div
          className={`card p-3 overflow-y-auto max-h-[70vh] lg:max-h-none ${
            showDetailMobile ? 'hidden lg:block' : 'block'
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