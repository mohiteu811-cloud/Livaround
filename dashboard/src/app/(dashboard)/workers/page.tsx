'use client';

import { useEffect, useState } from 'react';
import { Plus, Star, MapPin, Trash2, Building2, X, KeyRound } from 'lucide-react';
import { api, Worker, Property } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, FormField } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { skillBadge } from '@/components/ui/Badge';

const SKILLS = ['CLEANING', 'COOKING', 'DRIVING', 'MAINTENANCE'];

const TYPE_ICONS: Record<string, string> = {
  VILLA: '🏡', APARTMENT: '🏢', HOUSE: '🏠', CONDO: '🏙️',
};

function WorkerForm({ onSave, onClose }: { onSave: (d: unknown) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', skills: [] as string[], location: '', bio: '', isGigWorker: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ tempPassword: string } | null>(null);

  function set(k: string, v: unknown) { setForm((f) => ({ ...f, [k]: v })); }
  function toggleSkill(s: string) {
    setForm((f) => ({
      ...f,
      skills: f.skills.includes(s) ? f.skills.filter((x) => x !== s) : [...f.skills, s],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await onSave(form) as { tempPassword?: string } | undefined;
      if (result && 'tempPassword' in result) {
        setCreated({ tempPassword: (result as { tempPassword: string }).tempPassword });
      } else {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setLoading(false);
    }
  }

  if (created) {
    return (
      <div className="space-y-4 text-center">
        <div className="text-4xl">✅</div>
        <p className="text-slate-100 font-semibold">Worker account created!</p>
        <p className="text-slate-400 text-sm">Share these credentials with <strong>{form.name}</strong>:</p>
        <div className="bg-slate-800 rounded-lg p-4 text-left">
          <p className="text-xs text-slate-500 mb-1">Email</p>
          <p className="text-slate-200 font-mono text-sm">{form.email}</p>
          <p className="text-xs text-slate-500 mb-1 mt-3">Temporary password</p>
          <p className="text-slate-200 font-mono text-sm font-bold">{created.tempPassword}</p>
        </div>
        <p className="text-xs text-slate-500">They should change their password after first login.</p>
        <Button onClick={onClose} className="w-full justify-center">Done</Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Full name">
          <Input placeholder="Preeti Dessai" value={form.name} onChange={(e) => set('name', e.target.value)} required />
        </FormField>
        <FormField label="Email">
          <Input type="email" placeholder="preeti@example.com" value={form.email} onChange={(e) => set('email', e.target.value)} required />
        </FormField>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Phone">
          <Input placeholder="+91 94220 11234" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </FormField>
        <FormField label="Location">
          <Input placeholder="Calangute, Goa" value={form.location} onChange={(e) => set('location', e.target.value)} />
        </FormField>
      </div>
      <div>
        <p className="text-sm font-medium text-slate-300 mb-2">Skills (select at least one)</p>
        <div className="flex gap-2">
          {SKILLS.map((s) => (
            <button type="button" key={s} onClick={() => toggleSkill(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${form.skills.includes(s) ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={form.isGigWorker}
            onChange={(e) => set('isGigWorker', e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-brand-500 focus:ring-brand-500 focus:ring-offset-0"
          />
          <div>
            <p className="text-sm font-medium text-slate-300 group-hover:text-slate-200">Gig worker</p>
            <p className="text-xs text-slate-500">Visible to all hosts on the platform, not just you</p>
          </div>
        </label>
      </div>
      <FormField label="Bio (optional)">
        <Textarea rows={2} placeholder="Brief description of experience..." value={form.bio} onChange={(e) => set('bio', e.target.value)} />
      </FormField>
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onClose} className="flex-1 justify-center">Cancel</Button>
        <Button type="submit" loading={loading} className="flex-1 justify-center">Add worker</Button>
      </div>
    </form>
  );
}

function ManagePropertiesModal({
  worker,
  allProperties,
  onClose,
  onChanged,
}: {
  worker: Worker;
  allProperties: Property[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const assigned = new Map(
    (worker.propertyStaff ?? []).map((ps) => [ps.propertyId, ps.role])
  );
  const [saving, setSaving] = useState<string | null>(null);

  async function toggle(property: Property) {
    setSaving(property.id);
    try {
      if (assigned.has(property.id)) {
        await api.propertyStaff.remove(property.id, worker.id);
      } else {
        await api.propertyStaff.assign(property.id, { workerId: worker.id, role: 'CLEANER' });
      }
      onChanged();
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">
        Select which properties <span className="text-slate-200 font-medium">{worker.user.name}</span> is assigned to.
        They'll be scheduled as a Cleaner by default — change the role per-property from the Property → Staff page.
      </p>
      {allProperties.length === 0 ? (
        <p className="text-slate-500 text-sm italic text-center py-4">No properties found.</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {allProperties.map((p) => {
            const isAssigned = assigned.has(p.id);
            const role = assigned.get(p.id);
            const isSaving = saving === p.id;
            return (
              <button
                key={p.id}
                onClick={() => toggle(p)}
                disabled={isSaving}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border text-left transition-colors ${
                  isAssigned
                    ? 'border-brand-500/50 bg-brand-500/10'
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                }`}
              >
                <span className="text-xl">{TYPE_ICONS[p.type] || '🏠'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-100 truncate">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.city}</p>
                </div>
                {isAssigned ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-full">
                      {role === 'CARETAKER' ? 'Caretaker' : role === 'SUPERVISOR' ? 'Supervisor' : 'Cleaner'}
                    </span>
                    <X size={14} className="text-slate-500" />
                  </div>
                ) : (
                  <span className="text-xs text-slate-500 shrink-0">{isSaving ? 'Saving…' : 'Assign'}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
      <div className="pt-2">
        <Button variant="secondary" onClick={onClose} className="w-full justify-center">Done</Button>
      </div>
    </div>
  );
}

function ResetPasswordModal({ worker, onClose }: { worker: Worker; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ tempPassword: string } | null>(null);
  const [error, setError] = useState('');

  async function handleReset() {
    setLoading(true);
    setError('');
    try {
      const res = await api.workers.resetPassword(worker.id);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-4 text-center">
        <div className="text-4xl">🔑</div>
        <p className="text-slate-100 font-semibold">Password reset!</p>
        <p className="text-slate-400 text-sm">A new temporary password has been emailed to <strong>{worker.user.email}</strong>. You can also share it directly:</p>
        <div className="bg-slate-800 rounded-lg p-4 text-left">
          <p className="text-xs text-slate-500 mb-1">Email</p>
          <p className="text-slate-200 font-mono text-sm">{worker.user.email}</p>
          <p className="text-xs text-slate-500 mb-1 mt-3">New temporary password</p>
          <p className="text-slate-200 font-mono text-sm font-bold">{result.tempPassword}</p>
        </div>
        <Button onClick={onClose} className="w-full justify-center">Done</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>}
      <p className="text-slate-400 text-sm">
        This will generate a new temporary password for <strong className="text-slate-200">{worker.user.name}</strong> and send it to <strong className="text-slate-200">{worker.user.email}</strong>.
      </p>
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onClose} className="flex-1 justify-center">Cancel</Button>
        <Button loading={loading} onClick={handleReset} className="flex-1 justify-center">Reset password</Button>
      </div>
    </div>
  );
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [manageWorker, setManageWorker] = useState<Worker | null>(null);
  const [resetWorker, setResetWorker] = useState<Worker | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [ws, ps] = await Promise.all([api.workers.list(), api.properties.list()]);
      setWorkers(ws);
      setProperties(ps);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this worker from the platform?')) return;
    await api.workers.delete(id);
    load();
  }

  async function toggleAvailable(w: Worker) {
    await api.workers.update(w.id, { isAvailable: !w.isAvailable });
    load();
  }

  async function toggleGigWorker(w: Worker) {
    await api.workers.update(w.id, { isGigWorker: !w.isGigWorker });
    load();
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Workers</h1>
          <p className="text-slate-400 text-sm mt-1">{workers.length} workers on the platform</p>
        </div>
        <Button onClick={() => setAddModal(true)}><Plus size={16} /> Add worker</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : workers.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center py-16 gap-3">
          <span className="text-5xl">👷</span>
          <p className="text-slate-400">No workers yet</p>
          <Button onClick={() => setAddModal(true)}>Add your first worker</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {workers.map((w) => {
            const assignedProperties = w.propertyStaff ?? [];
            return (
              <div key={w.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-600/20 border border-brand-500/30 flex items-center justify-center text-brand-400 font-semibold text-sm">
                      {w.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-100">{w.user.name}</p>
                      <p className="text-xs text-slate-500">{w.user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleAvailable(w)}
                      className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${w.isAvailable ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                    >
                      {w.isAvailable ? 'Available' : 'Unavailable'}
                    </button>
                    <button
                      onClick={() => toggleGigWorker(w)}
                      title={w.isGigWorker ? 'Gig worker — visible to all hosts' : 'Private — only visible to you'}
                      className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${w.isGigWorker ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30' : 'bg-slate-700 text-slate-500 hover:bg-slate-600'}`}
                    >
                      {w.isGigWorker ? 'Gig' : 'Private'}
                    </button>
                    <button onClick={() => setResetWorker(w)} title="Reset password" className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-brand-400 transition-colors">
                      <KeyRound size={13} />
                    </button>
                    <button onClick={() => handleDelete(w.id)} className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {w.skills.map((s) => skillBadge(s))}
                </div>

                {w.location && (
                  <div className="flex items-center gap-1 text-xs text-slate-500 mb-3">
                    <MapPin size={11} /> {w.location}
                  </div>
                )}

                {w.bio && <p className="text-xs text-slate-500 mb-3 line-clamp-2">{w.bio}</p>}

                {/* Property assignments */}
                <div className="pt-3 border-t border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                      <Building2 size={11} />
                      Properties
                      {assignedProperties.length > 0 && (
                        <span className="bg-slate-800 text-slate-400 rounded-full px-1.5 py-0.5 text-xs">
                          {assignedProperties.length}
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => setManageWorker(w)}
                      className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
                    >
                      Manage
                    </button>
                  </div>
                  {assignedProperties.length === 0 ? (
                    <button
                      onClick={() => setManageWorker(w)}
                      className="w-full text-xs text-slate-600 border border-dashed border-slate-700 rounded-lg py-2 hover:border-slate-500 hover:text-slate-400 transition-colors"
                    >
                      + Assign to a property
                    </button>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {assignedProperties.map((ps) => (
                        <span key={ps.propertyId} className="flex items-center gap-1 text-xs text-slate-300 bg-slate-800 rounded-md px-2 py-1">
                          {TYPE_ICONS[ps.property.type] || '🏠'} {ps.property.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-slate-800 flex justify-between text-xs text-slate-500">
                  <span>{w.jobsCompleted} jobs completed</span>
                  {w.rating && (
                    <span className="flex items-center gap-1 text-amber-400">
                      <Star size={11} className="fill-amber-400" /> {w.rating.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={addModal} onClose={() => setAddModal(false)} title="Add worker">
        <WorkerForm
          onSave={async (d) => {
            await api.workers.create(d as Parameters<typeof api.workers.create>[0]);
            await load();
          }}
          onClose={() => setAddModal(false)}
        />
      </Modal>

      {resetWorker && (
        <Modal open={!!resetWorker} onClose={() => setResetWorker(null)} title="Reset worker password">
          <ResetPasswordModal worker={resetWorker} onClose={() => setResetWorker(null)} />
        </Modal>
      )}

      {manageWorker && (
        <Modal
          open={!!manageWorker}
          onClose={() => setManageWorker(null)}
          title={`${manageWorker.user.name} — Properties`}
        >
          <ManagePropertiesModal
            worker={manageWorker}
            allProperties={properties}
            onClose={() => setManageWorker(null)}
            onChanged={async () => {
              const [ws, ps] = await Promise.all([api.workers.list(), api.properties.list()]);
              setWorkers(ws);
              setProperties(ps);
              // Refresh the open modal with fresh worker data
              setManageWorker((prev) => prev ? ws.find((w) => w.id === prev.id) ?? null : null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
