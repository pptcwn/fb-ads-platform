'use client';

import { AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import ErrorBoundary from '@/components/ErrorBoundary';
import { PageTransition } from '@/components/motion-wrapper';
import { AccountProvider } from '@/contexts/account-context';
import SidebarNav from './SidebarNav';
import TopBar from './TopBar';

interface AppShellProps {
  children: React.ReactNode;
  onSync?: () => void;
  syncing?: boolean;
}

export default function AppShell({ children, onSync, syncing }: AppShellProps) {
  const pathname = usePathname();
  const isCreateFlow = pathname.startsWith('/dashboard/campaigns/create');

  return (
    <AccountProvider>
      <div className="flex min-h-screen bg-bg">
        <SidebarNav />
        <div className="flex-1 flex flex-col min-w-0 lg:pl-0">
          {!isCreateFlow && <TopBar onSync={onSync} syncing={syncing} />}
          <main className="flex-1 overflow-x-hidden">
            <ErrorBoundary>
              <AnimatePresence mode="wait">
                <PageTransition key={pathname}>
                  <div className="px-4 sm:px-6 py-6 max-w-[1600px] mx-auto w-full">{children}</div>
                </PageTransition>
              </AnimatePresence>
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </AccountProvider>
  );
}