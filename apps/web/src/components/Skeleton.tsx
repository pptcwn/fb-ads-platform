'use client';

import { Skeleton as UiSkeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'card' | 'table-row' | 'button' | 'circle';
  count?: number;
}

export default function Skeleton({ variant = 'text', count = 1, className }: SkeletonProps) {
  if (variant === 'text') {
    return (
      <div className="space-y-2" role="status" aria-label="Loading...">
        {Array.from({ length: count }).map((_, i) => (
          <UiSkeleton
            key={i}
            className={cn('h-4 w-full', i === count - 1 && 'w-3/4', className)}
          />
        ))}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
        role="status"
        aria-label="Loading..."
      >
        {Array.from({ length: count }).map((_, i) => (
          <Card key={i} size="sm" className={className}>
            <CardContent className="space-y-3 pt-4">
              <UiSkeleton className="h-4 w-2/3" />
              <UiSkeleton className="h-8 w-1/2" />
              <UiSkeleton className="h-3 w-full" />
              <UiSkeleton className="h-3 w-4/5" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (variant === 'table-row') {
    return (
      <div className="space-y-2" role="status" aria-label="Loading...">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex gap-4 py-3 px-4">
            <UiSkeleton className="h-4 w-1/3" />
            <UiSkeleton className="h-4 w-1/4" />
            <UiSkeleton className="h-4 w-1/6" />
            <UiSkeleton className="h-4 w-1/6" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'button') {
    return <UiSkeleton className={cn('h-10 w-32 rounded-lg', className)} />;
  }

  if (variant === 'circle') {
    return <UiSkeleton className={cn('rounded-full', className || 'size-10')} />;
  }

  return <UiSkeleton className={className} />;
}