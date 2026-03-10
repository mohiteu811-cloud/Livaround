'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { saveToken } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Input, FormField } from '@/components/ui/Input';

type Role = 'HOST' | 'OWNER' | 'WORKER' | 'CLIENT';

const ROLES: { id: Role; label: string; icon: string; description: string; redirect: string; canRegister?: boolean }[] = [
  { id: 'HOST',   label: 'Host',   icon: '🏠', description: 'Manage properties, bookings and staff', redirect: '/dashboard', canRegister: true },
  { id: 'CLIENT', label: 'Business', icon: '🏢', description: 'Post shifts and hire on-demand staff', redirect: '/client/dashboard', canRegister: true },
  { id: 'OWNER',  label: 'Owner',  icon: '👤', description: 'View your property performance and reports', redirect: '/owner/dashboard' },
  { id: 'WORKER', label: 'Worker', icon: '🔧', description: 'Access your jobs and property guides', redirect: '/worker/jobs' },
];

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>('HOST');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', businessName: '', businessType: 'RESTAURANT', city: '' });

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setError('');
  }

  function switchRole(r: Role) {
    setRole(r);
    setMode('login');
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      let res: { token: string; user: { role: string } };
      if (role === 'HOST' && mode === 'register') {
        res = await api.auth.register(form);
      } else if (role === 'CLIENT' && mode === 'register') {
        res = await api.auth.registerClient(form);
      } else {
        res = await api.auth.login(form.email.trim().toLowerCase(), form.password);
        if (res.user.role !== role) {
          const actual = ROLES.find((r) => r.id === res.user.role);
          setError(
            actual
              ? `This account is a ${actual.label.toLowerCase()} account. Please select the "${actual.label}" tab.`
              : 'Wrong role selected for this account.'
          );
          return;
        }
      }
      saveToken(res.token);
      router.push(ROLES.find((r) => r.id === role)!.redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const activeRole = ROLES.find((r) => r.id === role)!;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold text-lg">L</div>
          <span className="text-2xl font-bold text-white">LivAround</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          {/* Role tabs */}
          <div className="flex border-b border-slate-800">
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => switchRole(r.id)}
                className={`flex-1 flex flex-col items-center gap-1 py-3.5 text-xs font-medium transition-colors border-b-2 ${
                  role === r.id
                    ? 'border-brand-500 text-slate-100 bg-slate-800/50'
                    : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'
                }`}
              >
                <span className="text-lg">{r.icon}</span>
                {r.label}
              </button>
            ))}
          </div>

          {/* Form */}
          <div className="p-8">
            <h1 className="text-xl font-semibold text-slate-100 mb-1">
              {(role === 'HOST' || role === 'CLIENT') && mode === 'register'
                ? `Create ${role === 'CLIENT' ? 'business' : 'host'} account`
                : `Sign in as ${activeRole.label.toLowerCase()}`}
            </h1>
            <p className="text-sm text-slate-400 mb-6">{activeRole.description}</p>

            {error && (
              <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {(role === 'HOST' || role === 'CLIENT') && mode === 'register' && (
                <FormField label="Full name">
                  <Input placeholder="Arjun Sharma" value={form.name} onChange={(e) => set('name', e.target.value)} required />
                </FormField>
              )}
              {role === 'CLIENT' && mode === 'register' && (
                <FormField label="Business name">
                  <Input placeholder="The Beach Bar" value={form.businessName} onChange={(e) => set('businessName', e.target.value)} required />
                </FormField>
              )}
              {role === 'CLIENT' && mode === 'register' && (
                <FormField label="Business type">
                  <select
                    value={form.businessType}
                    onChange={(e) => set('businessType', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-brand-500"
                  >
                    {['RESTAURANT', 'HOTEL', 'VILLA', 'RETAIL', 'EVENT', 'OTHER'].map((t) => (
                      <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
                    ))}
                  </select>
                </FormField>
              )}
              {role === 'CLIENT' && mode === 'register' && (
                <FormField label="City">
                  <Input placeholder="Goa" value={form.city} onChange={(e) => set('city', e.target.value)} required />
                </FormField>
              )}
              <FormField label="Email address">
                <Input type="email" placeholder="you@example.com" value={form.email} onChange={(e) => set('email', e.target.value)} required />
              </FormField>
              <FormField label="Password">
                <Input type="password" placeholder="••••••••" value={form.password} onChange={(e) => set('password', e.target.value)} required minLength={8} />
              </FormField>
              {(role === 'HOST' || role === 'CLIENT') && mode === 'register' && (
                <FormField label="Phone (optional)">
                  <Input placeholder="+91 98765 43210" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
                </FormField>
              )}
              <Button type="submit" loading={loading} className="w-full justify-center">
                {(role === 'HOST' || role === 'CLIENT') && mode === 'register' ? 'Create account' : 'Sign in'}
              </Button>
            </form>

            {(role === 'HOST' || role === 'CLIENT') && (
              <p className="mt-4 text-center text-sm text-slate-500">
                {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
                <button
                  onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
                  className="text-brand-400 hover:text-brand-300 font-medium"
                >
                  {mode === 'login' ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
