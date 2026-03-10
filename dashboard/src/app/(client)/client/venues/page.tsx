'use client';

import { useEffect, useState } from 'react';
import { api, Venue } from '@/lib/api';
import { MapPin, Plus, Pencil, Trash2, Star, X, Check } from 'lucide-react';
import { PlacesAutocomplete } from '@/components/PlacesAutocomplete';

function VenueForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<Venue>;
  onSave: (data: { name: string; address: string; city: string; isDefault: boolean }) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    address: initial?.address ?? '',
    city: initial?.city ?? '',
    isDefault: initial?.isDefault ?? false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function set(key: string, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }));
    setError('');
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl space-y-3">
      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div>
        <label className="block text-xs text-slate-400 mb-1">Venue name</label>
        <input
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="The Beach Bar"
          required
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-brand-500 placeholder:text-slate-600"
        />
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1">Address</label>
        <PlacesAutocomplete
          value={form.address}
          onChange={(v) => set('address', v)}
          onSelect={({ address, city }) => {
            setForm((f) => ({ ...f, address, city: city || f.city }));
            setError('');
          }}
          placeholder="123 Baga Road, Calangute"
          required
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-brand-500 placeholder:text-slate-600"
        />
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1">City</label>
        <input
          value={form.city}
          onChange={(e) => set('city', e.target.value)}
          placeholder="Goa"
          required
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-brand-500 placeholder:text-slate-600"
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.isDefault}
          onChange={(e) => set('isDefault', e.target.checked)}
          className="rounded"
        />
        <span className="text-xs text-slate-400">Set as default venue</span>
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {loading ? 'Saving…' : 'Save venue'}
        </button>
      </div>
    </form>
  );
}

export default function VenuesPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    api.venues.list()
      .then(setVenues)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(data: { name: string; address: string; city: string; isDefault: boolean }) {
    const venue = await api.venues.create(data);
    setVenues((prev) => {
      const updated = data.isDefault ? prev.map((v) => ({ ...v, isDefault: false })) : prev;
      return [...updated, venue];
    });
    setShowNew(false);
  }

  async function handleUpdate(id: string, data: { name: string; address: string; city: string; isDefault: boolean }) {
    const updated = await api.venues.update(id, data);
    setVenues((prev) => {
      const list = data.isDefault ? prev.map((v) => ({ ...v, isDefault: false })) : prev;
      return list.map((v) => (v.id === id ? updated : v));
    });
    setEditing(null);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this venue? Existing shifts at this venue will not be affected.')) return;
    await api.venues.delete(id);
    setVenues((prev) => prev.filter((v) => v.id !== id));
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Venues</h1>
        {!showNew && (
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={16} />
            Add Venue
          </button>
        )}
      </div>

      {showNew && (
        <div className="mb-4">
          <VenueForm onSave={handleCreate} onCancel={() => setShowNew(false)} />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : venues.length === 0 && !showNew ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-xl">
          <MapPin size={32} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No venues yet</p>
          <button
            onClick={() => setShowNew(true)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm rounded-lg transition-colors"
          >
            <Plus size={14} />
            Add your first venue
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {venues.map((venue) => (
            <div key={venue.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              {editing === venue.id ? (
                <div className="p-4">
                  <VenueForm
                    initial={venue}
                    onSave={(data) => handleUpdate(venue.id, data)}
                    onCancel={() => setEditing(null)}
                  />
                </div>
              ) : (
                <div className="p-4 flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 shrink-0 mt-0.5">
                      <MapPin size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-100">{venue.name}</span>
                        {venue.isDefault && (
                          <span className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full">
                            <Star size={10} fill="currentColor" />
                            Default
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{venue.address}</div>
                      <div className="text-xs text-slate-500">{venue.city}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setEditing(venue.id)}
                      className="p-2 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(venue.id)}
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
