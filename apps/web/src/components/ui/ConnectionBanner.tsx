'use client';

import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface ConnectionBannerProps {
  connected: boolean;
  message?: string;
}

export default function ConnectionBanner({ connected, message }: ConnectionBannerProps) {
  if (connected) return null;

  return (
    <Alert className="border-warning-border bg-warning-muted text-warning [&>svg]:text-warning">
      <AlertCircle aria-hidden />
      <AlertTitle>ยังไม่ได้เชื่อมต่อ Meta</AlertTitle>
      <AlertDescription>
        {message || 'เชื่อมต่อบัญชี Facebook เพื่อซิงค์แคมเปญและดึง Insights'}
      </AlertDescription>
      <AlertAction className="static sm:absolute sm:top-2 sm:right-2 mt-2 sm:mt-0">
        <Button render={<Link href="/dashboard" />} size="sm" nativeButton={false}>
          เชื่อมต่อ Meta
        </Button>
      </AlertAction>
    </Alert>
  );
}