'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ClientProfile, Shift } from '@/lib/api';
import { CalendarDays, Users, CheckCircle, Clock, Plus, ChevronRight } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'text-blue-400 bg-blue-400/10',
  PARTIALLY_FILLED: 'text-yellow-400 bg-yellow-400/10',
  FILLED: 'text-green-400 bg-green-400/10',
  IN_PROGRESS: 'text-purple-400 bg-purple-400/10',
  COMPLETED: 'text-slate-400 bg-slate-400/10',
  CANCELLED: 'text-red-400 bg-red-400/10',
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  PARTIALLY_FILLED: 'Partially filled',
  FILLED: 'Filled',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

function ShiftCard({ shift }: { shift: Shift }) {
  const confirmedCount = shift.applications?.length ?? 0;

  return (
    <Link
      href={`/client/shifts/${shift.id}`}
      className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors"
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 text-sm font-bold shrink-0">
          {shift.role.slice(0, 2)}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-100">
              {shift.role.charAt(0) + shift.role.slice(1).toLowerCase()}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[shift.status]}`}>
              {STATUS_LABELS[shift.status]}
            </span>
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            {shift.venue?.name} · {shift.date} · {shift.startTime}–{shift.endTime}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right hidden sm:block">
          <div className="text-sm text-slate-300">
            {confirmedCount}/{shift.workersNeeded} confirmed
          </div>
          <div className="text-xs text-slate-500">
            {shift.currency === 'INR' ? '₹' : shift.currency}{shift.hourlyRate}/hr
          </div>
        </div>
        <ChevronRight size={16} className="text-slate-600" />
      </div>
    </Link>
  );
}

export default function ClientDashboard() {
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [upcomingShifts, setUpcomingShifts] = useState<Shift[]>([]);
  const [allShifts, setAllShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.client.me(),
      api.shifts.list({ upcoming: 'true' }),
      api.shifts.list(),
    ])
      .then(([c, upcoming, all]) => {
        setClient(c);
        setUpcomingShifts(upcoming as unknown as Shift[]);
        setAllShifts(all as unknown as Shift[]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalCompleted = allShifts.filter((s) => s.status === 'COMPLETED').length;
  const totalOpen = allShifts.filter((s) => ['OPEN', 'PARTIALLY_FILLED', 'FILLED'].includes(s.status)).length;
  const totalWorkers = allShifts
    .filter((s) => s.status === 'COMPLETED')
    .reduce((sum, s) => sum + (s.applications?.length ?? 0), 0);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">
            {client ? `Welcome, ${client.businessName}` : 'Dashboard'}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {client?.city}{client?.businessType ? ` · ${client.businessType.charAt(0) + client.businessType.slice(1).toLowerCase()}` : ''}
          </p>
        </div>
        <Link
          href="/client/shifts/new"
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} />
          Post a Shift
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { icon: CalendarDays, label: 'Active shifts', value: totalOpen, color: 'text-blue-400' },
          { icon: Clock, label: 'Upcoming', value: upcomingShifts.length, color: 'text-yellow-400' },
          { icon: CheckCircle, label: 'Completed', value: totalCompleted, color: 'text-green-400' },
          { icon: Users, label: 'Workers hired', value: totalWorkers, color: 'text-purple-400' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <Icon size={20} className={`${color} mb-2`} />
            <div className="text-2xl font-bold text-slate-100">{value}</div>
            <div className="text-xs text-slate-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Upcoming shifts */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-100">Upcoming shifts</h2>
          <Link href="/client/shifts" className="text-sm text-brand-400 hover:text-brand-300">
            View all
          </Link>
        </div>

        {upcomingShifts.length === 0 ? (
          <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-xl">
            <CalendarDays size={32} className="text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No upcoming shifts</p>
            <Link
              href="/client/shifts/new"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm rounded-lg transition-colors"
            >
              <Plus size={14} />
              Post your first shift
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingShifts.slice(0, 5).map((shift) => (
              <ShiftCard key={shift.id} shift={shift} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
