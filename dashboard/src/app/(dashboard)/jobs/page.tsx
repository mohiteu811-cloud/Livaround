'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Plus, Send, CheckCircle, XCircle, AlertTriangle, Camera } from 'lucide-react';
import { api, Job, Property, Worker, Booking } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea, FormField } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { statusBadge } from '@/components/ui/Badge';

const JOB_TYPE_ICONS: Record<string, string> = {
  CLEANING: '🧹',
  COOKING: '🍳',
  DRIVING: '🚗',
  MAINTENANCE: '🔧',
};

const DEFAULT_CHECKLISTS: Record<string, string[]> = {
  CLEANING: ['Vacuum all rooms', 'Change bed linens', 'Clean bathrooms', 'Restock toiletries', 'Clean kitchen', 'Empty bins'],
  COOKING: ['Confirm meal preference with guest', 'Grocery prep', 'Cook and plate', 'Clean up kitchen'],
  DRIVING: ['Confirm pickup location and time', 'Vehicle fueled', 'Arrival confirmation to guest'],
  MAINTENANCE: ['Identify issue', 'Document with photos', 'Carry out repair', 'Test and sign off'],
};

function JobForm({
  properties,
  workers,
  bookings,
  onSave,
  onClose,
}: {
  properties: Property[];
  workers: Worker[];
  bookings: Booking[];
  onSave: (d: Partial<Job>) => Promise<void>;
  onClose: () => void;
}) {
  const scheduledDefault = new Date();
  scheduledDefault.setDate(scheduledDefault.getDate() + 1);
  scheduledDefault.setHours(10, 0, 0, 0);

  const [form, setForm] = useState({
    propertyId: properties[0]?.id || '',
    bookingId: '',
    type: 'CLEANING' as Job['type'],
    scheduledAt: scheduledDefault.toISOString().slice(0, 16),
    notes: '',
    checklist: DEFAULT_CHECKLISTS['CLEANING'].map((item) => ({ item, done: false })),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dispatchWorkers, setDispatchWorkers] = useState<{ workerId: string; role: string; worker: { user: { name: string } } }[]>([]);
  const [dispatchWorkerId, setDispatchWorkerId] = useState('');

  function set(k: string, v: unknown) { setForm((f) => ({ ...f, [k]: v })); }

  function handleTypeChange(t: Job['type']) {
    setForm((f) => ({
      ...f,
      type: t,
      checklist: (DEFAULT_CHECKLISTS[t] || []).map((item) => ({ item, done: false })),
    }));
  }

  useEffect(() => {
    if (!form.propertyId) return;
    api.jobs.dispatchWorkers(form.propertyId).then((ws) => {
      setDispatchWorkers(ws);
      setDispatchWorkerId(ws.length === 1 ? ws[0].workerId : '');
    }).catch(() => setDispatchWorkers([]));
  }, [form.propertyId]);

  const propertyBookings = bookings.filter((b) => b.propertyId === form.propertyId && ['CONFIRMED', 'CHECKED_IN'].includes(b.status));

  async function handleCreate(withDispatch: boolean) {
    setLoading(true);
    setError('');
    try {
      await onSave({
        ...form,
        bookingId: form.bookingId || undefined,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        ...(withDispatch && dispatchWorkerId ? { workerId: dispatchWorkerId } : {}),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create job');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await handleCreate(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Property">
          <Select value={form.propertyId} onChange={(e) => set('propertyId', e.target.value)} required>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </FormField>
        <FormField label="Job type">
          <Select value={form.type} onChange={(e) => handleTypeChange(e.target.value as Job['type'])}>
            {Object.entries(JOB_TYPE_ICONS).map(([t, icon]) => (
              <option key={t} value={t}>{icon} {t.charAt(0) + t.slice(1).toLowerCase()}</option>
            ))}
          </Select>
        </FormField>
      </div>
      {propertyBookings.length > 0 && (
        <FormField label="Link to booking (optional)">
          <Select value={form.bookingId} onChange={(e) => set('bookingId', e.target.value)}>
            <option value="">— Not linked —</option>
            {propertyBookings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.guestName} · {format(new Date(b.checkIn), 'dd MMM')} – {format(new Date(b.checkOut), 'dd MMM')}
              </option>
            ))}
          </Select>
        </FormField>
      )}
      <FormField label="Scheduled at">
        <Input type="datetime-local" value={form.scheduledAt} onChange={(e) => set('scheduledAt', e.target.value)} required />
      </FormField>
      <FormField label="Notes">
        <Textarea rows={2} placeholder="Any instructions for the worker..." value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      </FormField>
      <div>
        <p className="text-sm font-medium text-slate-300 mb-2">Checklist</p>
        <div className="space-y-1.5">
          {form.checklist.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-slate-500 text-xs w-4">{i + 1}.</span>
              <input
                className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-300 focus:outline-none focus:border-brand-500"
                value={item.item}
                onChange={(e) => {
                  const next = [...form.checklist];
                  next[i] = { ...next[i], item: e.target.value };
                  set('checklist', next);
                }}
              />
              <button type="button" onClick={() => set('checklist', form.checklist.filter((_, j) => j !== i))}
                className="text-slate-600 hover:text-red-400 text-xs">✕</button>
            </div>
          ))}
          <button type="button" onClick={() => set('checklist', [...form.checklist, { item: '', done: false }])}
            className="text-xs text-brand-400 hover:text-brand-300">+ Add item</button>
        </div>
      </div>
      {dispatchWorkers.length === 1 && (
        <p className="text-xs text-slate-500">
          Dispatching will assign to <strong className="text-slate-300">{dispatchWorkers[0].worker.user.name}</strong> automatically.
        </p>
      )}
      {dispatchWorkers.length > 1 && (
        <FormField label="Dispatch to">
          <Select value={dispatchWorkerId} onChange={(e) => setDispatchWorkerId(e.target.value)}>
            <option value="">— Select worker —</option>
            {dispatchWorkers.map((s) => (
              <option key={s.workerId} value={s.workerId}>
                {s.worker.user.name} ({s.role.charAt(0) + s.role.slice(1).toLowerCase()})
              </option>
            ))}
          </Select>
        </FormField>
      )}
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onClose} className="flex-1 justify-center">Cancel</Button>
        <Button type="submit" variant="secondary" loading={loading} className="flex-1 justify-center">Create job</Button>
        {dispatchWorkers.length > 0 && (
          <Button type="button" loading={loading} disabled={!dispatchWorkerId} onClick={() => handleCreate(true)} className="flex-1 justify-center">
            <Send size={14} /> Create & dispatch
          </Button>
        )}
      </div>
    </form>
  );
}

