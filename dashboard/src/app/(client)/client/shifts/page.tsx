'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, Shift } from '@/lib/api';
import { Plus, CalendarDays, ChevronRight, Search } from 'lucide-react';

const TABS = [
  { id: 'active', label: 'Active', statuses: ['OPEN', 'PARTIALLY_FILLED', 'FILLED', 'IN_PROGRESS'] },
  { id: 'completed', label: 'Completed', statuses: ['COMPLETED'] },
  { id: 'cancelled', label: 'Cancelled', statuses: ['CANCELLED'] },
];

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

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.shifts.list()
      .then((s) => setShifts(s as unknown as Shift[]))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const tab = TABS.find((t) => t.id === activeTab)!;
  const filtered = shifts
    .filter((s) => tab.statuses.includes(s.status))
    .filter((s) =>
      !search ||
      s.role.toLowerCase().includes(search.toLowerCase()) ||
      s.venue?.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.date.includes(search)
    );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Shifts</h1>
        <Link
          href="/client/shifts/new"
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} />
          Post Shift
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Search by role, venue, or date…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-brand-500 placeholder:text-slate-600"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-slate-900 border border-slate-800 rounded-xl p-1">
        {TABS.map((t) => {
          const count = shifts.filter((s) => t.statuses.includes(s.status)).length;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === t.id
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {t.label}
              {count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === t.id ? 'bg-brand-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-xl">
          <CalendarDays size={32} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">
            {search ? 'No shifts match your search' : `No ${activeTab} shifts`}
          </p>
          {activeTab === 'active' && !search && (
            <Link
              href="/client/shifts/new"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm rounded-lg transition-colors"
            >
              <Plus size={14} />
              Post your first shift
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((shift) => {
            const confirmedCount = shift.applications?.length ?? 0;
            const hourlyDisplay = `${shift.currency === 'INR' ? '₹' : shift.currency}${shift.hourlyRate}/hr`;

            return (
              <Link
                key={shift.id}
                href={`/client/shifts/${shift.id}`}
                className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 text-sm font-bold shrink-0">
                    {shift.role.slice(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-100">
                        {shift.role.charAt(0) + shift.role.slice(1).toLowerCase()}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[shift.status]}`}>
                        {STATUS_LABELS[shift.status]}
                      </span>
                      {shift.urgency === 'ASAP' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 font-medium">
                          ASAP
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {shift.venue?.name} · {shift.date} · {shift.startTime}–{shift.endTime}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right hidden sm:block">
                    <div className="text-sm text-slate-300">
                      {confirmedCount}/{shift.workersNeeded} workers
                    </div>
                    <div className="text-xs text-slate-500">{hourlyDisplay}</div>
                  </div>
                  <ChevronRight size={16} className="text-slate-600" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
