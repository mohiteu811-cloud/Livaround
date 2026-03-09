'use client';

import { useEffect, useState } from 'react';
import { Plus, Building2, Trash2, UserCircle, Link2, Unlink } from 'lucide-react';
import { api, OwnerEntry, Property, PropertyOwnership } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input, FormField } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

const INVOLVEMENT_LABELS: Record<string, { label: string; color: string; desc: string }> = {
  NONE: { label: 'No involvement', color: 'text-slate-400 bg-slate-800', desc: 'Owner is not notified about anything' },
  REPORTS_ONLY: { label: 'Reports only', color: 'text-blue-400 bg-blue-500/10', desc: 'Can see booking activity' },
  FINANCIAL: { label: 'Financial', color: 'text-amber-400 bg-amber-500/10', desc: 'Can see bookings and revenue' },
  FULL: { label: 'Full access', color: 'text-emerald-400 bg-emerald-500/10', desc: 'Can see everything including maintenance' },
};

function CreateOwnerForm({ onSave, onClose }: { onSave: (d: unknown) => Promise<{ tempPassword?: string } | void>; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ email: string; tempPassword: string } | null>(null);

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await onSave(form) as { tempPassword?: string; user?: { email: string } } | undefined;
      if (result?.tempPassword) {
        setCreated({ email: form.email, tempPassword: result.tempPassword });
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
        <p className="text-slate-100 font-semibold">Owner account created!</p>
        <p className="text-slate-400 text-sm">Share these credentials with <strong>{form.name}</strong>:</p>
        <div className="bg-slate-800 rounded-lg p-4 text-left">
          <p className="text-xs text-slate-500 mb-1">Login URL</p>
          <p className="text-slate-200 font-mono text-sm">/login → Owner tab</p>
          <p className="text-xs text-slate-500 mb-1 mt-3">Email</p>
          <p className="text-slate-200 font-mono text-sm">{created.email}</p>
          <p className="text-xs text-slate-500 mb-1 mt-3">Temporary password</p>
          <p className="text-slate-200 font-mono text-sm font-bold">{created.tempPassword}</p>
        </div>
        <Button onClick={onClose} className="w-full justify-center">Done</Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Full name">
          <Input placeholder="Rajesh Sharma" value={form.name} onChange={(e) => set('name', e.target.value)} required />
        </FormField>
        <FormField label="Email">
          <Input type="email" placeholder="rajesh@example.com" value={form.email} onChange={(e) => set('email', e.target.value)} required />
        </FormField>
      </div>
      <FormField label="Phone (optional)">
        <Input placeholder="+91 98765 43210" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
      </FormField>
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onClose} className="flex-1 justify-center">Cancel</Button>
        <Button type="submit" loading={loading} className="flex-1 justify-center">Create owner</Button>
      </div>
    </form>
  );
}

