'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api-client';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.login(email, password);
      const redirect = searchParams.get('redirect');
      router.push(redirect && redirect.startsWith('/dashboard') ? redirect : '/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(msg || (err?.message && !err?.response ? err.message : 'Invalid credentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="w-12 h-12 rounded-lg bg-accent flex items-center justify-center mx-auto mb-4 transition-transform hover:scale-105">
            <span className="text-white text-lg font-bold">F</span>
          </div>
          <h1 className="text-2xl font-semibold text-ink">FB Ads Platform</h1>
          <p className="text-sm text-ink-100 mt-2">Multi-Account Automation</p>
        </div>

        <div className="card p-6 sm:p-8">
          {error && (
            <div className="msg-error mb-5 flex items-start justify-between gap-3">
              <span className="text-sm">{error}</span>
              <button
                onClick={() => setError('')}
                className="text-danger hover:text-danger/80 flex-shrink-0 cursor-pointer"
                aria-label="Dismiss error"
              >✕</button>
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-ink-100 mb-1.5 uppercase tracking-wider">Email</label>
              <input
                id="email"
                type="email"
                placeholder="admin@test.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-ink-100 mb-1.5 uppercase tracking-wider">Password</label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full"
              />
            </div>
            <button
              type="submit"
              className="btn-primary w-full mt-6"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-xs text-ink-100">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-accent hover:text-blue-500 font-medium transition-colors">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-ink-300">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}