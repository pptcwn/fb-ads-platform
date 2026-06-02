'use client';

import { AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import ErrorBoundary from './ErrorBoundary';
import { PageTransition } from './motion-wrapper';

interface ShellProps {
  children: React.ReactNode;
}

export default function Shell({ children }: ShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden">
        <ErrorBoundary>
          <AnimatePresence mode="wait">
            <PageTransition key={pathname}>
              {children}
            </PageTransition>
          </AnimatePresence>
        </ErrorBoundary>
      </main>
    </div>
  );
}