function DispatchModal({ job, workers, onDispatch, onClose }: {
  job: Job;
  workers: Worker[];
  onDispatch: (workerId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [workerId, setWorkerId] = useState('');
  const [loading, setLoading] = useState(false);

  const eligible = workers.filter((w) => w.skills.includes(job.type) && w.isAvailable);

  async function handleDispatch() {
    if (!workerId) return;
    setLoading(true);
    try { await onDispatch(workerId); onClose(); } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Dispatching: <strong className="text-slate-200">{JOB_TYPE_ICONS[job.type]} {job.type}</strong> at <strong className="text-slate-200">{job.property?.name}</strong>
      </p>
      {eligible.length === 0 ? (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3 text-amber-400 text-sm flex gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          No available workers with {job.type.toLowerCase()} skill. Mark a worker as available first.
        </div>
      ) : (
        <div className="space-y-2">
          {eligible.map((w) => (
            <label key={w.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${workerId === w.id ? 'border-brand-500 bg-brand-500/10' : 'border-slate-700 hover:border-slate-600'}`}>
              <input type="radio" name="worker" value={w.id} checked={workerId === w.id} onChange={() => setWorkerId(w.id)} className="sr-only" />
              <div className="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 text-sm font-semibold">
                {w.user.name.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-200">{w.user.name}</p>
                <p className="text-xs text-slate-500">{w.jobsCompleted} jobs · {w.rating ? `⭐ ${w.rating}` : 'No rating yet'}</p>
              </div>
            </label>
          ))}
        </div>
      )}
      <div className="flex gap-3 pt-2">
        <Button variant="secondary" onClick={onClose} className="flex-1 justify-center">Cancel</Button>
        <Button onClick={handleDispatch} loading={loading} disabled={!workerId} className="flex-1 justify-center">
          <Send size={14} /> Dispatch
        </Button>
      </div>
    </div>
  );
}

function CompletionMediaModal({ job, onClose }: { job: Job; onClose: () => void }) {
  return (
    <div className="space-y-5">
      {/* Job info */}
      <div className="bg-slate-800/60 rounded-lg p-4 text-sm space-y-1.5">
        <div className="flex items-center gap-2 text-slate-200 font-medium">
          <span>{JOB_TYPE_ICONS[job.type] ?? '📋'}</span>
          <span>{job.type.charAt(0) + job.type.slice(1).toLowerCase()} job</span>
        </div>
        {job.property && <p className="text-slate-400">📍 {job.property.name}</p>}
        {job.worker && <p className="text-slate-400">👷 {job.worker.user.name}</p>}
        {job.completedAt && (
          <p className="text-slate-500 text-xs">
            Completed {format(new Date(job.completedAt), 'dd MMM yyyy, HH:mm')}
          </p>
        )}
      </div>

      {/* Photo */}
      {job.completionPhotoUrl && (
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Photo</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={job.completionPhotoUrl}
            alt="Completion photo"
            className="w-full rounded-lg border border-slate-700 object-cover max-h-72"
          />
        </div>
      )}

      {/* Video */}
      {job.completionVideoUrl && (
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Video</p>
          <video
            src={job.completionVideoUrl}
            controls
            playsInline
            className="w-full rounded-lg border border-slate-700 max-h-72 bg-black"
          />
        </div>
      )}

      {!job.completionPhotoUrl && !job.completionVideoUrl && (
        <p className="text-sm text-slate-500 text-center py-4">No completion media attached.</p>
      )}

      <div className="flex gap-3 pt-1">
        <Button variant="secondary" onClick={onClose} className="flex-1 justify-center">Close</Button>
      </div>
    </div>
  );
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(false);
  const [dispatchModal, setDispatchModal] = useState<Job | null>(null);
  const [completionModal, setCompletionModal] = useState<Job | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [j, p, w, b] = await Promise.all([
        api.jobs.list(), api.properties.list(), api.workers.list(), api.bookings.list(),
      ]);
      setJobs(j); setProperties(p); setWorkers(w); setBookings(b);
    } finally { setLoading(false); }
  }

  async function handleComplete(id: string) {
    await api.jobs.complete(id); load();
  }
  async function handleCancel(id: string) {
    if (!confirm('Cancel this job?')) return;
    await api.jobs.cancel(id); load();
  }

  const filtered = jobs.filter((j) =>
    (!statusFilter || j.status === statusFilter) &&
    (!typeFilter || j.type === typeFilter)
  );

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Jobs</h1>
          <p className="text-slate-400 text-sm mt-1">{jobs.filter((j) => j.status === 'PENDING').length} pending dispatch</p>
        </div>
        <Button onClick={() => setCreateModal(true)}><Plus size={16} /> Create job</Button>
      </div>

      <div className="flex gap-3">
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-44">
          <option value="">All statuses</option>
          {['PENDING', 'DISPATCHED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </Select>
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-44">
          <option value="">All types</option>
          {['CLEANING', 'COOKING', 'DRIVING', 'MAINTENANCE'].map((t) => (
            <option key={t} value={t}>{JOB_TYPE_ICONS[t]} {t.charAt(0) + t.slice(1).toLowerCase()}</option>
          ))}
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
                <th className="text-left px-6 py-3">Job</th>
                <th className="text-left px-6 py-3">Property</th>
                <th className="text-left px-6 py-3">Scheduled</th>
                <th className="text-left px-6 py-3">Worker</th>
                <th className="text-left px-6 py-3">Status</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">No jobs found</td></tr>
              )}
              {filtered.map((j) => (
                <tr key={j.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{JOB_TYPE_ICONS[j.type]}</span>
                      <div>
                        <p className="font-medium text-slate-200">{j.type.charAt(0) + j.type.slice(1).toLowerCase()}</p>
                        {j.booking && (
                          <p className="text-xs text-slate-500">{j.booking.guestName}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-300">{j.property?.name}</td>
                  <td className="px-6 py-4 text-slate-400 text-xs">
                    {format(new Date(j.scheduledAt), 'dd MMM, HH:mm')}
                  </td>
                  <td className="px-6 py-4">
                    {j.worker ? (
                      <span className="text-slate-300 text-xs">{j.worker.user.name}</span>
                    ) : (
                      <span className="text-slate-600 text-xs italic">Unassigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4">{statusBadge(j.status)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 justify-end">
                      {['PENDING', 'DISPATCHED'].includes(j.status) && (
                        <button onClick={() => setDispatchModal(j)}
                          className="p-1.5 rounded hover:bg-slate-800 text-sky-400 hover:text-sky-300" title="Dispatch">
                          <Send size={14} />
                        </button>
                      )}
                      {['ACCEPTED', 'IN_PROGRESS', 'DISPATCHED'].includes(j.status) && (
                        <button onClick={() => handleComplete(j.id)}
                          className="p-1.5 rounded hover:bg-slate-800 text-emerald-400 hover:text-emerald-300" title="Mark complete">
                          <CheckCircle size={14} />
                        </button>
                      )}
                      {j.status === 'COMPLETED' && (j.completionPhotoUrl || j.completionVideoUrl) && (
                        <button onClick={() => setCompletionModal(j)}
                          className="p-1.5 rounded hover:bg-slate-800 text-blue-400 hover:text-blue-300" title="View completion media">
                          <Camera size={14} />
                        </button>
                      )}
                      {!['COMPLETED', 'CANCELLED'].includes(j.status) && (
                        <button onClick={() => handleCancel(j.id)}
                          className="p-1.5 rounded hover:bg-slate-800 text-red-400 hover:text-red-300" title="Cancel">
                          <XCircle size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Create job" size="lg">
        <JobForm
          properties={properties} workers={workers} bookings={bookings}
          onSave={async (d) => { await api.jobs.create(d); await load(); }}
          onClose={() => setCreateModal(false)}
        />
      </Modal>

      {dispatchModal && (
        <Modal open={!!dispatchModal} onClose={() => setDispatchModal(null)} title="Dispatch job">
          <DispatchModal
            job={dispatchModal} workers={workers}
            onDispatch={async (wId) => { await api.jobs.dispatch(dispatchModal.id, wId); await load(); }}
            onClose={() => setDispatchModal(null)}
          />
        </Modal>
      )}

      {completionModal && (
        <Modal open={!!completionModal} onClose={() => setCompletionModal(null)} title="Completion media">
          <CompletionMediaModal job={completionModal} onClose={() => setCompletionModal(null)} />
        </Modal>
      )}
    </div>
  );
}
