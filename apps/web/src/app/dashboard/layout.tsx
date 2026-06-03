'use client';

import { AccountProvider } from '@/contexts/account-context';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AccountProvider>{children}</AccountProvider>;
}