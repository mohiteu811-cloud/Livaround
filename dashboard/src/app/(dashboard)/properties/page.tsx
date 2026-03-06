'use client';

import { useEffect, useState } from 'react';
import { Plus, MapPin, Bed, Bath, Users, MoreVertical, Wifi } from 'lucide-react';
import { api, Property } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea, FormField } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';

const TYPE_ICONS: Record<string, string> = {
  VILLA: '🏡',
  APARTMENT: '🏢',
  HOUSE: '🏠',
  CONDO: '🏙️',
};

const COMMON_AMENITIES = [
  'WiFi', 'Pool', 'Air Conditioning', 'Kitchen', 'Parking',
  'Gym', 'Washer', 'Dryer', 'Beach Access', 'Garden',
];

function PropertyForm({
  initial,
  onSave,
  onClose,
}: {
  initial?: Partial<Property>;
  onSave: (data: Partial<Property>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<Property>>({
    name: '', address: '', city: '', country: '', type: 'VILLA',
    bedrooms: 1, bathrooms: 1, maxGuests: 2, amenities: [], description: '',
    ...initial,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function set(key: string, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleAmenity(a: string) {
    const cur = form.amenities || [];
    set('amenities', cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]);
  }

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
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Property name">
          <Input placeholder="Villa Serenity" value={form.name} onChange={(e) => set('name', e.target.value)} required />
        </FormField>
        <FormField label="Type">
          <Select value={form.type} onChange={(e) => set('type', e.target.value)}>
            {['VILLA', 'APARTMENT', 'HOUSE', 'CONDO'].map((t) => (
              <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
            ))}
          </Select>
        </FormField>
      </div>
      <FormField label="Address">
        <Input placeholder="Jl. Raya Ubud No. 12" value={form.address} onChange={(e) => set('address', e.target.value)} required />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="City">
          <Input placeholder="Ubud" value={form.city} onChange={(e) => set('city', e.target.value)} required />
        </FormField>
        <FormField label="Country">
          <Input placeholder="Indonesia" value={form.country} onChange={(e) => set('country', e.target.value)} required />
        </FormField>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <FormField label="Bedrooms">
          <Input type="number" min={0} value={form.bedrooms} onChange={(e) => set('bedrooms', parseInt(e.target.value))} required />
        </FormField>
        <FormField label="Bathrooms">
          <Input type="number" min={0} value={form.bathrooms} onChange={(e) => set('bathrooms', parseInt(e.target.value))} required />
        </FormField>
        <FormField label="Max guests">
          <Input type="number" min={1} value={form.maxGuests} onChange={(e) => set('maxGuests', parseInt(e.target.value))} required />
        </FormField>
      </div>
      <FormField label="Description">
        <Textarea rows={3} placeholder="Describe the property..." value={form.description || ''} onChange={(e) => set('description', e.target.value)} />
      </FormField>
      <FormField label="Airbnb URL (optional)">
        <Input placeholder="https://airbnb.com/rooms/..." value={form.airbnbUrl || ''} onChange={(e) => set('airbnbUrl', e.target.value)} />
      </FormField>
      <div>
        <p className="text-sm font-medium text-slate-300 mb-2">Amenities</p>
        <div className="flex flex-wrap gap-2">
          {COMMON_AMENITIES.map((a) => (
            <button
              type="button"
              key={a}
              onClick={() => toggleAmenity(a)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                (form.amenities || []).includes(a)
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onClose} className="flex-1 justify-center">Cancel</Button>
        <Button type="submit" loading={loading} className="flex-1 justify-center">
          {initial?.id ? 'Save changes' : 'Add property'}
        </Button>
      </div>
    </form>
  );
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; property?: Property }>({ open: false });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await api.properties.list();
      setProperties(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(data: Partial<Property>) {
    if (modal.property?.id) {
      await api.properties.update(modal.property.id, data);
    } else {
      await api.properties.create(data);
    }
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this property? This cannot be undone.')) return;
    await api.properties.delete(id);
    await load();
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Properties</h1>
          <p className="text-slate-400 text-sm mt-1">{properties.length} properties managed</p>
        </div>
        <Button onClick={() => setModal({ open: true })}>
          <Plus size={16} /> Add property
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : properties.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center py-16 gap-3">
          <span className="text-5xl">🏡</span>
          <p className="text-slate-400">No properties yet</p>
          <Button onClick={() => setModal({ open: true })}>Add your first property</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {properties.map((p) => (
            <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-colors">
              {/* Header */}
              <div className="h-40 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-5xl">
                {TYPE_ICONS[p.type] || '🏠'}
              </div>

              <div className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-slate-100">{p.name}</h3>
                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                      <MapPin size={11} />
                      {p.city}, {p.country}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={p.isActive ? 'success' : 'default'}>
                      {p.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <div className="relative group">
                      <button className="p-1 rounded hover:bg-slate-800 text-slate-400">
                        <MoreVertical size={15} />
                      </button>
                      <div className="absolute right-0 top-7 z-10 hidden group-hover:flex flex-col bg-slate-800 border border-slate-700 rounded-lg py-1 min-w-32 shadow-xl">
                        <button
                          onClick={() => setModal({ open: true, property: p })}
                          className="px-3 py-1.5 text-sm text-left text-slate-300 hover:bg-slate-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="px-3 py-1.5 text-sm text-left text-red-400 hover:bg-slate-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-400 my-3">
                  <span className="flex items-center gap-1"><Bed size={12} /> {p.bedrooms} bed</span>
                  <span className="flex items-center gap-1"><Bath size={12} /> {p.bathrooms} bath</span>
                  <span className="flex items-center gap-1"><Users size={12} /> {p.maxGuests} guests</span>
                </div>

                {p.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {p.amenities.slice(0, 3).map((a) => (
                      <span key={a} className="inline-flex items-center gap-0.5 text-xs text-slate-500 bg-slate-800 rounded px-1.5 py-0.5">
                        {a === 'WiFi' && <Wifi size={10} />} {a}
                      </span>
                    ))}
                    {p.amenities.length > 3 && (
                      <span className="text-xs text-slate-600 bg-slate-800 rounded px-1.5 py-0.5">
                        +{p.amenities.length - 3}
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-slate-800 flex justify-between text-xs text-slate-500">
                  <span>{p._count?.bookings || 0} bookings</span>
                  <span>{p._count?.jobs || 0} jobs</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false })}
        title={modal.property ? 'Edit property' : 'Add property'}
        size="lg"
      >
        <PropertyForm
          initial={modal.property}
          onSave={handleSave}
          onClose={() => setModal({ open: false })}
        />
      </Modal>
    </div>
  );
}
