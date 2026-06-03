'use client';

import AppShell from './layout/AppShell';

interface ShellProps {
  children: React.ReactNode;
  onSync?: () => void;
  syncing?: boolean;
}

/** @deprecated Use AppShell via dashboard layout; kept for gradual migration */
export default function Shell({ children, onSync, syncing }: ShellProps) {
  return (
    <AppShell onSync={onSync} syncing={syncing}>
      {children}
    </AppShell>
  );
}
