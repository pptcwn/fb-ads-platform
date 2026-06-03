import { Suspense } from 'react';

export default function CreateCampaignLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="py-24 text-center text-ink-300 animate-pulse">กำลังโหลด…</div>}>
      {children}
    </Suspense>
  );
}