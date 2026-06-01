'use client';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, children, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-semibold text-ink" style={{ letterSpacing: '-0.02em' }}>{title}</h1>
        {subtitle && <p className="text-sm text-ink-200 mt-0.5">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 ml-4">
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}
