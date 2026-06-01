'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const { data } = await axios.post('/api/auth/login', { email, password });
      localStorage.setItem('token', data.accessToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Invalid credentials');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-surface to-surface-50 p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl font-bold">F</span>
          </div>
          <h1 className="text-xl font-bold text-ink">FB Ads Platform</h1>
          <p className="text-sm text-ink-300 mt-1">Multi-Account Automation</p>
        </div>

        {/* Card */}
        <div className="card p-6">
          {error && (
            <div className="msg-error mb-4 flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError('')} className="text-danger/70 hover:text-danger">✕</button>
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs text-ink-300 mb-1.5 font-medium">Email</label>
              <input
                type="email"
                placeholder="admin@test.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-ink-300 mb-1.5 font-medium">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full"
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full mt-2">
              Sign In
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-xs text-ink-300">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-accent hover:text-accent-hover font-medium">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
