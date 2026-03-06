'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import WorkerShell from '../WorkerShell';
import { api, User } from '@/lib/api';

const SKILL_ICON: Record<string, string> = {
  CLEANING: '🧹', COOKING: '🍳', DRIVING: '🚗', MAINTENANCE: '🔨',
};

export default function WorkerProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [available, setAvailable] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.auth.me()
      .then(u => { setUser(u); setAvailable(u.worker?.isAvailable ?? false); })
      .catch(() => router.replace('/worker/login'))
      .finally(() => setLoading(false));
  }, [router]);

  async function toggleAvailability() {
    if (!user?.worker?.id) return;
    setToggling(true);
    try {
      const next = !available;
      await api.workers.updateAvailability(user.worker.id, next);
      setAvailable(next);
    } catch { /* ignore */ }
    finally { setToggling(false); }
  }

  function handleLogout() {
    if (!confirm('Sign out?')) return;
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
        <h1 className="text-2xl font-bold text-white">Profile</h1>

        {/* Avatar */}
        <div className="flex flex-col items-center py-6 gap-2">
          <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-white text-3xl font-bold">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <h2 className="text-xl font-bold text-white">{user.name}</h2>
          <p className="text-slate-400 text-sm">{user.email}</p>
          {user.phone && <p className="text-slate-400 text-sm">📱 {user.phone}</p>}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{jobsDone}</p>
            <p className="text-slate-400 text-xs mt-1 font-semibold uppercase tracking-wide">Jobs Done</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{rating ? rating.toFixed(1) : '—'}</p>
            <p className="text-slate-400 text-xs mt-1 font-semibold uppercase tracking-wide">Rating ⭐</p>
          </div>
        </div>

        {/* Availability toggle */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-white font-semibold">
              {available ? '🟢 Available' : '🔴 Not available'}
            </p>
            <p className="text-slate-500 text-xs mt-0.5">
              {available ? 'You can receive new job assignments' : 'You won\'t receive new assignments'}
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
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Skills</h3>
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

        {/* Sign out */}
        <button
          onClick={handleLogout}
          className="w-full py-4 border border-red-500/40 text-red-400 font-semibold rounded-2xl text-base"
        >
          Sign Out
        </button>
      </div>
    </WorkerShell>
  );
}
