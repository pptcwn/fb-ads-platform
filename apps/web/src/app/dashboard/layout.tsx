'use client';

import AppShell from '@/components/layout/AppShell';
import { AccountProvider } from '@/contexts/account-context';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AccountProvider>
      <AppShell>{children}</AppShell>
    </AccountProvider>
  );
}