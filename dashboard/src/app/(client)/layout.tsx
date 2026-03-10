'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import clsx from 'clsx';
import {
  LayoutDashboard,
  CalendarDays,
  MapPin,
  Settings,
  LogOut,
  Plus,
  Menu,
  X,
} from 'lucide-react';
import { getToken, clearToken } from '@/lib/auth';

const nav = [
  { href: '/client/dashboard', icon: LayoutDashboard, label: 'Overview' },
  { href: '/client/shifts', icon: CalendarDays, label: 'Shifts' },
  { href: '/client/venues', icon: MapPin, label: 'Venues' },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <>
      {nav.map(({ href, icon: Icon, label }) => {
        const active = pathname === href || (href !== '/client/dashboard' && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              active
                ? 'bg-brand-600/20 text-brand-400'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            )}
          >
            <Icon size={18} className={active ? 'text-brand-400' : ''} />
            {label}
          </Link>
        );
      })}
    </>
  );
}

function ClientSidebar() {
  const router = useRouter();

  function handleLogout() {
    clearToken();
    router.push('/login');
  }

  return (
    <aside className="hidden md:flex flex-col w-64 shrink-0 bg-slate-900 border-r border-slate-800 h-screen sticky top-0">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800">
        <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-sm">L</div>
        <div>
          <span className="font-bold text-lg text-white block leading-none">LivAround</span>
          <span className="text-xs text-slate-500">Business</span>
        </div>
      </div>

      <div className="px-3 py-3 border-b border-slate-800">
        <Link
          href="/client/shifts/new"
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-colors justify-center"
        >
          <Plus size={16} />
          Post a Shift
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <NavLinks />
      </nav>

      <div className="px-3 py-4 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors w-full"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </div>
    </aside>
  );
}

function MobileClientHeader() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function handleLogout() {
    clearToken();
    router.push('/login');
  }

  return (
    <>
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-xs">L</div>
          <span className="font-bold text-base text-white">LivAround</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/client/shifts/new" className="p-2 text-brand-400 hover:text-brand-300">
            <Plus size={20} />
          </Link>
          <button onClick={() => setOpen(true)} className="p-2 text-slate-400 hover:text-white">
            <Menu size={22} />
          </button>
        </div>
      </header>

      {open && <div className="md:hidden fixed inset-0 bg-black/60 z-40" onClick={() => setOpen(false)} />}

      <div className={clsx(
        'md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-200',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
          <span className="font-bold text-lg text-white">LivAround</span>
          <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <NavLinks onNavigate={() => setOpen(false)} />
        </nav>
        <div className="px-3 py-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors w-full"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </div>
    </>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-950">
      <ClientSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileClientHeader />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
