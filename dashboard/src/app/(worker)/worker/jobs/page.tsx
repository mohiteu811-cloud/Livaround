'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import WorkerShell, { useWorkerUser, useLang } from '../WorkerShell';
import { t } from '../i18n';
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

const PROPERTY_ICON: Record<string, string> = {
  VILLA: '🏖️', APARTMENT: '🏢', HOUSE: '🏠', HOTEL: '🏨',
};

const JOB_TYPES = [
  { type: 'CLEANING', icon: '🧹' },
  { type: 'COOKING',  icon: '🍳' },
  { type: 'DRIVING',  icon: '🚗' },
  { type: 'MAINTENANCE', icon: '🔨' },
] as const;

type JobType = 'CLEANING' | 'COOKING' | 'DRIVING' | 'MAINTENANCE';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

type Tab = 'properties' | 'my' | 'available' | 'history';

interface AssignedProperty {
  id: string; name: string; city: string; address?: string; type?: string; staffRole: string;
}

export default function WorkerJobsPage() {
  const router = useRouter();
  const user = useWorkerUser();
  const [lang] = useLang();
  const tr = t(lang);
  const [tab, setTab] = useState<Tab>('properties');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  // Properties tab state
  const [properties, setProperties] = useState<AssignedProperty[]>([]);
  const [propsLoading, setPropsLoading] = useState(true);

  // Start-job modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProp, setSelectedProp] = useState<AssignedProperty | null>(null);
  const [jobType, setJobType] = useState<JobType>('CLEANING');
  const [notes, setNotes] = useState('');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');

  const loadProperties = useCallback(async () => {
    try {
      const data = await api.workers.myProperties();
      setProperties(data);
    } catch { /* ignore */ }
    finally { setPropsLoading(false); }
  }, []);

  const loadJobs = useCallback(async () => {
    try {
      if (tab === 'my') {
        const data = await api.jobs.list();
        setJobs(data.filter(j => ['DISPATCHED','ACCEPTED','IN_PROGRESS'].includes(j.status)));
      } else if (tab === 'history') {
        const data = await api.jobs.list();
        setJobs(data.filter(j => ['COMPLETED','CANCELLED'].includes(j.status)));
      } else if (tab === 'available') {
        const data = await api.jobs.available();
        setJobs(data);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { loadProperties(); }, [loadProperties]);
  useEffect(() => {
    if (tab !== 'properties') { setLoading(true); loadJobs(); }
  }, [tab, loadJobs]);

  function openModal(property: AssignedProperty) {
    setSelectedProp(property);
    setJobType('CLEANING');
    setNotes('');
    setStartError('');
    setModalOpen(true);
  }

  async function handleStartJob() {
    if (!selectedProp) return;
    setStarting(true);
    setStartError('');
    try {
      const job = await api.jobs.selfStart({ propertyId: selectedProp.id, type: jobType, notes: notes.trim() || undefined });
      setModalOpen(false);
      router.push(`/worker/job/${job.id}`);
    } catch (err) {
      setStartError(err instanceof Error ? err.message : 'Failed to start job');
    } finally {
      setStarting(false);
    }
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'properties', label: tr.myProperties },
    { key: 'my',         label: tr.myJobs },
    { key: 'available',  label: tr.available },
    { key: 'history',    label: tr.history },
  ];

  return (
    <WorkerShell>
      {/* Header */}
      <div className="px-5 pt-12 pb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-slate-100">{tr.jobs}</h1>
        {user && <span className="text-slate-400 text-sm">{tr.hey}, {user.name.split(' ')[0]} 👋</span>}
      </div>

      {/* Tabs */}
      <div className="px-5 mb-4">
        <div className="flex bg-slate-800 rounded-xl p-1 gap-1">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                tab === key ? 'bg-blue-600 text-white' : 'text-slate-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Properties tab */}
      {tab === 'properties' && (
        <div className="px-5 space-y-3">
          {propsLoading ? (
            <div className="flex justify-center pt-16">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center pt-16 space-y-2">
              <div className="text-5xl">🏠</div>
              <p className="text-slate-100 font-semibold text-lg">{tr.noPropertiesAssigned}</p>
            </div>
          ) : (
            properties.map(prop => (
              <div key={prop.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
                <div className="flex items-start gap-3 mb-4">
                  <span className="text-3xl">{PROPERTY_ICON[prop.type ?? ''] ?? '🏠'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-100 font-bold">{prop.name}</p>
                    <p className="text-slate-400 text-sm">{prop.city}</p>
                    {prop.address && <p className="text-slate-500 text-xs mt-0.5 truncate">{prop.address}</p>}
                    <span className="inline-block mt-1.5 text-xs font-bold px-2 py-0.5 rounded bg-blue-900/50 text-blue-300 border border-blue-700/50">
                      {prop.staffRole}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => openModal(prop)}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  ▶ {tr.startNewJob}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Jobs tabs (my / available / history) */}
      {tab !== 'properties' && (
        <>
          <div className="px-5 mb-3 flex justify-end">
            <button
              onClick={() => { setLoading(true); loadJobs(); }}
              disabled={loading}
              className="text-xs text-blue-400 font-semibold disabled:opacity-40"
            >
              {loading ? tr.refreshing : tr.refresh}
            </button>
          </div>

          <div className="px-5 space-y-3">
            {loading ? (
              <div className="flex justify-center pt-16">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center pt-16 space-y-2">
                <div className="text-5xl">{tab === 'my' ? '✅' : tab === 'history' ? '📋' : '🎉'}</div>
                <p className="text-slate-100 font-semibold text-lg">
                  {tab === 'my' ? tr.noActiveJobs : tab === 'history' ? tr.noHistory : tr.noAvailableJobs}
                </p>
                {tab !== 'history' && <p className="text-slate-500 text-sm">{tr.tapRefresh}</p>}
              </div>
            ) : (
              jobs.map(job => (
                <div key={job.id} className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-left">
                  <button
                    onClick={() => router.push(`/worker/job/${job.id}`)}
                    className="w-full text-left active:opacity-70 transition-opacity"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-3xl">{JOB_ICON[job.type] ?? '🔧'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-slate-100 font-bold">{job.type}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${STATUS_COLOR[job.status] ?? ''}`}>
                            {job.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-slate-400 text-sm truncate">{job.property?.name}</p>
                        <p className="text-slate-500 text-xs mt-0.5">{job.property?.city}</p>
                        <p className="text-slate-500 text-xs mt-2">📅 {formatDate(job.scheduledAt)}</p>
                        {job.booking && <p className="text-slate-500 text-xs">👤 {job.booking.guestName}</p>}
                      </div>
                    </div>
                  </button>
                  {tab === 'available' && (
                    <button
                      onClick={async () => { await api.jobs.claim(job.id); loadJobs(); }}
                      className="mt-3 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
                    >
                      Claim Job
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Start Job modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-slate-800 rounded-t-3xl p-6 pb-8 space-y-5">
            <div className="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-2" />
            <div>
              <h2 className="text-xl font-bold text-slate-100">{tr.startNewJob}</h2>
              {selectedProp && (
                <p className="text-slate-400 text-sm mt-0.5">{selectedProp.name} · {selectedProp.city}</p>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-400 mb-2">{tr.jobTypeLabel}</p>
              <div className="grid grid-cols-4 gap-2">
                {JOB_TYPES.map(({ type, icon }) => (
                  <button
                    key={type}
                    onClick={() => setJobType(type)}
                    className={`flex flex-col items-center gap-1 py-3 rounded-xl border transition-colors ${
                      jobType === type
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-400'
                    }`}
                  >
                    <span className="text-2xl">{icon}</span>
                    <span className="text-xs font-semibold">{type.charAt(0) + type.slice(1).toLowerCase()}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-400 mb-2">
                {tr.notes} <span className="font-normal">({tr.optional})</span>
              </p>
              <textarea
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                rows={3}
                placeholder={tr.notesPlaceholder}
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            {startError && (
              <p className="text-red-400 text-sm">{startError}</p>
            )}

            <button
              onClick={handleStartJob}
              disabled={starting}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-2xl transition-colors"
            >
              {starting ? tr.starting : `▶ ${tr.startJobNow}`}
            </button>
            <button
              onClick={() => setModalOpen(false)}
              className="w-full py-2 text-slate-500 text-sm font-semibold"
            >
              {tr.back}
            </button>
          </div>
        </div>
      )}
    </WorkerShell>
  );
}
