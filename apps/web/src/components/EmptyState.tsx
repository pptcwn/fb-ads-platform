'use client';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export default function EmptyState({ icon = '📭', title, description, action, className }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-4 text-center ${className}`}>
      <span className="text-5xl mb-4 opacity-60">{icon}</span>
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
