'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Wrench } from 'lucide-react';
import { api, TradeRole } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, FormField } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

const PRESET_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6',
  '#8b5cf6', '#14b8a6', '#f97316', '#ec4899', '#64748b',
];

const PRESET_TRADES = [
  'Plumber', 'Carpenter', 'Electrician', 'WiFi / Tech Support',
  'AC Technician', 'Painter', 'Mason', 'Pest Control', 'Locksmith', 'Landscaper',
];

function TradeRoleForm({
  initial,
  onSave,
  onClose,
}: {
  initial?: Partial<TradeRole>;
  onSave: (d: unknown) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    description: initial?.description || '',
    color: initial?.color || PRESET_COLORS[0],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>}

      <FormField label="Trade name">
        <Input placeholder="e.g. Plumber" value={form.name} onChange={(e) => set('name', e.target.value)} required />
        <div className="flex flex-wrap gap-1.5 mt-2">
          {PRESET_TRADES.map((t) => (
            <button
              key={t} type="button"
              onClick={() => set('name', t)}
              className="px-2 py-1 rounded-full text-xs bg-slate-800 text-slate-400 hover:bg-slate-700 transition-colors"
            >
              {t}
            </button>
          ))}
        </div>
      </FormField>

      <FormField label="Description (optional)">
        <Textarea rows={2} placeholder="What does this tradesperson do?" value={form.description} onChange={(e) => set('description', e.target.value)} />
      </FormField>

      <div>
        <p className="text-sm font-medium text-slate-300 mb-2">Color tag</p>
        <div className="flex gap-2 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button
              key={c} type="button"
              onClick={() => set('color', c)}
              className={`w-7 h-7 rounded-full transition-transform ${form.color === c ? 'scale-125 ring-2 ring-white/40' : 'hover:scale-110'}`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onClose} className="flex-1 justify-center">Cancel</Button>
        <Button type="submit" loading={loading} className="flex-1 justify-center">{initial ? 'Update' : 'Create'}</Button>
      </div>
    </form>
  );
}

export default function TradeRolesPage() {
  const [roles, setRoles] = useState<TradeRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'create' | TradeRole | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setRoles(await api.tradeRoles.list()); } finally { setLoading(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this trade role? Workers assigned to it will be unlinked.')) return;
    await api.tradeRoles.delete(id);
    load();
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Trade Roles</h1>
          <p className="text-slate-400 text-sm mt-1">Define the maintenance specializations for your properties</p>
        </div>
        <Button onClick={() => setModal('create')}><Plus size={16} /> Add trade role</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : roles.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center py-16 gap-3">
          <Wrench size={40} className="text-slate-600" />
          <p className="text-slate-400">No trade roles yet</p>
          <p className="text-slate-600 text-sm text-center max-w-xs">Create roles like Plumber, Electrician, or Carpenter so caretakers can log maintenance requests to the right tradesperson.</p>
          <Button onClick={() => setModal('create')}>Add your first trade role</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {roles.map((role) => (
            <div key={role.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: role.color + '22', border: `1px solid ${role.color}44` }}>
                    <Wrench size={16} style={{ color: role.color }} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-100">{role.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-xs text-slate-500">{role._count?.workers ?? 0} workers</span>
                      <span className="text-slate-700">·</span>
                      <span className="text-xs text-slate-500">{role._count?.maintenanceRequests ?? 0} requests</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setModal(role)} className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => handleDelete(role.id)} className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-red-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              {role.description && <p className="text-xs text-slate-500 line-clamp-2">{role.description}</p>}
              <div className="mt-3 pt-3 border-t border-slate-800">
                <div className="w-full h-1 rounded-full" style={{ background: role.color }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal === 'create' ? 'New trade role' : modal ? `Edit: ${(modal as TradeRole).name}` : ''}
      >
        <TradeRoleForm
          initial={modal !== 'create' && modal ? (modal as TradeRole) : undefined}
          onSave={async (d) => {
            if (modal === 'create') {
              await api.tradeRoles.create(d as Parameters<typeof api.tradeRoles.create>[0]);
            } else if (modal) {
              await api.tradeRoles.update((modal as TradeRole).id, d as Partial<TradeRole>);
            }
            await load();
          }}
          onClose={() => setModal(null)}
        />
      </Modal>
    </div>
  );
}
