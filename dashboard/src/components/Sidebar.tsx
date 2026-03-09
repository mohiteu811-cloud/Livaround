'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import {
  LayoutDashboard,
  Building2,
  CalendarCheck,
  Briefcase,
  Users,
  Package,
  AlertTriangle,
  LogOut,
  Menu,
  X,
  Wrench,
  ClipboardList,
  UserCircle,
  BarChart3,
} from 'lucide-react';
import { clearToken } from '@/lib/auth';

const nav = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
  { href: '/properties', icon: Building2, label: 'Properties' },
  { href: '/bookings', icon: CalendarCheck, label: 'Bookings' },
  { href: '/jobs', icon: Briefcase, label: 'Jobs' },
  { href: '/workers', icon: Users, label: 'Workers' },
  { href: '/inventory', icon: Package, label: 'Inventory' },
  { href: '/issues', icon: AlertTriangle, label: 'Issues' },
  { group: true, label: 'Maintenance' },
  { href: '/trade-roles', icon: Wrench, label: 'Trade Roles' },
  { href: '/maintenance', icon: ClipboardList, label: 'Requests' },
  { group: true, label: 'Ownership' },
  { href: '/owners', icon: UserCircle, label: 'Owners' },
  { href: '/revenue', icon: BarChart3, label: 'Revenue' },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <>
      {nav.map((item, i) => {
        if ('group' in item) {
          return (
            <p key={i} className="px-3 pt-4 pb-1 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              {item.label}
            </p>
          );
        }
        const { href, icon: Icon, label } = item as { href: string; icon: React.ElementType; label: string };
        const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
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

export function MobileHeader() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function handleLogout() {
    clearToken();
    router.push('/login');
  }

  return (
    <>
      {/* Top bar — mobile only */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-xs">
            L
          </div>
          <span className="font-bold text-base text-white">LivAround</span>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="p-2 text-slate-400 hover:text-white"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
      </header>

      {/* Backdrop */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-in drawer */}
      <div
        className={clsx(
          'md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-200',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-sm">
              L
            </div>
            <span className="font-bold text-lg text-white">LivAround</span>
          </div>
          <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
            <X size={20} />
          </button>
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

export function Sidebar() {
  const router = useRouter();

  function handleLogout() {
    clearToken();
    router.push('/login');
  }

  return (
    <aside className="hidden md:flex flex-col w-64 shrink-0 bg-slate-900 border-r border-slate-800 h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800">
        <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-sm">
          L
        </div>
        <span className="font-bold text-lg text-white">LivAround</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
        <NavLinks />
      </nav>

      {/* Logout */}
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
