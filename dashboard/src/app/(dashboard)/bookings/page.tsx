'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Plus, Search, LogIn, LogOut, X } from 'lucide-react';
import { api, Booking, Property } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea, FormField } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { statusBadge } from '@/components/ui/Badge';

const SOURCE_ICONS: Record<string, string> = {
  AIRBNB: '🏠',
  DIRECT: '🔗',
  BOOKING_COM: '📘',
  VRBO: '🌐',
  LIVAROUND: '✨',
};

function BookingForm({
  properties,
  initial,
  onSave,
  onClose,
}: {
  properties: Property[];
  initial?: Partial<Booking>;
  onSave: (d: Partial<Booking>) => Promise<void>;
  onClose: () => void;
}) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const checkout = new Date(tomorrow);
  checkout.setDate(checkout.getDate() + 7);

  const [form, setForm] = useState<Partial<Booking>>({
    propertyId: properties[0]?.id || '',
    guestName: '', guestEmail: '', guestPhone: '',
    checkIn: tomorrow.toISOString().slice(0, 16),
    checkOut: checkout.toISOString().slice(0, 16),
    guestCount: 2, totalAmount: 0, currency: 'INR',
    source: 'DIRECT', notes: '',
    ...initial,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function set(k: string, v: unknown) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onSave({ ...form, checkIn: new Date(form.checkIn as string).toISOString(), checkOut: new Date(form.checkOut as string).toISOString() });
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
        <FormField label="Property">
          <Select value={form.propertyId} onChange={(e) => set('propertyId', e.target.value)} required>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </FormField>
        <FormField label="Source">
          <Select value={form.source} onChange={(e) => set('source', e.target.value)}>
            {['DIRECT', 'AIRBNB', 'BOOKING_COM', 'VRBO', 'LIVAROUND'].map((s) => (
              <option key={s} value={s}>{s.replace('_', '.')}</option>
            ))}
          </Select>
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Guest name">
          <Input placeholder="Sneha Kapoor" value={form.guestName} onChange={(e) => set('guestName', e.target.value)} required />
        </FormField>
        <FormField label="Guest email">
          <Input type="email" placeholder="guest@example.com" value={form.guestEmail} onChange={(e) => set('guestEmail', e.target.value)} required />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Check-in">
          <Input type="datetime-local" value={form.checkIn as string} onChange={(e) => set('checkIn', e.target.value)} required />
        </FormField>
        <FormField label="Check-out">
          <Input type="datetime-local" value={form.checkOut as string} onChange={(e) => set('checkOut', e.target.value)} required />
        </FormField>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <FormField label="Guests">
          <Input type="number" min={1} value={form.guestCount} onChange={(e) => set('guestCount', parseInt(e.target.value))} required />
        </FormField>
        <FormField label="Total amount">
          <Input type="number" min={0} step="0.01" value={form.totalAmount} onChange={(e) => set('totalAmount', parseFloat(e.target.value))} required />
        </FormField>
        <FormField label="Currency">
          <Select value={form.currency} onChange={(e) => set('currency', e.target.value)}>
            {['USD', 'EUR', 'GBP', 'INR', 'AED'].map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </FormField>
      </div>
      <FormField label="Notes">
        <Textarea rows={2} placeholder="Any special requests or notes..." value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} />
      </FormField>
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onClose} className="flex-1 justify-center">Cancel</Button>
        <Button type="submit" loading={loading} className="flex-1 justify-center">
          {initial?.id ? 'Save changes' : 'Add booking'}
        </Button>
      </div>
    </form>
  );
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modal, setModal] = useState<{ open: boolean; booking?: Booking }>({ open: false });

  useEffect(() => {
    Promise.all([api.bookings.list(), api.properties.list()]).then(([b, p]) => {
      setBookings(b); setProperties(p);
    }).finally(() => setLoading(false));
  }, []);

  async function load() {
    const [b, p] = await Promise.all([api.bookings.list(), api.properties.list()]);
    setBookings(b); setProperties(p);
  }

  async function handleCheckIn(id: string) {
    await api.bookings.checkIn(id); load();
  }
  async function handleCheckOut(id: string) {
    await api.bookings.checkOut(id); load();
  }
  async function handleCancel(id: string) {
    if (!confirm('Cancel this booking?')) return;
    await api.bookings.cancel(id); load();
  }

  const filtered = bookings.filter((b) => {
    const matchSearch = !search || b.guestName.toLowerCase().includes(search.toLowerCase()) || b.guestEmail.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || b.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Bookings</h1>
          <p className="text-slate-400 text-sm mt-1">{bookings.length} total bookings</p>
        </div>
        <Button onClick={() => setModal({ open: true })}>
          <Plus size={16} /> Add booking
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input placeholder="Search guests..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-40">
          <option value="">All statuses</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="CHECKED_IN">Checked In</option>
          <option value="CHECKED_OUT">Checked Out</option>
          <option value="CANCELLED">Cancelled</option>
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
                <th className="text-left px-6 py-3">Guest</th>
                <th className="text-left px-6 py-3">Property</th>
                <th className="text-left px-6 py-3">Dates</th>
                <th className="text-left px-6 py-3">Source</th>
                <th className="text-right px-6 py-3">Amount</th>
                <th className="text-left px-6 py-3">Status</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">No bookings found</td>
                </tr>
              )}
              {filtered.map((b) => (
                <tr key={b.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-200">{b.guestName}</p>
                    <p className="text-xs text-slate-500">{b.guestEmail}</p>
                  </td>
                  <td className="px-6 py-4 text-slate-300">{b.property?.name}</td>
                  <td className="px-6 py-4 text-slate-400 text-xs">
                    <span>{format(new Date(b.checkIn), 'dd MMM')}</span>
                    <span className="mx-1 text-slate-600">→</span>
                    <span>{format(new Date(b.checkOut), 'dd MMM yyyy')}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-slate-400 text-xs">{SOURCE_ICONS[b.source]} {b.source.replace('_', '.')}</span>
                  </td>
                  <td className="px-6 py-4 text-right text-slate-300 font-medium">
                    {b.currency} {b.totalAmount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4">{statusBadge(b.status)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 justify-end">
                      {b.status === 'CONFIRMED' && (
                        <button onClick={() => handleCheckIn(b.id)} className="p-1.5 rounded hover:bg-slate-800 text-emerald-400 hover:text-emerald-300" title="Check in">
                          <LogIn size={14} />
                        </button>
                      )}
                      {b.status === 'CHECKED_IN' && (
                        <button onClick={() => handleCheckOut(b.id)} className="p-1.5 rounded hover:bg-slate-800 text-sky-400 hover:text-sky-300" title="Check out">
                          <LogOut size={14} />
                        </button>
                      )}
                      {['CONFIRMED', 'CHECKED_IN'].includes(b.status) && (
                        <button onClick={() => handleCancel(b.id)} className="p-1.5 rounded hover:bg-slate-800 text-red-400 hover:text-red-300" title="Cancel">
                          <X size={14} />
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

      <Modal open={modal.open} onClose={() => setModal({ open: false })} title="Add booking" size="lg">
        <BookingForm
          properties={properties}
          initial={modal.booking}
          onSave={async (d) => { await api.bookings.create(d); await load(); }}
          onClose={() => setModal({ open: false })}
        />
      </Modal>
    </div>
  );
}
