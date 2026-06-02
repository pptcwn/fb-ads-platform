'use client';

import type { ReactNode } from 'react';
import { Package } from 'lucide-react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export default function EmptyState({ icon = <Package className="w-4 h-4" />, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-4 text-center ${className}`}>
      <div className="mb-4 opacity-60">{icon}</div>
      <h3 className="text-lg font-semibold text-ink mb-1">{title}</h3>
      {description && <p className="text-sm text-ink-200 max-w-md mb-4">{description}</p>}
      {action && (
        <button onClick={action.onClick} className="btn-primary text-sm">
          {action.label}
        </button>
      )}
    </div>
  );
}
