'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import WorkerShell, { useLang } from '../WorkerShell';
import { t } from '../i18n';
import { api, User, Job } from '@/lib/api';

const SKILL_ICON: Record<string, string> = {
  CLEANING: '🧹', COOKING: '🍳', DRIVING: '🚗', MAINTENANCE: '🔨',
};

export default function WorkerProfilePage() {
  const router = useRouter();
  const [lang] = useLang();
  const tr = t(lang);
  const [user, setUser] = useState<User | null>(null);
  const [available, setAvailable] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<Job[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    api.auth.me()
      .then(u => { setUser(u); setAvailable(u.worker?.isAvailable ?? false); })
      .catch(() => router.replace('/worker/login'))
      .finally(() => setLoading(false));
    api.jobs.list()
      .then(data => setHistory(data.filter(j => ['COMPLETED', 'CANCELLED'].includes(j.status))))
      .finally(() => setHistoryLoading(false));
  }, [router]);

  async function toggleAvailability() {
    if (!user?.worker?.id) return;
    setToggling(true);
    try {
      await api.workers.updateAvailability(user.worker.id, !available);
      setAvailable(a => !a);
    } catch { /* ignore */ }
    finally { setToggling(false); }
  }

  function handleLogout() {
    if (!confirm(tr.signOutConfirm)) return;
    localStorage.removeItem('livaround_token');
    router.push('/worker/login');
  }

  if (loading) return (
    <WorkerShell>
      <div className="flex justify-center pt-32">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </WorkerShell>
  );

  if (!user) return null;

  const skills: string[] = (user.worker as any)?.skills ?? [];
  const jobsDone: number = (user.worker as any)?.jobsCompleted ?? 0;
  const rating: number | undefined = user.worker?.rating;

  return (
    <WorkerShell>
      <div className="px-5 pt-12 pb-8 space-y-5">
        <h1 className="text-2xl font-bold text-slate-100">{tr.profile}</h1>

        {/* Avatar */}
        <div className="flex flex-col items-center py-6 gap-2">
          <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-white text-3xl font-bold">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <h2 className="text-xl font-bold text-slate-100">{user.name}</h2>
          <p className="text-slate-400 text-sm">{user.email}</p>
          {user.phone && <p className="text-slate-400 text-sm">📱 {user.phone}</p>}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-slate-100">{jobsDone}</p>
            <p className="text-slate-400 text-xs mt-1 font-semibold uppercase tracking-wide">{tr.jobsDone}</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-slate-100">{rating ? rating.toFixed(1) : '—'}</p>
            <p className="text-slate-400 text-xs mt-1 font-semibold uppercase tracking-wide">{tr.rating}</p>
          </div>
        </div>

        {/* Availability toggle */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-slate-100 font-semibold">
              {available ? tr.available2 : tr.notAvailable}
            </p>
            <p className="text-slate-500 text-xs mt-0.5">
              {available ? tr.availableDesc : tr.notAvailableDesc}
            </p>
          </div>
          <button
            onClick={toggleAvailability}
            disabled={toggling}
            className={`relative w-12 h-7 rounded-full transition-colors disabled:opacity-50 ${
              available ? 'bg-blue-600' : 'bg-slate-600'
            }`}
          >
            <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${
              available ? 'left-6' : 'left-1'
            }`} />
          </button>
        </div>

        {/* Skills */}
        {skills.length > 0 && (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wider">{tr.skills}</h3>
            <div className="flex flex-wrap gap-2">
              {skills.map((skill: string) => (
                <span key={skill} className="flex items-center gap-1.5 bg-slate-700 rounded-xl px-3 py-2 text-sm text-slate-300 font-medium">
                  <span>{SKILL_ICON[skill] ?? '🔧'}</span>
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Job History */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wider">📋 {tr.history}</h3>
          </div>
          {historyLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">{tr.noHistory}</p>
          ) : (
            <div className="divide-y divide-slate-700">
              {history.map(job => (
                <div key={job.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xl flex-shrink-0">
                      {job.type === 'CLEANING' ? '🧹' : job.type === 'COOKING' ? '🍳' : job.type === 'DRIVING' ? '🚗' : '🔨'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-slate-200 text-sm font-semibold truncate">{job.property?.name ?? '—'}</p>
                      <p className="text-slate-500 text-xs">{job.type} · {new Date(job.scheduledAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                  </div>
                  <span className={`flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-md border ${
                    job.status === 'COMPLETED'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-red-500/10 text-red-400 border-red-500/30'
                  }`}>
                    {job.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleLogout}
          className="w-full py-4 border border-red-500/40 text-red-400 font-semibold rounded-2xl text-base"
        >
          {tr.signOut}
        </button>
      </div>
    </WorkerShell>
  );
}
