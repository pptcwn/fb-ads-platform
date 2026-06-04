import { cva, type VariantProps } from 'class-variance-authority';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export const statusBadgeVariants = cva('border-transparent font-medium', {
  variants: {
    tone: {
      success:
        'text-success bg-success-muted shadow-[0px_0px_0px_1px_theme(colors.success.border)]',
      warning:
        'text-warning bg-warning-muted shadow-[0px_0px_0px_1px_theme(colors.warning.border)]',
      danger:
        'text-danger bg-danger-muted shadow-[0px_0px_0px_1px_theme(colors.danger.border)]',
      ink: 'text-ink-100 bg-white/[0.04] shadow-[0px_0px_0px_1px_rgba(255,255,255,0.08)]',
      info: 'text-brand bg-brand-muted shadow-[0px_0px_0px_1px_theme(colors.brand.border)]',
    },
  },
  defaultVariants: {
    tone: 'ink',
  },
});

const STATUS_TONE: Record<string, VariantProps<typeof statusBadgeVariants>['tone']> = {
  ACTIVE: 'success',
  PAUSED: 'warning',
  DELETED: 'danger',
  ARCHIVED: 'ink',
  DRAFT: 'info',
  ERROR: 'danger',
  PENDING: 'warning',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'เปิดใช้งาน',
  PAUSED: 'หยุดชั่วคราว',
  DELETED: 'ลบแล้ว',
  ARCHIVED: 'เก็บถาวร',
  DRAFT: 'แบบร่าง',
  ERROR: 'ผิดพลาด',
  PENDING: 'รอดำเนินการ',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const key = status?.toUpperCase() || 'DRAFT';
  const tone = STATUS_TONE[key] ?? 'ink';

  return (
    <Badge
      variant="outline"
      className={cn(statusBadgeVariants({ tone }), className)}
    >
      {STATUS_LABELS[key] || status}
    </Badge>
  );
}