function LinkPropertyModal({
  owner,
  properties,
  onSave,
  onClose,
}: {
  owner: OwnerEntry;
  properties: Property[];
  onSave: () => void;
  onClose: () => void;
}) {
  const linkedIds = owner.properties.map((p) => p.propertyId);
  const available = properties.filter((p) => !linkedIds.includes(p.id));
  const [form, setForm] = useState({
    propertyId: available[0]?.id || '',
    involvementLevel: 'REPORTS_ONLY',
    ownershipPercent: '',
    commissionPct: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.owners.linkProperty(owner.id, {
        propertyId: form.propertyId,
        involvementLevel: form.involvementLevel,
        ownershipPercent: form.ownershipPercent ? parseFloat(form.ownershipPercent) : undefined,
        commissionPct: form.commissionPct ? parseFloat(form.commissionPct) : undefined,
      });
      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link');
    } finally {
      setLoading(false);
    }
  }

  if (available.length === 0) {
    return (
      <div className="text-center py-6 space-y-2">
        <p className="text-slate-400">All properties are already linked to this owner.</p>
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>}
      <FormField label="Property">
        <select
          value={form.propertyId}
          onChange={(e) => setForm((f) => ({ ...f, propertyId: e.target.value }))}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-brand-500"
          required
        >
          {available.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.city}</option>)}
        </select>
      </FormField>
      <FormField label="Involvement level">
        <div className="space-y-2">
          {Object.entries(INVOLVEMENT_LABELS).map(([k, v]) => (
            <label key={k} className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio" name="involvement" value={k}
                checked={form.involvementLevel === k}
                onChange={() => setForm((f) => ({ ...f, involvementLevel: k }))}
                className="mt-0.5"
              />
              <div>
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${v.color}`}>{v.label}</span>
                <p className="text-xs text-slate-500 mt-0.5">{v.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Ownership % (optional)">
          <Input
            type="number" min="0" max="100" placeholder="e.g. 50"
            value={form.ownershipPercent}
            onChange={(e) => setForm((f) => ({ ...f, ownershipPercent: e.target.value }))}
          />
        </FormField>
        <FormField label="Commission % (optional)">
          <Input
            type="number" min="0" max="100" placeholder="e.g. 20"
            value={form.commissionPct}
            onChange={(e) => setForm((f) => ({ ...f, commissionPct: e.target.value }))}
          />
        </FormField>
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onClose} className="flex-1 justify-center">Cancel</Button>
        <Button type="submit" loading={loading} className="flex-1 justify-center">Link property</Button>
      </div>
    </form>
  );
}

export default function OwnersPage() {
  const [owners, setOwners] = useState<OwnerEntry[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(false);
  const [linkModal, setLinkModal] = useState<OwnerEntry | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [o, p] = await Promise.all([api.owners.list(), api.properties.list()]);
      setOwners(o);
      setProperties(p);
    } catch (err) {
      console.error('Failed to load owners/properties:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUnlink(ownerId: string, propertyId: string, propertyName: string) {
    if (!confirm(`Remove access to "${propertyName}" for this owner?`)) return;
    await api.owners.unlinkProperty(ownerId, propertyId);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this owner account? This cannot be undone.')) return;
    await api.owners.delete(id);
    load();
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Property Owners</h1>
          <p className="text-slate-400 text-sm mt-1">Manage owner access and visibility into their properties</p>
        </div>
        <Button onClick={() => setCreateModal(true)}><Plus size={16} /> Add owner</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : owners.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center py-16 gap-3">
          <UserCircle size={40} className="text-slate-600" />
          <p className="text-slate-400">No owners yet</p>
          <p className="text-slate-600 text-sm text-center max-w-xs">Add property owners to give them a dashboard view of their properties, bookings, and financials — with configurable visibility.</p>
          <Button onClick={() => setCreateModal(true)}>Add first owner</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {owners.map((owner) => (
            <div key={owner.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 font-semibold text-sm">
                    {owner.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-100">{owner.user.name}</p>
                    <p className="text-xs text-slate-500">{owner.user.email}</p>
                    {owner.user.phone && <p className="text-xs text-slate-600">{owner.user.phone}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setLinkModal(owner)}
                    className="text-xs py-1 px-2 h-auto"
                  >
                    <Link2 size={12} /> Link property
                  </Button>
                  <button onClick={() => handleDelete(owner.id)} className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-red-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {owner.properties.length === 0 ? (
                <p className="text-xs text-slate-600 italic">No properties linked yet</p>
              ) : (
                <div className="space-y-2">
                  {owner.properties.map((op) => {
                    const inv = INVOLVEMENT_LABELS[op.involvementLevel] || INVOLVEMENT_LABELS.NONE;
                    const prop = properties.find((p) => p.id === op.propertyId);
                    return (
                      <div key={op.id} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Building2 size={13} className="text-slate-500" />
                          <span className="text-sm text-slate-300">{op.property?.name || prop?.name}</span>
                          <span className="text-xs text-slate-600">— {op.property?.city || prop?.city}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {op.ownershipPercent && <span className="text-xs text-slate-500">{op.ownershipPercent}% owned</span>}
                          {op.commissionPct !== undefined && op.commissionPct !== null && <span className="text-xs text-amber-500">{op.commissionPct}% commission</span>}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${inv.color}`}>{inv.label}</span>
                          <button
                            onClick={() => handleUnlink(owner.id, op.propertyId, op.property?.name || prop?.name || '')}
                            className="p-1 rounded hover:bg-slate-700 text-slate-600 hover:text-red-400 transition-colors"
                          >
                            <Unlink size={11} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Add property owner">
        <CreateOwnerForm
          onSave={async (d) => {
            const result = await api.owners.create(d as Parameters<typeof api.owners.create>[0]);
            await load();
            return result;
          }}
          onClose={() => setCreateModal(false)}
        />
      </Modal>

      {linkModal && (
        <Modal open onClose={() => setLinkModal(null)} title={`Link property to ${linkModal.user.name}`}>
          <LinkPropertyModal
            owner={linkModal}
            properties={properties}
            onSave={load}
            onClose={() => setLinkModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
