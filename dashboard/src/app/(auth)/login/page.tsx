'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { saveToken } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Input, FormField } from '@/components/ui/Input';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res =
        mode === 'login'
          ? await api.auth.login(form.email, form.password)
          : await api.auth.register(form);
      saveToken(res.token);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold text-lg">
            L
          </div>
          <span className="text-2xl font-bold text-white">LivAround</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <h1 className="text-xl font-semibold text-slate-100 mb-1">
            {mode === 'login' ? 'Sign in to your account' : 'Create host account'}
          </h1>
          <p className="text-sm text-slate-400 mb-6">
            {mode === 'login'
              ? 'Welcome back — manage your properties and staff.'
              : 'Start managing your LivAround properties.'}
          </p>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <FormField label="Full name">
                <Input
                  placeholder="Arjun Sharma"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  required
                />
              </FormField>
            )}
            <FormField label="Email address">
              <Input
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                required
              />
            </FormField>
            <FormField label="Password">
              <Input
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                required
                minLength={8}
              />
            </FormField>
            {mode === 'register' && (
              <FormField label="Phone (optional)">
                <Input
                  placeholder="+91 98765 43210"
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                />
              </FormField>
            )}
            <Button type="submit" loading={loading} className="w-full justify-center">
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-500">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="text-brand-400 hover:text-brand-300 font-medium"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>

          {mode === 'login' && (
            <div className="mt-4 p-3 bg-slate-800/50 rounded-lg text-xs text-slate-500">
              <strong className="text-slate-400">Demo:</strong> host@livaround.com / password123
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
