'use client';

interface SkeletonProps {
  className?: string;
  /** Predefined shapes */
  variant?: 'text' | 'card' | 'table-row' | 'button' | 'circle';
  /** Number of repeated items (for lists/tables) */
  count?: number;
}

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-surface-200 ${className}`} />;
}

export default function Skeleton({ variant = 'text', count = 1, className }: SkeletonProps) {
  if (variant === 'text') {
    return (
      <div className="space-y-2" role="status" aria-label="Loading...">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonBlock key={i} className={`h-4 w-full ${className} ${i === count - 1 ? 'w-3/4' : ''}`} />
        ))}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" role="status" aria-label="Loading...">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={`card p-4 space-y-3 ${className}`}>
            <SkeletonBlock className="h-4 w-2/3" />
            <SkeletonBlock className="h-8 w-1/2" />
            <SkeletonBlock className="h-3 w-full" />
            <SkeletonBlock className="h-3 w-4/5" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'table-row') {
    return (
      <div className="space-y-2" role="status" aria-label="Loading...">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex gap-4 py-3 px-4">
            <SkeletonBlock className="h-4 w-1/3" />
            <SkeletonBlock className="h-4 w-1/4" />
            <SkeletonBlock className="h-4 w-1/6" />
            <SkeletonBlock className="h-4 w-1/6" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'button') {
    return <SkeletonBlock className={`h-10 w-32 rounded-lg ${className}`} />;
  }

  if (variant === 'circle') {
    return <SkeletonBlock className={`rounded-full ${className || 'w-10 h-10'}`} />;
  }

  return <SkeletonBlock className={className} />;
}
