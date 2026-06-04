'use client';

import { AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import ErrorBoundary from '@/components/ErrorBoundary';
import { PageTransition } from '@/components/motion-wrapper';
import SidebarNav from './SidebarNav';
import TopBar from './TopBar';
import AccountSelectionSync from './AccountSelectionSync';

export function DashboardChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isCreateFlow = pathname.startsWith('/dashboard/campaigns/create');

  return (
    <>
      <AccountSelectionSync />
      <div className="flex min-h-screen bg-bg">
        <SidebarNav />
        <div className="flex-1 flex flex-col min-w-0 lg:pl-0">
          {!isCreateFlow && <TopBar />}
          <main id="main-content" className="flex-1 overflow-x-hidden">
            <ErrorBoundary>
              <AnimatePresence mode="sync" initial={false}>
                <PageTransition key={pathname}>
                  <div className="legacy-surface px-4 sm:px-6 py-6 max-w-[1600px] mx-auto w-full">
                    {children}
                  </div>
                </PageTransition>
              </AnimatePresence>
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </>
  );
}