'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Wifi, Lock, MapPin, Phone, Home, BookOpen, HelpCircle, Key,
  ChevronDown, ChevronRight, Copy, Check, ExternalLink, Bed, Bath, Users,
  AlertTriangle, X, ConciergeBell, Sparkles, ChefHat, Car, ShoppingBag,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://livaroundbackend-production.up.railway.app';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ServiceRequest {
  id: string;
  type: string;
  requestedDate?: string;
  requestedTime?: string;
  notes?: string;
  status: 'PENDING' | 'CONFIRMED' | 'DECLINED';
  createdAt: string;
}

interface StayData {
  booking: {
    guestName: string;
    checkIn: string;
    checkOut: string;
    guestCount: number;
    lockCode: string | null;
    status: string;
  };
  property: {
    name: string;
    address: string;
    city: string;
    country: string;
    description?: string;
    type: string;
    bedrooms: number;
    bathrooms: number;
    maxGuests: number;
    amenities: string[];
    images: string[];
    wifiName?: string;
    wifiPassword?: string;
    mapUrl?: string;
    checkInInstructions?: string;
    houseRules: string[];
    caretakerType: 'FULL_TIME' | 'PART_TIME';
    host: { name: string; phone?: string };
  };
  guide: {
    areas: {
      id: string; name: string; floor?: string; description?: string;
      docs: { id: string; title: string; description: string; category: string; photos: string[]; tags: string[] }[];
    }[];
    ungroupedDocs: { id: string; title: string; description: string; category: string; photos: string[]; tags: string[] }[];
    emergencyServices: { name: string; number: string; icon: string }[];
  };
  serviceRequests: ServiceRequest[];
}

type Tab = 'stay' | 'access' | 'guide' | 'services' | 'help';

const CATEGORY_EMOJI: Record<string, string> = {
  STORAGE: '🗄️', APPLIANCE: '🔌', ELECTRICAL: '⚡', UTILITY: '🔧',
  ACCESS: '🚪', SAFETY: '🧯', PROCEDURE: '📋', OTHER: '📌',
};

