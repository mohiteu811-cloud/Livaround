'use client';

// Worker check-in page — reached by scanning the property entry QR code.
// Shows active/upcoming jobs for this property and allows accepting/starting.

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import WorkerShell from '../../WorkerShell';
import { api, Job } from '@/lib/api';

const STATUS_COLOR: Record<string, string> = {
  DISPATCHED:  'text-amber-400',
  ACCEPTED:    'text-blue-400',
  IN_PROGRESS: 'text-purple-400',
  COMPLETED:   'text-emerald-400',
};

const JOB_ICON: Record<string, string> = {
  CLEANING: '🧹', COOKING: '🍳', DRIVING: '🚗', MAINTENANCE: '🔨',
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default function WorkerCheckinPage() {
  const router = useRouter();
  const { propertyId } = useParams<{ propertyId: string }>();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [propertyName, setPropertyName] = useState('');

  useEffect(() => {
    // Load all jobs for the worker and filter by this property
    api.jobs.list({ propertyId })
      .then((all) => {
        // Show active/upcoming jobs (not completed/cancelled)
        const active = all.filter((j) => !['COMPLETED', 'CANCELLED'].includes(j.status));
        setJobs(active);
        if (all[0]?.property?.name) setPropertyName(all[0].property.name);
      })
      .catch(() => router.replace('/worker/login'))
      .finally(() => setLoading(false));
  }, [propertyId, router]);

  async function doAction(jobId: string, action: 'accept' | 'start') {
    setActionLoading(jobId);
    try {
      const updated = await api.jobs[action](jobId);
      setJobs((prev) => prev.map((j) => j.id === jobId ? updated : j));
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <WorkerShell>
        <div className="flex justify-center pt-32">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </WorkerShell>
    );
  }

  return (
    <WorkerShell>
      <div className="px-5 pt-12 pb-2">
        <button onClick={() => router.push('/worker/jobs')} className="text-blue-400 font-semibold text-sm">← My Jobs</button>
      </div>

      <div className="px-5 pt-4 pb-10 space-y-5">
        {/* Check-in banner */}
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-3xl">📍</span>
          <div>
            <p className="text-emerald-400 font-bold text-base">You've arrived!</p>
            <p className="text-emerald-300/70 text-sm">{propertyName || 'Property check-in'}</p>
          </div>
        </div>

        {/* Active jobs */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-3">Your jobs here</p>

          {jobs.length === 0 && (
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 text-center">
              <p className="text-slate-400">No active jobs assigned to you at this property.</p>
              <p className="text-slate-600 text-sm mt-1">Check with your host if you're expecting an assignment.</p>
            </div>
          )}

          <div className="space-y-3">
            {jobs.map((job) => (
              <div key={job.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{JOB_ICON[job.type] ?? '🔧'}</span>
                    <div>
                      <p className="text-white font-semibold">{job.type}</p>
                      <p className="text-xs text-slate-500">{fmt(job.scheduledAt)}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold ${STATUS_COLOR[job.status] ?? 'text-slate-400'}`}>
                    {job.status.replace('_', ' ')}
                  </span>
                </div>

                {job.notes && (
                  <p className="text-sm text-slate-400 bg-slate-700/50 rounded-xl px-3 py-2">{job.notes}</p>
                )}

                <div className="flex gap-2">
                  {job.status === 'DISPATCHED' && (
                    <button
                      onClick={() => doAction(job.id, 'accept')}
                      disabled={actionLoading === job.id}
                      className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm disabled:opacity-60 transition-colors"
                    >
                      {actionLoading === job.id ? '…' : '✓ Accept Job'}
                    </button>
                  )}
                  {job.status === 'ACCEPTED' && (
                    <button
                      onClick={() => doAction(job.id, 'start')}
                      disabled={actionLoading === job.id}
                      className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm disabled:opacity-60 transition-colors"
                    >
                      {actionLoading === job.id ? '…' : '▶ Start Job'}
                    </button>
                  )}
                  <button
                    onClick={() => router.push(`/worker/job/${job.id}`)}
                    className="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold text-sm transition-colors"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Property Guide link */}
        <button
          onClick={() => router.push(`/worker/property/${propertyId}/guide`)}
          className="w-full py-4 rounded-2xl border border-blue-500/30 text-blue-300 font-semibold text-base flex items-center justify-center gap-2"
        >
          📖 View Property Guide
        </button>
      </div>
    </WorkerShell>
  );
}
