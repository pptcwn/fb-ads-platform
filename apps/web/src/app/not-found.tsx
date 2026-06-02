import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center bg-surface-50">
      <span className="text-6xl mb-6 opacity-40">404</span>
      <h1 className="text-2xl font-bold text-ink mb-2">Page not found</h1>
      <p className="text-sm text-ink-200 mb-6 max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link href="/dashboard" className="btn-primary">
        ← Back to Dashboard
      </Link>
    </div>
  );
}