const SERVICE_LABELS: Record<string, string> = {
  HOUSEKEEPING: 'Housekeeping',
  COOK: 'Cook / Meal service',
  DRIVER: 'Driver',
  CAR_RENTAL: 'Car rental',
  ARRIVAL_TIME: 'Arrival time',
  DEPARTURE_TIME: 'Departure time',
  OTHER: 'Other request',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors font-medium"
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copied' : (label || 'Copy')}
    </button>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function nightsBetween(checkIn: string, checkOut: string) {
  return Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000);
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function datesBetween(checkIn: string, checkOut: string): string[] {
  const dates: string[] = [];
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const cur = new Date(start);
  while (cur < end) {
    dates.push(isoDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function statusPill(status: string) {
  const map: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-700',
    CONFIRMED: 'bg-green-100 text-green-700',
    DECLINED: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? 'bg-slate-100 text-slate-500'}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

// ── Tab: Stay ─────────────────────────────────────────────────────────────────

function StayTab({ data }: { data: StayData }) {
  const { booking, property } = data;
  const nights = nightsBetween(booking.checkIn, booking.checkOut);
  const [showRules, setShowRules] = useState(false);

  return (
    <div className="space-y-5 pb-24">
      <div className="px-5 pt-5">
        <p className="text-slate-500 text-sm">Welcome,</p>
        <h2 className="text-2xl font-bold text-slate-900">{booking.guestName.split(' ')[0]} 👋</h2>
        <p className="text-slate-500 text-sm mt-1">We're so glad to have you at {property.name}</p>
      </div>

      <div className="mx-5 bg-indigo-600 rounded-2xl p-4 text-white">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs opacity-70 mb-0.5">Check-in</p>
            <p className="font-semibold text-sm">{formatDate(booking.checkIn)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs opacity-70">{nights} nights</p>
            <div className="w-16 h-px bg-white/30 mt-1.5" />
          </div>
          <div className="text-right">
            <p className="text-xs opacity-70 mb-0.5">Check-out</p>
            <p className="font-semibold text-sm">{formatDate(booking.checkOut)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/20 text-xs opacity-80">
          <span className="flex items-center gap-1"><Users size={11} /> {booking.guestCount} guests</span>
          <span>·</span>
          <span className="flex items-center gap-1"><Bed size={11} /> {property.bedrooms} beds</span>
          <span>·</span>
          <span className="flex items-center gap-1"><Bath size={11} /> {property.bathrooms} baths</span>
        </div>
      </div>

      <div className="px-5 grid grid-cols-2 gap-3">
        {property.mapUrl && (
          <a href={property.mapUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2.5 p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <MapPin size={16} className="text-green-600" />
            </div>
            <div><p className="text-sm font-medium text-slate-800">Get directions</p><p className="text-xs text-slate-400">Open Maps</p></div>
          </a>
        )}
        {property.host.phone && (
          <a href={`tel:${property.host.phone}`}
            className="flex items-center gap-2.5 p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Phone size={16} className="text-blue-600" />
            </div>
            <div><p className="text-sm font-medium text-slate-800">Call host</p><p className="text-xs text-slate-400">{property.host.name}</p></div>
          </a>
        )}
        {booking.lockCode && (
          <div className="flex items-center gap-2.5 p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Lock size={16} className="text-amber-600" />
            </div>
            <div className="min-w-0"><p className="text-sm font-medium text-slate-800">Lock code</p><p className="text-xs font-mono text-slate-600 truncate">{booking.lockCode}</p></div>
          </div>
        )}
        {property.wifiName && (
          <div className="flex items-center gap-2.5 p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Wifi size={16} className="text-purple-600" />
            </div>
            <div className="min-w-0"><p className="text-sm font-medium text-slate-800">WiFi</p><p className="text-xs text-slate-400 truncate">{property.wifiName}</p></div>
          </div>
        )}
      </div>

      {property.description && (
        <div className="mx-5 bg-slate-50 rounded-xl p-4">
          <p className="text-sm text-slate-600 leading-relaxed">{property.description}</p>
        </div>
      )}

      {property.amenities.length > 0 && (
        <div className="px-5">
          <p className="text-sm font-semibold text-slate-700 mb-2">What's included</p>
          <div className="flex flex-wrap gap-2">
            {property.amenities.map((a) => (
              <span key={a} className="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs text-slate-600">{a}</span>
            ))}
          </div>
        </div>
      )}

      {property.houseRules.length > 0 && (
        <div className="mx-5 bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
          <button onClick={() => setShowRules(!showRules)} className="w-full flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <span className="text-base">📋</span>
              <span className="text-sm font-semibold text-amber-800">House Rules</span>
              <span className="text-xs text-amber-600 bg-amber-100 rounded-full px-2 py-0.5">{property.houseRules.length}</span>
            </div>
            {showRules ? <ChevronDown size={16} className="text-amber-600" /> : <ChevronRight size={16} className="text-amber-600" />}
          </button>
          {showRules && (
            <div className="px-4 pb-4 space-y-2">
              {property.houseRules.map((rule, i) => (
                <div key={i} className="flex gap-2.5 text-sm text-amber-900">
                  <span className="flex-shrink-0 w-5 h-5 bg-amber-200 text-amber-700 rounded-full flex items-center justify-center text-xs font-bold">{i + 1}</span>
                  <span className="leading-relaxed">{rule}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab: Access ───────────────────────────────────────────────────────────────

function AccessTab({ data }: { data: StayData }) {
  const { booking, property } = data;

  return (
    <div className="space-y-4 px-5 pt-5 pb-24">
      <h2 className="text-lg font-bold text-slate-900">Check-in & Access</h2>

      {booking.lockCode && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
              <Lock size={15} className="text-amber-600" />
            </div>
            <p className="font-semibold text-slate-800">Lock Code</p>
          </div>
          <div className="flex items-center justify-between bg-amber-50 rounded-xl px-4 py-3">
            <p className="text-2xl font-mono font-bold text-amber-700 tracking-widest">{booking.lockCode}</p>
            <CopyButton value={booking.lockCode} />
          </div>
          <p className="text-xs text-slate-400 mt-2">Use this code to unlock the main door.</p>
        </div>
      )}

      {(property.wifiName || property.wifiPassword) && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
              <Wifi size={15} className="text-purple-600" />
            </div>
            <p className="font-semibold text-slate-800">WiFi</p>
          </div>
          {property.wifiName && (
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <div>
                <p className="text-xs text-slate-400">Network</p>
                <p className="text-sm font-medium text-slate-800">{property.wifiName}</p>
              </div>
              <CopyButton value={property.wifiName} label="Copy" />
            </div>
          )}
          {property.wifiPassword && (
            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="text-xs text-slate-400">Password</p>
                <p className="text-sm font-medium text-slate-800 font-mono">{property.wifiPassword}</p>
              </div>
              <CopyButton value={property.wifiPassword} label="Copy" />
            </div>
          )}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
            <MapPin size={15} className="text-green-600" />
          </div>
          <p className="font-semibold text-slate-800">Address</p>
        </div>
        <p className="text-sm text-slate-700 leading-relaxed">{property.address}</p>
        <p className="text-sm text-slate-500">{property.city}, {property.country}</p>
        {property.mapUrl && (
          <a href={property.mapUrl} target="_blank" rel="noopener noreferrer"
            className="mt-3 flex items-center gap-1.5 text-sm font-medium text-green-600 hover:text-green-700">
            <ExternalLink size={13} /> Open in Google Maps
          </a>
        )}
      </div>

      {property.checkInInstructions && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Key size={15} className="text-blue-600" />
            </div>
            <p className="font-semibold text-slate-800">Check-in Instructions</p>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{property.checkInInstructions}</p>
        </div>
      )}
    </div>
  );
}

// ── Tab: Guide ────────────────────────────────────────────────────────────────

function GuideTab({ data }: { data: StayData }) {
  const allDocs = data.guide.ungroupedDocs;
  const areas = data.guide.areas;
  const [openArea, setOpenArea] = useState<string | null>(null);
  const [openDoc, setOpenDoc] = useState<string | null>(null);
  const hasContent = areas.length > 0 || allDocs.length > 0;

  return (
    <div className="pb-24 pt-5">
      <div className="px-5 mb-4">
        <h2 className="text-lg font-bold text-slate-900">Property Guide</h2>
        <p className="text-sm text-slate-500">Everything you need to know about the villa</p>
      </div>

      {!hasContent && (
        <div className="mx-5 flex flex-col items-center justify-center py-16 gap-2 bg-slate-50 rounded-2xl">
          <BookOpen size={32} className="text-slate-300" />
          <p className="text-slate-400 text-sm">No guide yet</p>
        </div>
      )}

      {areas.map((area) => (
        <div key={area.id} className="border-b border-slate-100">
          <button onClick={() => setOpenArea(openArea === area.id ? null : area.id)}
            className="w-full flex items-center justify-between px-5 py-4">
            <div className="text-left">
              <p className="font-medium text-slate-800">{area.name}</p>
              {area.floor && <p className="text-xs text-slate-400">{area.floor}</p>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{area.docs.length} items</span>
              {openArea === area.id ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />}
            </div>
          </button>
          {openArea === area.id && (
            <div className="pb-2">
              {area.docs.map((doc) => (
                <DocItem key={doc.id} doc={doc} open={openDoc === doc.id} onToggle={() => setOpenDoc(openDoc === doc.id ? null : doc.id)} />
              ))}
            </div>
          )}
        </div>
      ))}

      {allDocs.map((doc) => (
        <div key={doc.id} className="border-b border-slate-100">
          <DocItem doc={doc} open={openDoc === doc.id} onToggle={() => setOpenDoc(openDoc === doc.id ? null : doc.id)} />
        </div>
      ))}
    </div>
  );
}

function DocItem({ doc, open, onToggle }: {
  doc: { id: string; title: string; description: string; category: string; photos: string[] };
  open: boolean;
  onToggle: () => void;
}) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  return (
    <>
      <button onClick={onToggle} className="w-full flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="text-lg">{CATEGORY_EMOJI[doc.category] || '📌'}</span>
          <p className="text-sm font-medium text-slate-700 text-left">{doc.title}</p>
        </div>
        {open ? <ChevronDown size={14} className="text-slate-400 flex-shrink-0" /> : <ChevronRight size={14} className="text-slate-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-4 pl-14">
          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{doc.description}</p>
          {doc.photos.length > 0 && (
            <div className="flex gap-2 mt-3 overflow-x-auto">
              {doc.photos.map((url, i) => (
                <img key={i} src={url} alt={doc.title} onClick={() => setLightbox(url)}
                  className="w-28 h-20 object-cover rounded-xl flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity" />
              ))}
            </div>
          )}
        </div>
      )}
      {lightbox && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white"><X size={24} /></button>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-xl object-contain" />
        </div>
      )}
    </>
  );
}

// ── Tab: Services ─────────────────────────────────────────────────────────────

function ServicesTab({ data, guestCode, onRequestsUpdate }: {
  data: StayData;
  guestCode: string;
  onRequestsUpdate: (reqs: ServiceRequest[]) => void;
}) {
  const { booking, property } = data;
  const [requests, setRequests] = useState<ServiceRequest[]>(data.serviceRequests);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Arrival / departure time
  const [arrivalTime, setArrivalTime] = useState('');
  const [departureTime, setDepartureTime] = useState('');

  // Housekeeping
  const [hkDate, setHkDate] = useState('');
  const [hkTime, setHkTime] = useState('10:00');

  // Other services
  const [activeService, setActiveService] = useState<string | null>(null);
  const [serviceNote, setServiceNote] = useState('');
  const [serviceDate, setServiceDate] = useState('');

  const stayDates = datesBetween(booking.checkIn, booking.checkOut);

  // Time slots 9am–5pm in 1-hour increments
  const timeSlots = Array.from({ length: 9 }, (_, i) => {
    const h = 9 + i;
    return { value: `${String(h).padStart(2, '0')}:00`, label: `${h > 12 ? h - 12 : h}:00 ${h >= 12 ? 'pm' : 'am'}` };
  });

  async function submit(type: string, extra: Record<string, string> = {}) {
    setSubmitting(type);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_URL}/api/stay/${guestCode}/service-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...extra }),
      });
      if (res.status === 409) { setError('Housekeeping already requested for that date.'); return; }
      if (!res.ok) { const b = await res.json().catch(() => ({})); setError(b.error || 'Failed to submit'); return; }
      // Refresh list
      const stayRes = await fetch(`${API_URL}/api/stay/${guestCode}`);
      const stayData = await stayRes.json();
      setRequests(stayData.serviceRequests);
      onRequestsUpdate(stayData.serviceRequests);
      setSuccess('Request sent — your host will confirm shortly.');
      setActiveService(null);
      setServiceNote('');
      setTimeout(() => setSuccess(''), 4000);
    } finally {
      setSubmitting(null);
    }
  }

  const hasArrivalReq = requests.some((r) => r.type === 'ARRIVAL_TIME');
  const hasDepartureReq = requests.some((r) => r.type === 'DEPARTURE_TIME');

  const bookedHkDates = new Set(
    requests.filter((r) => r.type === 'HOUSEKEEPING').map((r) => r.requestedDate)
  );

  return (
    <div className="space-y-5 px-5 pt-5 pb-24">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Services & Requests</h2>
        <p className="text-sm text-slate-500 mt-0.5">Let your host know how they can help</p>
      </div>

      {error && <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5"><AlertTriangle size={14} /> {error}</div>}
      {success && <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5"><Check size={14} /> {success}</div>}

      {/* ── Arrival / Departure times ───────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Your arrival & departure</p>
        <p className="text-xs text-slate-500">Let your host know when to expect you so they can be prepared.</p>

        {!hasArrivalReq ? (
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-600">Estimated arrival time</label>
            <div className="flex gap-2">
              <input
                type="time"
                value={arrivalTime}
                onChange={(e) => setArrivalTime(e.target.value)}
                className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-400"
              />
              <button
                disabled={!arrivalTime || submitting === 'ARRIVAL_TIME'}
                onClick={() => submit('ARRIVAL_TIME', { requestedTime: arrivalTime, requestedDate: isoDate(new Date(booking.checkIn)), notes: `Estimated arrival: ${arrivalTime}` })}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-40"
              >
                {submitting === 'ARRIVAL_TIME' ? '...' : 'Notify'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-xl px-3 py-2">
            <Check size={13} /> Arrival time shared with host
          </div>
        )}

        {!hasDepartureReq ? (
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-600">Estimated departure time</label>
            <div className="flex gap-2">
              <input
                type="time"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-400"
              />
              <button
                disabled={!departureTime || submitting === 'DEPARTURE_TIME'}
                onClick={() => submit('DEPARTURE_TIME', { requestedTime: departureTime, requestedDate: isoDate(new Date(booking.checkOut)), notes: `Estimated departure: ${departureTime}` })}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-40"
              >
                {submitting === 'DEPARTURE_TIME' ? '...' : 'Notify'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-xl px-3 py-2">
            <Check size={13} /> Departure time shared with host
          </div>
        )}
      </div>

      {/* ── Housekeeping ─────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 bg-sky-100 rounded-full flex items-center justify-center flex-shrink-0">
            <Sparkles size={15} className="text-sky-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">Housekeeping</p>
            <p className="text-xs text-slate-400">Once per day · 9 am – 5 pm</p>
          </div>
        </div>

        {property.caretakerType === 'FULL_TIME' && (
          <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2 mb-3 mt-2">
            Full-time caretaker on-site — housekeeping is available any time within 9 am–5 pm.
          </p>
        )}

        <div className="space-y-2 mt-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Date</label>
              <select
                value={hkDate}
                onChange={(e) => setHkDate(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-400"
              >
                <option value="">Select date</option>
                {stayDates.map((d) => (
                  <option key={d} value={d} disabled={bookedHkDates.has(d)}>
                    {new Date(d + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {bookedHkDates.has(d) ? ' ✓' : ''}
                  </option>
                ))}
              </select>
            </div>
            {property.caretakerType === 'PART_TIME' && (
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Preferred time</label>
                <select
                  value={hkTime}
                  onChange={(e) => setHkTime(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-400"
                >
                  {timeSlots.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <button
            disabled={!hkDate || !!submitting}
            onClick={() => submit('HOUSEKEEPING', { requestedDate: hkDate, requestedTime: hkTime })}
            className="w-full py-2.5 text-sm font-medium text-white bg-sky-600 rounded-xl hover:bg-sky-700 disabled:opacity-40"
          >
            {submitting === 'HOUSEKEEPING' ? 'Requesting...' : 'Request housekeeping'}
          </button>
        </div>
      </div>

      {/* ── Additional services ──────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Additional services</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { type: 'COOK', icon: <ChefHat size={20} />, label: 'Cook', color: 'bg-orange-100 text-orange-600' },
            { type: 'DRIVER', icon: <Car size={20} />, label: 'Driver', color: 'bg-blue-100 text-blue-600' },
            { type: 'CAR_RENTAL', icon: <ShoppingBag size={20} />, label: 'Car rental', color: 'bg-violet-100 text-violet-600' },
          ].map((s) => (
            <button
              key={s.type}
              onClick={() => setActiveService(activeService === s.type ? null : s.type)}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-colors ${
                activeService === s.type ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${s.color}`}>{s.icon}</div>
              <p className="text-xs font-medium text-slate-700">{s.label}</p>
            </button>
          ))}
        </div>

        {activeService && activeService !== 'HOUSEKEEPING' && (
          <div className="mt-3 space-y-2">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Preferred date</label>
              <select
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-400"
              >
                <option value="">Select date</option>
                {stayDates.map((d) => (
                  <option key={d} value={d}>
                    {new Date(d + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              value={serviceNote}
              onChange={(e) => setServiceNote(e.target.value)}
              placeholder={`Any details for ${SERVICE_LABELS[activeService]}...`}
              rows={2}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-400 resize-none"
            />
            <div className="flex gap-2">
              <button onClick={() => { setActiveService(null); setServiceNote(''); setServiceDate(''); }}
                className="flex-1 py-2.5 text-sm text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50">Cancel</button>
              <button
                disabled={!!submitting}
                onClick={() => submit(activeService, { notes: serviceNote, ...(serviceDate ? { requestedDate: serviceDate } : {}) })}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-40"
              >
                {submitting === activeService ? 'Sending...' : 'Request'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Past requests ────────────────────────────────────────── */}
      {requests.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Your requests</p>
          <div className="space-y-2">
            {requests.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-700">{SERVICE_LABELS[r.type] ?? r.type}</p>
                  {r.requestedDate && (
                    <p className="text-xs text-slate-400">
                      {new Date(r.requestedDate + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      {r.requestedTime && ` · ${r.requestedTime}`}
                    </p>
                  )}
                  {r.notes && <p className="text-xs text-slate-400 truncate max-w-48">{r.notes}</p>}
                </div>
                {statusPill(r.status)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Help ─────────────────────────────────────────────────────────────────

function HelpTab({ data, guestCode }: { data: StayData; guestCode: string }) {
  const { property, guide } = data;
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueDesc, setIssueDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submitIssue() {
    if (!issueDesc.trim()) return;
    setSubmitting(true);
    try {
      await fetch(`${API_URL}/api/stay/${guestCode}/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: issueDesc }),
      });
      setSubmitted(true);
      setShowIssueForm(false);
      setIssueDesc('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 px-5 pt-5 pb-24">
      <h2 className="text-lg font-bold text-slate-900">Help</h2>

      {/* Host */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Your Host</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
              {property.host.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-slate-800">{property.host.name}</p>
              <p className="text-xs text-slate-400">Property host</p>
            </div>
          </div>
          {property.host.phone && (
            <a href={`tel:${property.host.phone}`}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-xl">
              <Phone size={14} /> Call
            </a>
          )}
        </div>
      </div>

      {/* Emergency services */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Emergency Services</p>
        <div className="space-y-2">
          {guide.emergencyServices.map((s) => (
            <a key={s.name} href={`tel:${s.number}`}
              className="flex items-center justify-between py-2.5 px-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">{s.icon}</span>
                <span className="text-sm font-medium text-slate-800">{s.name}</span>
              </div>
              <span className="text-sm font-bold text-red-600 font-mono">{s.number}</span>
            </a>
          ))}
        </div>
      </div>

      {/* House rules */}
      {property.houseRules.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">House Rules</p>
          <div className="space-y-3">
            {property.houseRules.map((rule, i) => (
              <div key={i} className="flex gap-2.5 text-sm text-slate-600">
                <span className="flex-shrink-0 w-5 h-5 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center text-xs font-semibold">{i + 1}</span>
                <span className="leading-relaxed">{rule}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Report issue */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Something wrong?</p>
        {submitted && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-xl px-3 py-2 mb-3">
            <Check size={14} /> Issue reported — your host will be notified.
          </div>
        )}
        {!showIssueForm ? (
          <button onClick={() => setShowIssueForm(true)}
            className="flex items-center gap-2 w-full py-3 px-4 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl text-red-700 text-sm font-medium transition-colors">
            <AlertTriangle size={15} /> Report an issue
          </button>
        ) : (
          <div className="space-y-3">
            <textarea
              value={issueDesc}
              onChange={(e) => setIssueDesc(e.target.value)}
              placeholder="Describe the issue (e.g. AC not working, tap leaking...)"
              rows={3}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-400 resize-none"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowIssueForm(false)}
                className="flex-1 py-2.5 text-sm text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50">Cancel</button>
              <button onClick={submitIssue} disabled={submitting || !issueDesc.trim()}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50">
                {submitting ? 'Sending...' : 'Send report'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function StayPage() {
  const { code } = useParams<{ code: string }>();
  const [data, setData] = useState<StayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<Tab>('stay');

  useEffect(() => {
    fetch(`${API_URL}/api/stay/${code}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then((d) => { if (d) setData(d); })
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center gap-4">
        <div className="text-5xl">🏚️</div>
        <h1 className="text-xl font-bold text-slate-800">Stay not found</h1>
        <p className="text-slate-500 text-sm">This link may have expired or the URL is incorrect. Please contact your host.</p>
      </div>
    );
  }

  const { booking, property } = data;
  const nights = nightsBetween(booking.checkIn, booking.checkOut);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'stay',     label: 'Stay',     icon: <Home size={18} /> },
    { id: 'access',   label: 'Access',   icon: <Key size={18} /> },
    { id: 'guide',    label: 'Guide',    icon: <BookOpen size={18} /> },
    { id: 'services', label: 'Services', icon: <ConciergeBell size={18} /> },
    { id: 'help',     label: 'Help',     icon: <HelpCircle size={18} /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 max-w-md mx-auto relative">
      {/* Hero header */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 px-5 pt-10 pb-6 text-white">
        <div className="flex items-center gap-1.5 text-xs opacity-60 mb-2 uppercase tracking-wider">
          <span>LivAround</span>
        </div>
        <h1 className="text-2xl font-bold leading-tight">{property.name}</h1>
        <div className="flex items-center gap-1 text-sm opacity-75 mt-1">
          <MapPin size={12} /> {property.city}, {property.country}
        </div>
        <div className="mt-4 bg-white/10 backdrop-blur rounded-xl px-4 py-3 flex items-center justify-between text-sm">
          <div>
            <p className="text-xs opacity-60">Check-in</p>
            <p className="font-semibold">{new Date(booking.checkIn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
          </div>
          <div className="text-center opacity-60 text-xs">{nights}n</div>
          <div className="text-right">
            <p className="text-xs opacity-60">Check-out</p>
            <p className="font-semibold">{new Date(booking.checkOut).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="overflow-y-auto">
        {tab === 'stay'     && <StayTab data={data} />}
        {tab === 'access'   && <AccessTab data={data} />}
        {tab === 'guide'    && <GuideTab data={data} />}
        {tab === 'services' && (
          <ServicesTab
            data={data}
            guestCode={code}
            onRequestsUpdate={(reqs) => setData((d) => d ? { ...d, serviceRequests: reqs } : d)}
          />
        )}
        {tab === 'help'     && <HelpTab data={data} guestCode={code} />}
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-slate-200 flex z-40 pb-safe">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-xs font-medium transition-colors ${
              tab === t.id ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
            }`}>
            {t.icon}
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
