'use client';

import { useEffect, useState, useMemo } from 'react';
import { api, Booking, GuestID, GuestVisitor } from '@/lib/api';
import { UserCheck, Search, X, Eye, ChevronDown } from 'lucide-react';

// ─── helpers ─────────────────────────────────────────────────

function nights(checkIn: string, checkOut: string) {
  return Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const SOURCE_LABEL: Record<string, string> = {
  AIRBNB: 'Airbnb', DIRECT: 'Direct', BOOKING: 'Booking.com',
  VRBO: 'VRBO', LIVAROUND: 'LivAround',
};

const STATUS_CLS: Record<string, string> = {
  CONFIRMED:    'bg-blue-500/10 text-blue-400 border-blue-500/30',
  CHECKED_IN:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  CHECKED_OUT:  'bg-slate-500/10 text-slate-400 border-slate-500/30',
  CANCELLED:    'bg-red-500/10 text-red-400 border-red-500/30',
};

const DOC_LABEL: Record<string, string> = {
  PASSPORT: '🛂 Passport',
  NATIONAL_ID: '🪪 National ID',
  DRIVERS_LICENSE: '🚗 Driver\'s Licence',
  OTHER: '📄 Other',
};

// ─── Detail Modal ─────────────────────────────────────────────

function GuestDetailModal({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const [detail, setDetail] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgOpen, setImgOpen] = useState<string | null>(null);

  useEffect(() => {
    api.bookings.get(booking.id)
      .then(setDetail)
      .finally(() => setLoading(false));
  }, [booking.id]);

  const n = nights(booking.checkIn, booking.checkOut);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-slate-100">{booking.guestName}</h2>
            <p className="text-slate-400 text-sm mt-0.5">
              {booking.property?.name} · {fmtDate(booking.checkIn)} → {fmtDate(booking.checkOut)} ({n} night{n !== 1 ? 's' : ''})
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 ml-4">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-6">

          {/* Guest details */}
          <section>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Guest Details</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Email', value: booking.guestEmail || '—' },
                { label: 'Phone', value: booking.guestPhone || '—' },
                { label: 'Guests', value: String(booking.guestCount) },
                { label: 'Source', value: SOURCE_LABEL[booking.source] ?? booking.source },
                { label: 'Total', value: `${booking.currency} ${booking.totalAmount.toLocaleString()}` },
                { label: 'Status', value: booking.status.replace('_', ' ') },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-800 rounded-xl px-4 py-3">
                  <p className="text-slate-500 text-xs mb-0.5">{label}</p>
                  <p className="text-slate-100 text-sm font-semibold">{value}</p>
                </div>
              ))}
            </div>
            {booking.notes && (
              <div className="mt-3 bg-slate-800 rounded-xl px-4 py-3">
                <p className="text-slate-500 text-xs mb-0.5">Notes</p>
                <p className="text-slate-300 text-sm">{booking.notes}</p>
              </div>
            )}
          </section>

          {/* ID Documents */}
          <section>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Identity Documents
              {detail?.guestIds && (
                <span className="ml-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs px-2 py-0.5 rounded-full font-bold">
                  {detail.guestIds.length} uploaded
                </span>
              )}
            </h3>
            {loading ? (
              <div className="flex justify-center py-6">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : !detail?.guestIds?.length ? (
              <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-6 text-center">
                <p className="text-slate-500 text-sm">No IDs uploaded yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {detail.guestIds.map((doc: GuestID) => (
                  <div key={doc.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center gap-4">
                    {/* Thumbnail */}
                    <button
                      onClick={() => setImgOpen(doc.documentUrl)}
                      className="w-16 h-16 rounded-lg overflow-hidden bg-slate-700 flex-shrink-0 hover:ring-2 hover:ring-blue-500 transition-all"
                    >
                      <img
                        src={doc.documentUrl}
                        alt={doc.documentType}
                        className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-100 font-semibold text-sm">{doc.guestName}</p>
                      <p className="text-slate-400 text-xs mt-0.5">{DOC_LABEL[doc.documentType] ?? doc.documentType}</p>
                      <p className="text-slate-600 text-xs mt-1">Uploaded {fmtDate(doc.createdAt)}</p>
                    </div>
                    <a
                      href={doc.documentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-400 hover:text-blue-300 text-xs font-semibold flex-shrink-0"
                    >
                      View full ↗
                    </a>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Visitors */}
          {detail?.visitors && detail.visitors.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Visitors
                <span className="ml-2 bg-slate-700 text-slate-400 text-xs px-2 py-0.5 rounded-full font-bold">
                  {detail.visitors.length}
                </span>
              </h3>
              <div className="space-y-2">
                {detail.visitors.map((v: GuestVisitor) => (
                  <div key={v.id} className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-slate-100 font-semibold text-sm">{v.visitorName}</p>
                      {v.purpose && <p className="text-slate-400 text-xs mt-0.5">{v.purpose}</p>}
                      {(v.expectedDate || v.expectedTime) && (
                        <p className="text-slate-500 text-xs mt-0.5">
                          📅 {[v.expectedDate, v.expectedTime].filter(Boolean).join(' at ')}
                        </p>
                      )}
                      {v.notes && <p className="text-slate-500 text-xs mt-0.5 italic">{v.notes}</p>}
                    </div>
                    {v.idUrl && (
                      <a href={v.idUrl} target="_blank" rel="noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-xs font-semibold flex-shrink-0">
                        ID ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Full-screen image lightbox */}
      {imgOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/90" onClick={() => setImgOpen(null)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white"><X size={28} /></button>
          <img src={imgOpen} alt="ID document" className="max-w-full max-h-full rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export default function GuestsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Booking | null>(null);

  useEffect(() => {
    api.bookings.list()
      .then(setBookings)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return bookings.filter(b => {
      const matchSearch = !q
        || b.guestName.toLowerCase().includes(q)
        || (b.guestEmail ?? '').toLowerCase().includes(q)
        || (b.guestPhone ?? '').includes(q)
        || (b.property?.name ?? '').toLowerCase().includes(q);
      const matchStatus = !statusFilter || b.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [bookings, search, statusFilter]);

  const totalIds = bookings.reduce((s, b) => s + (b._count?.guestIds ?? 0), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center">
            <UserCheck size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Guest History</h1>
            <p className="text-slate-500 text-sm">{bookings.length} bookings · {totalIds} ID{totalIds !== 1 ? 's' : ''} on file</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name, email, phone or property…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="">All statuses</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="CHECKED_IN">Checked In</option>
            <option value="CHECKED_OUT">Checked Out</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-24">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 text-slate-500">
          <UserCheck size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-semibold">No guests found</p>
          {search && <p className="text-sm mt-1">Try a different search term</p>}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                {['Guest', 'Property', 'Stay', 'Nights', 'IDs', 'Visitors', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.map(b => {
                const n = nights(b.checkIn, b.checkOut);
                const idCount = b._count?.guestIds ?? 0;
                const visitorCount = b._count?.visitors ?? 0;
                return (
                  <tr key={b.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-100">{b.guestName}</p>
                      {b.guestEmail && <p className="text-slate-500 text-xs">{b.guestEmail}</p>}
                      {b.guestPhone && <p className="text-slate-500 text-xs">📱 {b.guestPhone}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{b.property?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-xs">
                      <div>{fmtDate(b.checkIn)}</div>
                      <div className="text-slate-600">→ {fmtDate(b.checkOut)}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-center">{n}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${
                        idCount >= b.guestCount
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : idCount > 0
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-slate-700/50 text-slate-500 border-slate-600'
                      }`}>
                        🪪 {idCount}/{b.guestCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {visitorCount > 0
                        ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 border border-slate-600">👥 {visitorCount}</span>
                        : <span className="text-slate-600 text-xs">—</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${STATUS_CLS[b.status] ?? ''}`}>
                        {b.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelected(b)}
                        className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-semibold"
                      >
                        <Eye size={14} /> View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && <GuestDetailModal booking={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
