'use client';

import type { ReactNode } from 'react';

/**
 * @deprecated Layout is provided by `app/dashboard/layout.tsx`. Pass through children only.
 */
export default function Shell({ children }: { children: ReactNode }) {
  return <>{children}</>;
}