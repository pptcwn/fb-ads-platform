'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await axios.post('/api/auth/register', { name, email, password });
      localStorage.setItem('token', data.accessToken);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50">
      <div className="card p-8 w-96">
        <h1 className="text-2xl font-bold mb-2 text-center text-ink">Create Account</h1>
        <p className="text-center text-sm text-ink-300 mb-6">Join FB Ads Platform</p>
        {error && <div className="msg-error mb-4">{error}</div>}
        <form onSubmit={handleRegister}>
          <input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-3 border border-surface-200 rounded-lg mb-3 bg-surface-50 text-ink focus:outline-none focus:ring-2 focus:ring-accent/50"
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 border border-surface-200 rounded-lg mb-3 bg-surface-50 text-ink focus:outline-none focus:ring-2 focus:ring-accent/50"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 border border-surface-200 rounded-lg mb-4 bg-surface-50 text-ink focus:outline-none focus:ring-2 focus:ring-accent/50"
            required
          />
          <button type="submit" className="w-full btn-primary btn-sm py-3">
            Create Account
          </button>
        </form>
        <p className="text-center mt-4 text-xs text-ink-300">
          Already have an account? <a href="/" className="text-accent hover:underline">Sign In</a>
        </p>
      </div>
    </div>
  );
}
