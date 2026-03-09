'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Wifi, Lock, MapPin, Phone, Home, BookOpen, HelpCircle, Key,
  ChevronDown, ChevronRight, Copy, Check, ExternalLink, Bed, Bath, Users,
  AlertTriangle, X, Camera,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://livaroundbackend-production.up.railway.app';

// ── Types ─────────────────────────────────────────────────────────────────────

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
    host: { name: string; phone?: string };
  };
  guide: {
    areas: {
      id: string; name: string; floor?: string; description?: string;
      docs: { id: string; title: string; description: string; category: string; photos: string[]; tags: string[] }[];
    }[];
    ungroupedDocs: { id: string; title: string; description: string; category: string; photos: string[]; tags: string[] }[];
    contacts: { id: string; agency: string; name?: string; phones: string[]; company?: string; notes?: string }[];
  };
}

type Tab = 'stay' | 'access' | 'guide' | 'help';

const CATEGORY_EMOJI: Record<string, string> = {
  STORAGE: '🗄️', APPLIANCE: '🔌', ELECTRICAL: '⚡', UTILITY: '🔧',
  ACCESS: '🚪', SAFETY: '🧯', PROCEDURE: '📋', OTHER: '📌',
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

// ── Tab: Stay ─────────────────────────────────────────────────────────────────

function StayTab({ data }: { data: StayData }) {
  const { booking, property } = data;
  const nights = nightsBetween(booking.checkIn, booking.checkOut);
  const [showRules, setShowRules] = useState(false);

  return (
    <div className="space-y-5 pb-24">
      {/* Greeting */}
      <div className="px-5 pt-5">
        <p className="text-slate-500 text-sm">Welcome,</p>
        <h2 className="text-2xl font-bold text-slate-900">{booking.guestName.split(' ')[0]} 👋</h2>
        <p className="text-slate-500 text-sm mt-1">We're so glad to have you at {property.name}</p>
      </div>

      {/* Booking card */}
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

      {/* Quick actions */}
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

      {/* Property description */}
      {property.description && (
        <div className="mx-5 bg-slate-50 rounded-xl p-4">
          <p className="text-sm text-slate-600 leading-relaxed">{property.description}</p>
        </div>
      )}

      {/* Amenities */}
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

      {/* House rules preview */}
      {property.houseRules.length > 0 && (
        <div className="mx-5 bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowRules(!showRules)}
            className="w-full flex items-center justify-between p-4"
          >
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

      {/* Lock code */}
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

      {/* WiFi */}
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

      {/* Address */}
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
          <a
            href={property.mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center gap-1.5 text-sm font-medium text-green-600 hover:text-green-700"
          >
            <ExternalLink size={13} /> Open in Google Maps
          </a>
        )}
      </div>

      {/* Check-in instructions */}
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

      {/* Areas */}
      {areas.map((area) => (
        <div key={area.id} className="border-b border-slate-100">
          <button
            onClick={() => setOpenArea(openArea === area.id ? null : area.id)}
            className="w-full flex items-center justify-between px-5 py-4"
          >
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

      {/* Ungrouped docs */}
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
                <img
                  key={i}
                  src={url}
                  alt={doc.title}
                  onClick={() => setLightbox(url)}
                  className="w-28 h-20 object-cover rounded-xl flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                />
              ))}
            </div>
          )}
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button className="absolute top-4 right-4 text-white/70 hover:text-white">
            <X size={24} />
          </button>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-xl object-contain" />
        </div>
      )}
    </>
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
      <h2 className="text-lg font-bold text-slate-900">Help & Contacts</h2>

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
            <a href={`tel:${property.host.phone}`} className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-xl">
              <Phone size={14} /> Call
            </a>
          )}
        </div>
      </div>

      {/* Vendor contacts */}
      {guide.contacts.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Emergency & Services</p>
          <div className="space-y-3">
            {guide.contacts.map((c) => (
              <div key={c.id} className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800">{c.agency}</p>
                  {c.name && <p className="text-xs text-slate-500">{c.name}{c.company ? ` · ${c.company}` : ''}</p>}
                </div>
                <div className="flex flex-col gap-1 items-end">
                  {c.phones.map((phone, i) => (
                    <a key={i} href={`tel:${phone.replace(/\s/g, '')}`} className="text-xs text-indigo-600 flex items-center gap-1">
                      <Phone size={10} /> {phone}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
          <button
            onClick={() => setShowIssueForm(true)}
            className="flex items-center gap-2 w-full py-3 px-4 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl text-red-700 text-sm font-medium transition-colors"
          >
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
              <button
                onClick={() => setShowIssueForm(false)}
                className="flex-1 py-2.5 text-sm text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={submitIssue}
                disabled={submitting || !issueDesc.trim()}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50"
              >
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
    { id: 'stay', label: 'Stay', icon: <Home size={18} /> },
    { id: 'access', label: 'Access', icon: <Key size={18} /> },
    { id: 'guide', label: 'Guide', icon: <BookOpen size={18} /> },
    { id: 'help', label: 'Help', icon: <HelpCircle size={18} /> },
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
        {tab === 'stay'   && <StayTab data={data} />}
        {tab === 'access' && <AccessTab data={data} />}
        {tab === 'guide'  && <GuideTab data={data} />}
        {tab === 'help'   && <HelpTab data={data} guestCode={code} />}
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-slate-200 flex z-40 pb-safe">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-xs font-medium transition-colors ${
              tab === t.id ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
