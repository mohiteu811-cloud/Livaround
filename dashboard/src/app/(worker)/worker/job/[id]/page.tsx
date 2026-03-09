'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import WorkerShell, { useLang } from '../../WorkerShell';
import { t } from '../../i18n';
import { api, Job } from '@/lib/api';

const STATUS_COLOR: Record<string, string> = {
  DISPATCHED: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  ACCEPTED:   'bg-blue-500/10 text-blue-400 border-blue-500/30',
  IN_PROGRESS:'bg-purple-500/10 text-purple-400 border-purple-500/30',
  COMPLETED:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
};

const JOB_ICON: Record<string, string> = {
  CLEANING: '🧹', COOKING: '🍳', DRIVING: '🚗', MAINTENANCE: '🔨',
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  });
}

export default function WorkerJobDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [lang] = useLang();
  const tr = t(lang);
  const [job, setJob] = useState<Job | null>(null);
  const [checklist, setChecklist] = useState<{ item: string; done: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.jobs.get(id)
      .then((j: Job) => {
        setJob(j);
        setChecklist((j.checklist as { item: string; done: boolean }[]) ?? []);
      })
      .catch(() => router.back())
      .finally(() => setLoading(false));
  }, [id, router]);

  function toggleCheck(i: number) {
    setChecklist(prev => prev.map((c, idx) => idx === i ? { ...c, done: !c.done } : c));
  }

  async function doAction(action: 'accept' | 'start' | 'complete') {
    if (action === 'complete') {
      const undone = checklist.filter(c => !c.done).length;
      if (undone > 0 && !confirm(tr.incompleteItems(undone))) return;
    }
    setActionLoading(true);
    setError('');
    try {
      const updated = await api.jobs[action](id);
      setJob(updated);
      if (action === 'complete') {
        alert('✅ ' + (lang === 'hi' ? 'काम पूरा हुआ! शाबाश।' : 'Job marked complete! Great work.'));
        router.push('/worker/jobs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return (
    <WorkerShell>
      <div className="flex justify-center pt-32">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </WorkerShell>
  );

  if (!job) return null;

  const done = checklist.filter(c => c.done).length;
  const pct = checklist.length ? Math.round((done / checklist.length) * 100) : 0;

  return (
    <WorkerShell>
      <div className="px-5 pt-12 pb-2 flex items-center justify-between">
        <button onClick={() => router.back()} className="text-blue-400 font-semibold text-sm">{tr.back}</button>
        <span className={`text-xs font-bold px-3 py-1 rounded-lg border ${STATUS_COLOR[job.status] ?? 'text-slate-400 border-slate-700'}`}>
          {job.status.replace('_', ' ')}
        </span>
      </div>

      <div className="px-5 pt-4 pb-8 space-y-5">
        {/* Title */}
        <div className="flex items-center gap-4">
          <span className="text-5xl">{JOB_ICON[job.type] ?? '🔧'}</span>
          <div>
            <h1 className="text-2xl font-bold text-white">{job.type}</h1>
            <p className="text-slate-400">{job.property?.name}</p>
            <p className="text-slate-500 text-sm">{job.property?.city}</p>
          </div>
        </div>

        {/* Details */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">{tr.details}</h2>
          <InfoRow icon="📅" label={tr.scheduled} value={fmt(job.scheduledAt)} />
          {job.booking && <>
            <InfoRow icon="👤" label={tr.guest} value={job.booking.guestName} />
            <InfoRow icon="🛬" label={tr.checkIn} value={fmt(job.booking.checkIn)} />
            <InfoRow icon="🛫" label={tr.checkOut} value={fmt(job.booking.checkOut)} />
          </>}
          {job.notes && <InfoRow icon="📝" label={tr.notes} value={job.notes} />}
        </div>

        {/* Checklist */}
        {checklist.length > 0 && (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">{tr.checklist}</h2>
              <span className="text-blue-400 text-sm font-semibold">{done}/{checklist.length}</span>
            </div>
            <div className="h-1.5 bg-slate-700 rounded-full">
              <div className="h-1.5 bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="space-y-2 pt-1">
              {checklist.map((item: { item: string; done: boolean }, i: number) => (
                <button
                  key={i}
                  onClick={() => job.status !== 'COMPLETED' && toggleCheck(i)}
                  className="w-full flex items-center gap-3 py-2 text-left"
                >
                  <span className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    item.done ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'
                  }`}>
                    {item.done && <span className="text-white text-xs font-bold">✓</span>}
                  </span>
                  <span className={`text-sm ${item.done ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                    {item.item}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Property Guide button */}
        {job.propertyId && (
          <button
            onClick={() => router.push(`/worker/property/${job.propertyId}/guide?jobId=${id}`)}
            className="w-full py-4 rounded-2xl border border-blue-500/30 text-blue-300 font-semibold text-base flex items-center justify-center gap-2"
          >
            📖 {lang === 'hi' ? 'प्रॉपर्टी गाइड देखें' : 'View Property Guide'}
          </button>
        )}

        {/* Action buttons */}
        {job.status !== 'COMPLETED' && job.status !== 'CANCELLED' && (
          <div className="space-y-3">
            {job.status === 'DISPATCHED' && (
              <ActionBtn label={tr.acceptJob} color="bg-blue-600 hover:bg-blue-500" loading={actionLoading} onClick={() => doAction('accept')} />
            )}
            {job.status === 'ACCEPTED' && (
              <ActionBtn label={tr.startJob} color="bg-purple-600 hover:bg-purple-500" loading={actionLoading} onClick={() => doAction('start')} />
            )}
            {job.status === 'IN_PROGRESS' && (
              <ActionBtn label={tr.markComplete} color="bg-emerald-600 hover:bg-emerald-500" loading={actionLoading} onClick={() => doAction('complete')} />
            )}
            {(job.status === 'ACCEPTED' || job.status === 'IN_PROGRESS') && (
              <button
                onClick={() => router.push(`/worker/job/${id}/issue`)}
                className="w-full py-4 rounded-2xl border border-red-500/40 text-red-400 font-semibold text-base"
              >
                {tr.reportIssue}
              </button>
            )}
          </div>
        )}
      </div>
    </WorkerShell>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-lg">{icon}</span>
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">{label}</p>
        <p className="text-slate-200 text-sm mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function ActionBtn({ label, color, loading, onClick }: { label: string; color: string; loading: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`w-full py-4 rounded-2xl text-white font-bold text-base transition-colors disabled:opacity-60 ${color}`}
    >
      {loading ? '…' : label}
    </button>
  );
}
