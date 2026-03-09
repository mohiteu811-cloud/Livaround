'use client';

import { useEffect, useState } from 'react';
import { Plus, Phone, MapPin, Trash2, Pencil, Upload, Building2, X, Check } from 'lucide-react';
import { api, Tradesman, Property } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input, FormField } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

// ── Tradesman Form ────────────────────────────────────────────────────────────

function TradesmanForm({
  initial,
  properties,
  onSave,
  onClose,
}: {
  initial?: Tradesman;
  properties: Property[];
  onSave: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    trade: initial?.trade ?? '',
    phones: initial?.phones?.length ? initial.phones : [''],
    company: initial?.company ?? '',
    area: initial?.area ?? '',
    email: initial?.email ?? '',
    notes: initial?.notes ?? '',
    propertyIds: initial?.properties?.map((p) => p.propertyId) ?? [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function set(k: string, v: unknown) { setForm((f) => ({ ...f, [k]: v })); }
  function setPhone(i: number, val: string) { setForm((f) => ({ ...f, phones: f.phones.map((p, j) => j === i ? val : p) })); }
  function addPhone() { setForm((f) => ({ ...f, phones: [...f.phones, ''] })); }
  function removePhone(i: number) { setForm((f) => ({ ...f, phones: f.phones.filter((_, j) => j !== i) })); }
  function toggleProperty(id: string) {
    setForm((f) => ({
      ...f,
      propertyIds: f.propertyIds.includes(id) ? f.propertyIds.filter((p) => p !== id) : [...f.propertyIds, id],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.trade.trim()) return;
    setLoading(true);
    setError('');
    const data = {
      name: form.name,
      trade: form.trade,
      phones: form.phones.filter((p) => p.trim()),
      company: form.company || undefined,
      area: form.area || undefined,
      email: form.email || undefined,
      notes: form.notes || undefined,
      propertyIds: form.propertyIds,
    };
    try {
      if (initial) {
        await api.tradesmen.update(initial.id, data);
      } else {
        await api.tradesmen.create(data);
      }
      onSave();
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

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Name *">
          <Input placeholder="e.g. Eknath Baragundi" value={form.name} onChange={(e) => set('name', e.target.value)} required />
        </FormField>
        <FormField label="Trade / Type *">
          <Input placeholder="e.g. Electrician" value={form.trade} onChange={(e) => set('trade', e.target.value)} required />
        </FormField>
      </div>

      <FormField label="Phone numbers">
        {form.phones.map((phone, i) => (
          <div key={i} className="flex gap-2 mb-1.5">
            <Input placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(i, e.target.value)} />
            {form.phones.length > 1 && (
              <button type="button" onClick={() => removePhone(i)} className="p-2 rounded text-slate-500 hover:text-red-400">
                <X size={14} />
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={addPhone} className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 mt-0.5">
          <Plus size={11} /> Add number
        </button>
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Company">
          <Input placeholder="e.g. TAG Engineers" value={form.company} onChange={(e) => set('company', e.target.value)} />
        </FormField>
        <FormField label="Area / Location">
          <Input placeholder="e.g. Calangute, Goa" value={form.area} onChange={(e) => set('area', e.target.value)} />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Email">
          <Input type="email" placeholder="optional" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </FormField>
        <FormField label="Notes">
          <Input placeholder="optional" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </FormField>
      </div>

      {properties.length > 0 && (
        <div>
          <p className="text-sm font-medium text-slate-300 mb-2">Associated villas</p>
          <div className="flex flex-wrap gap-2">
            {properties.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleProperty(p.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  form.propertyIds.includes(p.id)
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {form.propertyIds.includes(p.id) && <Check size={10} className="inline mr-1" />}
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onClose} className="flex-1 justify-center">Cancel</Button>
        <Button type="submit" loading={loading} className="flex-1 justify-center">{initial ? 'Save changes' : 'Add tradesman'}</Button>
      </div>
    </form>
  );
}

// ── Import Modal ──────────────────────────────────────────────────────────────

function ImportModal({
  properties,
  onDone,
  onClose,
}: {
  properties: Property[];
  onDone: () => void;
  onClose: () => void;
}) {
  const [propertyId, setPropertyId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number; total: number } | null>(null);
  const [error, setError] = useState('');

  async function handleImport() {
    if (!propertyId) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.tradesmen.importFromContacts(propertyId);
      setResult(res);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-4 text-center">
        <div className="text-4xl">✅</div>
        <p className="text-slate-100 font-semibold">Import complete</p>
        <div className="bg-slate-800 rounded-lg p-4 text-left space-y-2">
          <div className="flex justify-between text-sm"><span className="text-slate-400">Total contacts</span><span className="text-slate-200">{result.total}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-400">Added to database</span><span className="text-emerald-400 font-medium">{result.created}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-400">Already existed (skipped)</span><span className="text-slate-500">{result.skipped}</span></div>
        </div>
        <Button onClick={onClose} className="w-full justify-center">Done</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>}
      <p className="text-sm text-slate-400">
        Import vendor contacts from a villa&apos;s guide into the tradesmen database. Duplicates (same trade + phone) are automatically skipped.
      </p>
      <FormField label="Select villa">
        <select
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-brand-500"
        >
          <option value="">Choose a villa...</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>{p.name} — {p.city}</option>
          ))}
        </select>
      </FormField>
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onClose} className="flex-1 justify-center">Cancel</Button>
        <Button onClick={handleImport} loading={loading} disabled={!propertyId} className="flex-1 justify-center">
          <Upload size={14} /> Import contacts
        </Button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TradesmenPage() {
  const [tradesmen, setTradesmen] = useState<Tradesman[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'add' | 'import' | null>(null);
  const [editing, setEditing] = useState<Tradesman | null>(null);

  // Filters
  const [filterTrade, setFilterTrade] = useState('');
  const [filterProperty, setFilterProperty] = useState('');
  const [filterArea, setFilterArea] = useState('');

  useEffect(() => {
    // Load properties once on mount, independently of tradesmen
    api.properties.list().then(setProperties).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [filterTrade, filterProperty, filterArea]);

  async function load() {
    setLoading(true);
    try {
      const ts = await api.tradesmen.list({
        ...(filterTrade && { trade: filterTrade }),
        ...(filterProperty && { propertyId: filterProperty }),
        ...(filterArea && { area: filterArea }),
      });
      setTradesmen(ts);
    } catch {
      setTradesmen([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remove ${name} from the tradesmen database?`)) return;
    await api.tradesmen.delete(id);
    load();
  }

  // Collect unique trade types for filter dropdown
  const uniqueTrades = Array.from(new Set(tradesmen.map((t) => t.trade))).sort();

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Tradesmen</h1>
          <p className="text-slate-400 text-sm mt-1">{tradesmen.length} in database</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setModal('import')}>
            <Upload size={15} /> Import from contacts
          </Button>
          <Button onClick={() => setModal('add')}>
            <Plus size={15} /> Add tradesman
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={filterTrade}
          onChange={(e) => setFilterTrade(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm focus:outline-none focus:border-brand-500"
        >
          <option value="">All trades</option>
          {uniqueTrades.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={filterProperty}
          onChange={(e) => setFilterProperty(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm focus:outline-none focus:border-brand-500"
        >
          <option value="">All villas</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input
          type="text"
          placeholder="Filter by area..."
          value={filterArea}
          onChange={(e) => setFilterArea(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm focus:outline-none focus:border-brand-500 w-40"
        />
        {(filterTrade || filterProperty || filterArea) && (
          <button
            onClick={() => { setFilterTrade(''); setFilterProperty(''); setFilterArea(''); }}
            className="px-3 py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tradesmen.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center py-16 gap-3">
          <span className="text-5xl">🔧</span>
          <p className="text-slate-400">No tradesmen yet</p>
          <p className="text-slate-600 text-sm text-center max-w-xs">
            Import from villa vendor contacts or add manually to build your tradesmen database.
          </p>
          <div className="flex gap-2 mt-2">
            <Button variant="secondary" onClick={() => setModal('import')}><Upload size={14} /> Import</Button>
            <Button onClick={() => setModal('add')}><Plus size={14} /> Add manually</Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tradesmen.map((t) => (
            <div key={t.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-brand-600/20 text-brand-400">
                      {t.trade}
                    </span>
                  </div>
                  <p className="font-semibold text-slate-100 mt-1.5">{t.name}</p>
                  {t.company && (
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Building2 size={10} /> {t.company}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setEditing(t)} className="p-1.5 rounded hover:bg-slate-800 text-slate-600 hover:text-slate-300 transition-colors">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => handleDelete(t.id, t.name)} className="p-1.5 rounded hover:bg-slate-800 text-slate-600 hover:text-red-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {t.phones.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {t.phones.map((phone, i) => (
                    <a key={i} href={`tel:${phone.replace(/\s/g, '')}`} className="text-xs text-brand-400 flex items-center gap-1 hover:text-brand-300">
                      <Phone size={10} /> {phone}
                    </a>
                  ))}
                </div>
              )}

              {t.area && (
                <p className="text-xs text-slate-500 flex items-center gap-1 mb-3">
                  <MapPin size={10} /> {t.area}
                </p>
              )}

              {t.notes && <p className="text-xs text-slate-600 italic mb-3">{t.notes}</p>}

              {t.properties.length > 0 && (
                <div className="pt-3 border-t border-slate-800 flex flex-wrap gap-1.5">
                  {t.properties.map((tp) => (
                    <span key={tp.id} className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-400">
                      {tp.property.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal === 'add' && (
        <Modal open onClose={() => setModal(null)} title="Add tradesman">
          <TradesmanForm properties={properties} onSave={load} onClose={() => setModal(null)} />
        </Modal>
      )}

      {modal === 'import' && (
        <Modal open onClose={() => setModal(null)} title="Import from vendor contacts">
          <ImportModal properties={properties} onDone={load} onClose={() => setModal(null)} />
        </Modal>
      )}

      {editing && (
        <Modal open onClose={() => setEditing(null)} title="Edit tradesman">
          <TradesmanForm
            initial={editing}
            properties={properties}
            onSave={load}
            onClose={() => setEditing(null)}
          />
        </Modal>
      )}
    </div>
  );
}
