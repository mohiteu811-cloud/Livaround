'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { saveToken } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Input, FormField } from '@/components/ui/Input';

export default function OwnerLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', password: '' });

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.auth.login(form.email, form.password);
      if (res.user.role !== 'OWNER') {
        setError('This login is for property owners only. Hosts should use the main login page.');
        return;
      }
      saveToken(res.token);
      router.push('/owner/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center text-white font-bold text-lg">
            L
          </div>
          <span className="text-2xl font-bold text-slate-100">LivAround</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <h1 className="text-xl font-semibold text-slate-100 mb-1">Owner portal</h1>
          <p className="text-sm text-slate-400 mb-6">Sign in to view your property performance and reports.</p>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
              />
            </FormField>
            <Button type="submit" loading={loading} className="w-full justify-center bg-violet-600 hover:bg-violet-700">
              Sign in as owner
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-600">
            Are you a property manager?{' '}
            <a href="/login" className="text-slate-500 hover:text-slate-400">Sign in here</a>
          </p>
        </div>
      </div>
    </div>
  );
}
