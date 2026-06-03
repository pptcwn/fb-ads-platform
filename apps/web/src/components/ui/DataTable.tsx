'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import EmptyState from '@/components/EmptyState';

interface DataTableProps {
  children: ReactNode;
  className?: string;
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: { label: string; onClick: () => void };
}

export function DataTable({
  children,
  className,
  empty,
  emptyTitle = 'ไม่มีข้อมูล',
  emptyDescription,
  emptyAction,
}: DataTableProps) {
  if (empty) {
    return (
      <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
    );
  }

  return (
    <div className={cn('card overflow-hidden', className)}>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function DataTableToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center gap-3 mb-4', className)}>
      {children}
    </div>
  );
}

export function BulkActionBar({
  count,
  children,
  onClear,
}: {
  count: number;
  children: ReactNode;
  onClear: () => void;
}) {
  if (count === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 mb-4 rounded-lg bg-accent-muted border border-accent-border">
      <span className="text-sm font-medium text-accent">เลือก {count} รายการ</span>
      <div className="flex flex-wrap gap-2">{children}</div>
      <button type="button" onClick={onClear} className="btn-ghost btn-sm ml-auto">
        ยกเลิก
      </button>
    </div>
  );
}