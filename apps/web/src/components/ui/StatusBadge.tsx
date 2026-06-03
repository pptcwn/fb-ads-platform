import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'badge-success',
  PAUSED: 'badge-warning',
  DELETED: 'badge-danger',
  ARCHIVED: 'badge-ink',
  DRAFT: 'badge-info',
  ERROR: 'badge-danger',
  PENDING: 'badge-warning',
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
  return (
    <span className={cn(STATUS_STYLES[key] || 'badge-ink', className)}>
      {STATUS_LABELS[key] || status}
    </span>
  );
}