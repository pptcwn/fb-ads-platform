'use client';

import { DashboardChrome } from '@/components/layout/DashboardChrome';
import { AccountProvider } from '@/contexts/account-context';
import { DashboardSyncProvider } from '@/contexts/dashboard-sync-context';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AccountProvider>
      <DashboardSyncProvider>
        <DashboardChrome>{children}</DashboardChrome>
      </DashboardSyncProvider>
    </AccountProvider>
  );
}