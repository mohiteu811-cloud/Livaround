'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { api, User } from '@/lib/api';

export default function WorkerShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api.auth.me()
      .then(u => {
        if (u.role !== 'WORKER') { router.replace('/worker/login'); return; }
        setUser(u);
        setReady(true);
      })
      .catch(() => router.replace('/worker/login'));
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tabs = [
    { href: '/worker/jobs', label: 'Jobs', icon: '🔧' },
    { href: '/worker/profile', label: 'Profile', icon: '👤' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col max-w-lg mx-auto">
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
