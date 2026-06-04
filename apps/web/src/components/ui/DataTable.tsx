'use client';

import type { ReactNode } from 'react';

import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

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
    <Card className={cn('gap-0 overflow-hidden py-0', className)}>
      <CardContent className="p-0">
        <div className="overflow-x-auto">{children}</div>
      </CardContent>
    </Card>
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
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 mb-4 rounded-lg bg-brand-muted border border-brand-border">
      <span className="text-sm font-medium text-brand">เลือก {count} รายการ</span>
      <div className="flex flex-wrap gap-2">{children}</div>
      <Button type="button" variant="ghost" size="sm" onClick={onClear} className="ml-auto">
        ยกเลิก
      </Button>
    </div>
  );
}