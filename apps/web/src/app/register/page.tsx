'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api-client';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.register(name, email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main id="main-content" className="register-page min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="w-full max-w-sm">
        <div className="card p-8">
          <h1 className="text-2xl font-semibold mb-2 text-center text-ink">Create Account</h1>
          <p className="text-center text-sm text-ink-100 mb-6">Join FB Ads Platform</p>
          {error && <div className="msg-error mb-4">{error}</div>}
          <form onSubmit={handleRegister} className="space-y-3">
            <div>
              <label htmlFor="name" className="block text-xs font-medium text-ink-100 mb-1.5 uppercase tracking-wider">Full Name</label>
              <input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-ink-100 mb-1.5 uppercase tracking-wider">Email</label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
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
              />
            </div>
            <button 
              type="submit" 
              className="btn-primary w-full py-2.5 mt-4"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </form>
          <p className="text-center mt-5 text-xs text-ink-100">
            Already have an account?{' '}
            <a href="/" className="text-brand hover:text-blue-500 font-medium transition-colors">
              Sign In
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
