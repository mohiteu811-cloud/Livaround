'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import WorkerShell, { useWorkerUser } from '../WorkerShell';
import { api, Job } from '@/lib/api';

const STATUS_COLOR: Record<string, string> = {
  DISPATCHED: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  ACCEPTED:   'bg-blue-500/10 text-blue-400 border-blue-500/30',
  IN_PROGRESS:'bg-purple-500/10 text-purple-400 border-purple-500/30',
  COMPLETED:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  CANCELLED:  'bg-red-500/10 text-red-400 border-red-500/30',
};

const JOB_ICON: Record<string, string> = {
  CLEANING: '🧹', COOKING: '🍳', DRIVING: '🚗', MAINTENANCE: '🔨',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

type Tab = 'my' | 'available';

export default function WorkerJobsPage() {
  const router = useRouter();
  const user = useWorkerUser();
  const [tab, setTab] = useState<Tab>('my');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      if (tab === 'my') {
        const data = await api.jobs.list();
        setJobs(data.filter(j => ['DISPATCHED','ACCEPTED','IN_PROGRESS'].includes(j.status)));
      } else {
        const data = await api.jobs.list({ status: 'DISPATCHED' });
        setJobs(data.filter(j => !j.workerId));
      }
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [tab]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  return (
    <WorkerShell>
      {/* Header */}
      <div className="px-5 pt-12 pb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-white">Jobs</h1>
        {user && <span className="text-slate-400 text-sm">Hey, {user.name.split(' ')[0]} 👋</span>}
      </div>

      {/* Tabs */}
      <div className="px-5 mb-4">
        <div className="flex bg-slate-800 rounded-xl p-1 gap-1">
          {(['my', 'available'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                tab === t ? 'bg-blue-600 text-white' : 'text-slate-400'
              }`}
            >
              {t === 'my' ? 'My Jobs' : 'Available'}
            </button>
          ))}
        </div>
      </div>

      {/* Refresh button */}
      <div className="px-5 mb-3 flex justify-end">
        <button
          onClick={() => { setRefreshing(true); load(); }}
          disabled={refreshing}
          className="text-xs text-blue-400 font-semibold disabled:opacity-40"
        >
          {refreshing ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      {/* List */}
      <div className="px-5 space-y-3">
        {loading ? (
          <div className="flex justify-center pt-16">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center pt-16 space-y-2">
            <div className="text-5xl">{tab === 'my' ? '✅' : '🎉'}</div>
            <p className="text-white font-semibold text-lg">
              {tab === 'my' ? 'No active jobs' : 'No available jobs'}
            </p>
            <p className="text-slate-500 text-sm">Tap Refresh to check for updates</p>
          </div>
        ) : (
          jobs.map(job => (
            <button
              key={job.id}
              onClick={() => router.push(`/worker/job/${job.id}`)}
              className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-left active:opacity-70 transition-opacity"
            >
              <div className="flex items-start gap-3">
                <span className="text-3xl">{JOB_ICON[job.type] ?? '🔧'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-white font-bold">{job.type}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${STATUS_COLOR[job.status] ?? ''}`}>
                      {job.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm truncate">{job.property?.name}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{job.property?.city}</p>
                  <p className="text-slate-500 text-xs mt-2">📅 {formatDate(job.scheduledAt)}</p>
                  {job.booking && (
                    <p className="text-slate-500 text-xs">👤 {job.booking.guestName}</p>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </WorkerShell>
  );
}
