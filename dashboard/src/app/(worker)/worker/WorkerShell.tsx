'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { api, User } from '@/lib/api';
import { Lang, getLang, setLang, t } from './i18n';

export function useLang(): [Lang, (l: Lang) => void] {
  const [lang, setLangState] = useState<Lang>('en');
  useEffect(() => { setLangState(getLang()); }, []);
  function toggle(l: Lang) { setLang(l); setLangState(l); }
  return [lang, toggle];
}

export default function WorkerShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [lang, setLangState] = useLang();

  useEffect(() => {
    api.auth.me()
      .then(u => {
        if (u.role !== 'WORKER') { router.replace('/login'); return; }
        setIsSupervisor(u.worker?.isSupervisor ?? false);
        setReady(true);
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tr = t(lang);
  const tabs = [
    { href: '/worker/jobs', label: tr.jobs, icon: '🔧' },
    ...(isSupervisor ? [{ href: '/worker/issues/new', label: 'Report Issue', icon: '⚠️' }] : []),
    { href: '/worker/profile', label: tr.profile, icon: '👤' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col max-w-lg mx-auto">
      {/* Language toggle */}
      <div className="fixed top-3 right-4 z-50 flex bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
        {(['en', 'hi'] as Lang[]).map(l => (
          <button
            key={l}
            onClick={() => setLangState(l)}
            className={`px-3 py-1.5 text-xs font-bold transition-colors ${
              lang === l ? 'bg-blue-600 text-white' : 'text-slate-400'
            }`}
          >
            {l === 'en' ? 'EN' : 'हिं'}
          </button>
        ))}
      </div>

      <div className="flex-1 pb-20">{children}</div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-slate-900 border-t border-slate-800 flex">
        {tabs.map(tab => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-semibold transition-colors ${
                active ? 'text-blue-400' : 'text-slate-500'
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function useWorkerUser() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    api.auth.me().then(setUser).catch(() => {});
  }, []);
  return user;
}
