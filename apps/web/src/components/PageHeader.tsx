'use client';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, children, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-8 gap-4">
      <div>
        <h1 className="text-3xl font-semibold text-ink" style={{ letterSpacing: '-0.02em' }}>{title}</h1>
        {subtitle && <p className="text-sm text-ink-100 mt-1">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}
