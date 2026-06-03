'use client';

import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

interface ConnectionBannerProps {
  connected: boolean;
  message?: string;
}

export default function ConnectionBanner({ connected, message }: ConnectionBannerProps) {
  if (connected) return null;

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 rounded-lg border border-warning-border bg-warning-muted text-warning"
      role="alert"
    >
      <div className="flex items-start gap-2 flex-1">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden />
        <div>
          <p className="text-sm font-medium">ยังไม่ได้เชื่อมต่อ Meta</p>
          <p className="text-xs mt-0.5 opacity-90">
            {message || 'เชื่อมต่อบัญชี Facebook เพื่อซิงค์แคมเปญและดึง Insights'}
          </p>
        </div>
      </div>
      <Link href="/dashboard" className="btn-primary btn-sm shrink-0">
        เชื่อมต่อ Meta
      </Link>
    </div>
  );
}