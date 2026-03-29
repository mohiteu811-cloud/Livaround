'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Wifi, Lock, MapPin, Phone, Home, BookOpen, HelpCircle, Key,
  ChevronDown, ChevronRight, Copy, Check, ExternalLink, Bed, Bath, Users,
  AlertTriangle, X, ConciergeBell, Sparkles, ChefHat, Car, ShoppingBag,
  Shield, Upload, UserPlus,
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

interface GuestIDRecord {
  id: string;
  guestName: string;
  documentType: string;
  createdAt: string;
}

interface GuestVisitorRecord {
  id: string;
  visitorName: string;
  purpose?: string;
  expectedDate?: string;
  expectedTime?: string;
  createdAt: string;
}

interface StayData {
  booking: {
    guestName: string;
    checkIn: string;
    checkOut: string;
    guestCount: number;
    idsUploaded: number;
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
  guestIds: GuestIDRecord[];
  visitors: GuestVisitorRecord[];
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
  EARLY_CHECK_IN: 'Early check-in request',
  DEPARTURE_TIME: 'Departure time',
  OTHER: 'Other request',
};

// Standard check-in time is 15:00 (3 PM). Anything before this is "early".
const STANDARD_CHECKIN_HOUR = 15;

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
        {booking.lockCode ? (
          <div className="flex items-center gap-2.5 p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Lock size={16} className="text-amber-600" />
            </div>
            <div className="min-w-0"><p className="text-sm font-medium text-slate-800">Lock code</p><p className="text-xs font-mono text-slate-600 truncate">{booking.lockCode}</p></div>
          </div>
        ) : booking.idsUploaded < booking.guestCount ? (
          <div className="flex items-center gap-2.5 p-3.5 bg-white rounded-xl border border-dashed border-slate-200">
            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Lock size={16} className="text-slate-400" />
            </div>
            <div className="min-w-0"><p className="text-sm font-medium text-slate-500">Lock code</p><p className="text-xs text-slate-400">Upload IDs to unlock</p></div>
          </div>
        ) : null}
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

const DOC_TYPE_LABELS: Record<string, string> = {
  PASSPORT: 'Passport',
  NATIONAL_ID: 'National ID',
  DRIVERS_LICENSE: "Driver's License",
  OTHER: 'Other',
};

function AccessTab({ data, guestCode, onRefresh }: { data: StayData; guestCode: string; onRefresh: () => void }) {
  const { booking, property } = data;
  const allIdsUploaded = booking.idsUploaded >= booking.guestCount;

  // ID upload state
  const [idName, setIdName] = useState('');
  const [idDocType, setIdDocType] = useState('PASSPORT');
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idPreview, setIdPreview] = useState<string | null>(null);
  const [idUploading, setIdUploading] = useState(false);
  const [idError, setIdError] = useState('');
  const idFileRef = useRef<HTMLInputElement>(null);
  const idGalleryRef = useRef<HTMLInputElement>(null);

  function handleIdFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIdFile(file);
    const reader = new FileReader();
    reader.onload = () => setIdPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function uploadId() {
    if (!idName.trim() || !idFile) return;
    setIdUploading(true);
    setIdError('');
    try {
      // Step 1: upload the image file
      const formData = new FormData();
      formData.append('file', idFile);
      const uploadRes = await fetch(`${API_URL}/api/stay/${guestCode}/upload`, { method: 'POST', body: formData });
      if (!uploadRes.ok) {
        const errBody = await uploadRes.json().catch(() => null);
        setIdError(errBody?.error || 'Photo upload failed. Please try again.');
        return;
      }
      const { url: documentUrl } = await uploadRes.json();

      // Step 2: register the ID
      const idRes = await fetch(`${API_URL}/api/stay/${guestCode}/guest-ids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestName: idName.trim(), documentType: idDocType, documentUrl }),
      });
      if (!idRes.ok) { setIdError('Failed to submit ID. Please try again.'); return; }

      // Reset form and refresh data
      setIdName('');
      setIdFile(null);
      setIdPreview(null);
      if (idFileRef.current) idFileRef.current.value = '';
      onRefresh();
    } catch {
      setIdError('Something went wrong. Please try again.');
    } finally {
      setIdUploading(false);
    }
  }

  return (
    <div className="space-y-4 px-5 pt-5 pb-24">
      <h2 className="text-lg font-bold text-slate-900">Check-in & Access</h2>

      {/* ── ID Verification ─────────────────────────────────────────── */}
      <div className={`rounded-2xl p-4 shadow-sm border ${allIdsUploaded ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${allIdsUploaded ? 'bg-green-100' : 'bg-indigo-100'}`}>
            <Shield size={15} className={allIdsUploaded ? 'text-green-600' : 'text-indigo-600'} />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-800">Identity Verification</p>
            <p className="text-xs text-slate-400">{booking.idsUploaded} of {booking.guestCount} {booking.guestCount === 1 ? 'guest' : 'guests'} verified</p>
          </div>
          {allIdsUploaded && <Check size={16} className="text-green-600" />}
        </div>

        {/* Progress dots */}
        <div className="flex gap-1.5 mb-3">
          {Array.from({ length: booking.guestCount }).map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i < booking.idsUploaded ? 'bg-green-500' : 'bg-slate-200'}`} />
          ))}
        </div>

        {/* Uploaded IDs list */}
        {data.guestIds.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {data.guestIds.map((g) => (
              <div key={g.id} className="flex items-center gap-2 text-sm bg-white rounded-xl px-3 py-2 border border-slate-100">
                <Check size={13} className="text-green-500 flex-shrink-0" />
                <span className="font-medium text-slate-700">{g.guestName}</span>
                <span className="text-xs text-slate-400">· {DOC_TYPE_LABELS[g.documentType] ?? g.documentType}</span>
              </div>
            ))}
          </div>
        )}

        {!allIdsUploaded && (
          <>
            <p className="text-xs text-indigo-700 bg-indigo-50 rounded-lg px-3 py-2 mb-3">
              Upload a government-issued ID for each guest to reveal your lock code.
            </p>

            {idError && (
              <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2 mb-2">
                <AlertTriangle size={12} /> {idError}
              </div>
            )}

            <div className="space-y-2.5">
              <input
                type="text"
                value={idName}
                onChange={(e) => setIdName(e.target.value)}
                placeholder="Guest full name"
                className="w-full text-sm text-slate-800 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-400"
              />

              <select
                value={idDocType}
                onChange={(e) => setIdDocType(e.target.value)}
                className="w-full text-sm text-slate-800 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-400"
              >
                <option value="PASSPORT">Passport</option>
                <option value="NATIONAL_ID">National ID</option>
                <option value="DRIVERS_LICENSE">Driver&apos;s License</option>
                <option value="OTHER">Other</option>
              </select>

              <input ref={idFileRef} type="file" accept="image/*" capture="environment" onChange={handleIdFile} className="hidden" />
              <input ref={idGalleryRef} type="file" accept="image/*" onChange={handleIdFile} className="hidden" />
              {idPreview ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={idPreview} alt="ID preview" className="w-full rounded-xl border border-slate-200 object-cover max-h-36" />
                  <button type="button"
                    onClick={() => { setIdFile(null); setIdPreview(null); if (idFileRef.current) idFileRef.current.value = ''; if (idGalleryRef.current) idGalleryRef.current.value = ''; }}
                    className="absolute top-2 right-2 bg-white/90 text-slate-700 rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold shadow">✕</button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => idFileRef.current?.click()}
                    className="py-3 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 text-sm font-medium flex items-center justify-center gap-2 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
                    📷 Take photo
                  </button>
                  <button type="button" onClick={() => idGalleryRef.current?.click()}
                    className="py-3 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 text-sm font-medium flex items-center justify-center gap-2 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
                    <Upload size={15} /> Upload
                  </button>
                </div>
              )}

              <button
                disabled={!idName.trim() || !idFile || idUploading}
                onClick={uploadId}
                className="w-full py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {idUploading ? (
                  <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Uploading…</>
                ) : (
                  <><Shield size={14} /> Submit ID</>
                )}
              </button>
            </div>
          </>
        )}

        {allIdsUploaded && (
          <p className="text-sm text-green-700 font-medium">
            ✓ All guest IDs verified — your lock code is now available below.
          </p>
        )}
      </div>

      {/* ── Lock Code ────────────────────────────────────────────────── */}
      {booking.lockCode ? (
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
      ) : !allIdsUploaded ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
              <Lock size={15} className="text-slate-400" />
            </div>
            <p className="font-semibold text-slate-500">Lock Code</p>
          </div>
          <div className="flex items-center justify-center bg-slate-50 rounded-xl px-4 py-4 border border-dashed border-slate-200">
            <p className="text-sm text-slate-400 text-center">Upload IDs for all guests above to reveal the lock code</p>
          </div>
        </div>
      ) : null}

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

function ServicesTab({ data, guestCode, onRequestsUpdate, onRefresh }: {
  data: StayData;
  guestCode: string;
  onRequestsUpdate: (reqs: ServiceRequest[]) => void;
  onRefresh: () => void;
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
  const [hkTime, setHkTime] = useState('anytime');
  const [availableSlots, setAvailableSlots] = useState<{ value: string; label: string; available: boolean }[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [hasAssignedCleaner, setHasAssignedCleaner] = useState(true);

  // Other services
  const [activeService, setActiveService] = useState<string | null>(null);
  const [serviceNote, setServiceNote] = useState('');
  const [serviceDate, setServiceDate] = useState('');

  // Visitor notification
  const [showVisitorForm, setShowVisitorForm] = useState(false);
  const [visitorName, setVisitorName] = useState('');
  const [visitorPurpose, setVisitorPurpose] = useState('');
  const [visitorDate, setVisitorDate] = useState('');
  const [visitorTime, setVisitorTime] = useState('');
  const [visitorIdFile, setVisitorIdFile] = useState<File | null>(null);
  const [visitorIdPreview, setVisitorIdPreview] = useState<string | null>(null);
  const [visitorSubmitting, setVisitorSubmitting] = useState(false);
  const [visitorError, setVisitorError] = useState('');
  const [visitorSuccess, setVisitorSuccess] = useState(false);
  const visitorIdRef = useRef<HTMLInputElement>(null);
  const visitorIdGalleryRef = useRef<HTMLInputElement>(null);

  function handleVisitorId(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setVisitorIdFile(file);
    const reader = new FileReader();
    reader.onload = () => setVisitorIdPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function submitVisitor() {
    if (!visitorName.trim()) return;
    setVisitorSubmitting(true);
    setVisitorError('');
    try {
      let idUrl: string | undefined;
      if (visitorIdFile) {
        const formData = new FormData();
        formData.append('file', visitorIdFile);
        const r = await fetch(`${API_URL}/api/stay/${guestCode}/upload`, { method: 'POST', body: formData });
        if (r.ok) { const j = await r.json(); idUrl = j.url; }
      }
      const res = await fetch(`${API_URL}/api/stay/${guestCode}/visitor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorName: visitorName.trim(),
          purpose: visitorPurpose || undefined,
          expectedDate: visitorDate || undefined,
          expectedTime: visitorTime || undefined,
          idUrl,
        }),
      });
      if (!res.ok) { setVisitorError('Failed to notify. Please try again.'); return; }
      setVisitorSuccess(true);
      setShowVisitorForm(false);
      setVisitorName('');
      setVisitorPurpose('');
      setVisitorDate('');
      setVisitorTime('');
      setVisitorIdFile(null);
      setVisitorIdPreview(null);
      if (visitorIdRef.current) visitorIdRef.current.value = '';
      if (visitorIdGalleryRef.current) visitorIdGalleryRef.current.value = '';
      onRefresh();
      setTimeout(() => setVisitorSuccess(false), 4000);
    } catch {
      setVisitorError('Something went wrong. Please try again.');
    } finally {
      setVisitorSubmitting(false);
    }
  }

  const stayDates = datesBetween(booking.checkIn, booking.checkOut);

  useEffect(() => {
    if (!hkDate) { setAvailableSlots([]); return; }
    let cancelled = false;
    setLoadingSlots(true);
    fetch(`${API_URL}/api/stay/${guestCode}/cleaner-slots?date=${hkDate}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setAvailableSlots(data.slots ?? []);
        setHasAssignedCleaner(data.hasAssignedCleaner ?? true);
        setHkTime('anytime');
      })
      .catch(() => { /* silently fallback */ })
      .finally(() => { if (!cancelled) setLoadingSlots(false); });
    return () => { cancelled = true; };
  }, [hkDate, guestCode]);

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

  const hasArrivalReq = requests.some((r) => r.type === 'ARRIVAL_TIME' || r.type === 'EARLY_CHECK_IN');
  const hasDepartureReq = requests.some((r) => r.type === 'DEPARTURE_TIME');

  function isEarlyCheckin(time: string) {
    if (!time) return false;
    const [h] = time.split(':').map(Number);
    return h < STANDARD_CHECKIN_HOUR;
  }

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
                className="flex-1 text-sm text-slate-800 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-400"
              />
              <button
                disabled={!arrivalTime || submitting === 'ARRIVAL_TIME' || submitting === 'EARLY_CHECK_IN'}
                onClick={() => {
                  const type = isEarlyCheckin(arrivalTime) ? 'EARLY_CHECK_IN' : 'ARRIVAL_TIME';
                  submit(type, { requestedTime: arrivalTime, requestedDate: isoDate(new Date(booking.checkIn)), notes: `Estimated arrival: ${arrivalTime}` });
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-40"
              >
                {(submitting === 'ARRIVAL_TIME' || submitting === 'EARLY_CHECK_IN') ? '...' : 'Notify'}
              </button>
            </div>
            {arrivalTime && isEarlyCheckin(arrivalTime) && (
              <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Early check-in requested.</strong> Standard check-in is at 3:00 PM. Early check-in is not guaranteed and an additional charge may apply — your host will confirm with you.
                </span>
              </div>
            )}
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
                className="flex-1 text-sm text-slate-800 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-400"
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

        <div className="space-y-3 mt-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Date</label>
            <select
              value={hkDate}
              onChange={(e) => setHkDate(e.target.value)}
              className="w-full text-sm text-slate-800 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-400"
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

          {property.caretakerType === 'PART_TIME' && hkDate && (
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">
                Preferred time
                {loadingSlots && <span className="ml-1 text-slate-400 font-normal">Checking availability…</span>}
              </label>
              {!loadingSlots && availableSlots.length > 0 ? (
                <>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setHkTime('anytime')}
                      className={`py-2 col-span-3 rounded-xl text-xs font-medium border transition-colors ${
                        hkTime === 'anytime'
                          ? 'border-sky-500 bg-sky-50 text-sky-700'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-sky-300'
                      }`}
                    >
                      Anytime
                    </button>
                    {availableSlots.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        disabled={!s.available}
                        onClick={() => setHkTime(s.value)}
                        className={`py-2 rounded-xl text-xs font-medium border transition-colors ${
                          !s.available
                            ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed line-through'
                            : hkTime === s.value
                            ? 'border-sky-500 bg-sky-50 text-sky-700'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-sky-300'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  {!hasAssignedCleaner && (
                    <p className="text-xs text-slate-400 mt-1.5">All times available — your host will confirm a slot.</p>
                  )}
                  {availableSlots.every((s) => !s.available) && (
                    <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mt-1.5">
                      The cleaner is fully booked on this day. Please try another date or add a note below.
                    </p>
                  )}
                </>
              ) : !loadingSlots ? (
                <select
                  value={hkTime}
                  onChange={(e) => setHkTime(e.target.value)}
                  className="w-full text-sm text-slate-800 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-400"
                >
                  {Array.from({ length: 9 }, (_, i) => {
                    const h = 9 + i;
                    return { value: `${String(h).padStart(2, '0')}:00`, label: `${h > 12 ? h - 12 : h}:00 ${h >= 12 ? 'pm' : 'am'}` };
                  }).map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              ) : null}
            </div>
          )}

          <button
            disabled={!hkDate || !!submitting || (hkTime !== 'anytime' && availableSlots.length > 0 && !availableSlots.find((s) => s.value === hkTime)?.available)}
            onClick={() => submit('HOUSEKEEPING', { requestedDate: hkDate, ...(hkTime !== 'anytime' && { requestedTime: hkTime }) })}
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
                className="w-full text-sm text-slate-800 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-400"
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

      {/* ── Visitor notification ─────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
            <UserPlus size={15} className="text-teal-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">Notify about a visitor</p>
            <p className="text-xs text-slate-400">Let your host know about incoming guests</p>
          </div>
        </div>

        {visitorSuccess && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-xl px-3 py-2 mb-3">
            <Check size={13} /> Visitor notification sent to host.
          </div>
        )}

        {/* Past visitors */}
        {data.visitors.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {data.visitors.map((v) => (
              <div key={v.id} className="flex items-center gap-2 text-xs bg-slate-50 rounded-xl px-3 py-2">
                <UserPlus size={12} className="text-slate-400 flex-shrink-0" />
                <span className="font-medium text-slate-700">{v.visitorName}</span>
                {v.purpose && <span className="text-slate-400">· {v.purpose}</span>}
                {v.expectedDate && (
                  <span className="text-slate-400 ml-auto">
                    {new Date(v.expectedDate + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    {v.expectedTime && ` ${v.expectedTime}`}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {!showVisitorForm ? (
          <button onClick={() => setShowVisitorForm(true)}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl text-teal-700 text-sm font-medium transition-colors">
            <UserPlus size={14} /> Add visitor
          </button>
        ) : (
          <div className="space-y-2.5">
            {visitorError && (
              <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">
                <AlertTriangle size={12} /> {visitorError}
              </div>
            )}
            <input
              type="text"
              value={visitorName}
              onChange={(e) => setVisitorName(e.target.value)}
              placeholder="Visitor full name *"
              className="w-full text-sm text-slate-800 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-teal-400"
            />
            <input
              type="text"
              value={visitorPurpose}
              onChange={(e) => setVisitorPurpose(e.target.value)}
              placeholder="Purpose of visit (optional)"
              className="w-full text-sm text-slate-800 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-teal-400"
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Expected date</label>
                <select
                  value={visitorDate}
                  onChange={(e) => setVisitorDate(e.target.value)}
                  className="w-full text-sm text-slate-800 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-400"
                >
                  <option value="">Select</option>
                  {stayDates.map((d) => (
                    <option key={d} value={d}>
                      {new Date(d + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Expected time</label>
                <input
                  type="time"
                  value={visitorTime}
                  onChange={(e) => setVisitorTime(e.target.value)}
                  className="w-full text-sm text-slate-800 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-400"
                />
              </div>
            </div>

            {/* Visitor ID upload */}
            <input ref={visitorIdRef} type="file" accept="image/*" capture="environment" onChange={handleVisitorId} className="hidden" />
            <input ref={visitorIdGalleryRef} type="file" accept="image/*" onChange={handleVisitorId} className="hidden" />
            {visitorIdPreview ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={visitorIdPreview} alt="Visitor ID" className="w-full rounded-xl border border-slate-200 object-cover max-h-32" />
                <button type="button"
                  onClick={() => { setVisitorIdFile(null); setVisitorIdPreview(null); if (visitorIdRef.current) visitorIdRef.current.value = ''; if (visitorIdGalleryRef.current) visitorIdGalleryRef.current.value = ''; }}
                  className="absolute top-2 right-2 bg-white/90 text-slate-700 rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold shadow">✕</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => visitorIdRef.current?.click()}
                  className="py-2.5 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 text-sm font-medium flex items-center justify-center gap-2 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
                  📷 Take photo
                </button>
                <button type="button" onClick={() => visitorIdGalleryRef.current?.click()}
                  className="py-2.5 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 text-sm font-medium flex items-center justify-center gap-2 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
                  <Upload size={14} /> Upload
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => { setShowVisitorForm(false); setVisitorName(''); setVisitorPurpose(''); setVisitorDate(''); setVisitorTime(''); setVisitorIdFile(null); setVisitorIdPreview(null); setVisitorError(''); }}
                className="flex-1 py-2.5 text-sm text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50">Cancel</button>
              <button
                disabled={!visitorName.trim() || visitorSubmitting}
                onClick={submitVisitor}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700 disabled:opacity-40"
              >
                {visitorSubmitting ? 'Sending…' : 'Notify host'}
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

// ── Voice input hook (inline for guest page) ─────────────────────────────────

function useVoiceInput(onTranscript: (t: string) => void) {
  const [listening, setListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const supported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const start = useCallback(() => {
    if (!supported) { alert('Voice input not supported in this browser. Try Chrome.'); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new SR() as any;
    rec.lang = 'en-IN';
    rec.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => onTranscript(e.results[0][0].transcript);
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }, [supported, onTranscript]);

  const stop = useCallback(() => { recRef.current?.stop(); setListening(false); }, []);
  return { listening, supported, start, stop };
}

// ── Tab: Help ─────────────────────────────────────────────────────────────────

function HelpTab({ data, guestCode }: { data: StayData; guestCode: string }) {
  const { property, guide } = data;
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueDesc, setIssueDesc] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const photoRef = useRef<HTMLInputElement>(null);
  const photoGalleryRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const videoGalleryRef = useRef<HTMLInputElement>(null);

  const appendTranscript = useCallback((t: string) => setIssueDesc((p) => p ? `${p} ${t}` : t), []);
  const { listening, supported: voiceOk, start: startVoice, stop: stopVoice } = useVoiceInput(appendTranscript);

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoFile(file);
    setVideoPreviewUrl(URL.createObjectURL(file));
  }

  function clearVideo() {
    setVideoFile(null);
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoPreviewUrl(null);
    if (videoRef.current) videoRef.current.value = '';
    if (videoGalleryRef.current) videoGalleryRef.current.value = '';
  }

  async function submitIssue() {
    if (!issueDesc.trim()) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      let videoUrl: string | undefined;
      if (videoFile) {
        setUploading(true);
        const body = new FormData();
        body.append('file', videoFile);
        const r = await fetch(`${API_URL}/api/stay/${guestCode}/upload`, { method: 'POST', body });
        if (r.ok) { const j = await r.json(); videoUrl = j.url; }
        setUploading(false);
      }
      const res = await fetch(`${API_URL}/api/stay/${guestCode}/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: issueDesc, photoUrl: photoDataUrl ?? undefined, videoUrl }),
      });
      if (!res.ok) { setSubmitError('Failed to submit. Please try again.'); return; }
      setSubmitted(true);
      setShowIssueForm(false);
      setIssueDesc('');
      setPhotoDataUrl(null);
      clearVideo();
    } finally {
      setSubmitting(false);
      setUploading(false);
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
        {submitError && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 rounded-xl px-3 py-2 mb-3">
            <AlertTriangle size={14} /> {submitError}
          </div>
        )}

        {!showIssueForm ? (
          <button onClick={() => setShowIssueForm(true)}
            className="flex items-center gap-2 w-full py-3 px-4 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl text-red-700 text-sm font-medium transition-colors">
            <AlertTriangle size={15} /> Report an issue
          </button>
        ) : (
          <div className="space-y-3">
            {/* Description + voice */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-600">Describe the issue</label>
                {voiceOk && (
                  <button
                    type="button"
                    onClick={listening ? stopVoice : startVoice}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      listening
                        ? 'bg-red-100 text-red-600 animate-pulse'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    🎤 {listening ? 'Listening…' : 'Speak'}
                  </button>
                )}
              </div>
              <textarea
                value={issueDesc}
                onChange={(e) => setIssueDesc(e.target.value)}
                placeholder="e.g. AC not working, tap leaking..."
                rows={3}
                className="w-full text-sm text-slate-800 border border-slate-200 rounded-xl px-3 py-2.5 placeholder-slate-400 focus:outline-none focus:border-red-300 resize-none"
              />
            </div>

            {/* Photo */}
            <input ref={photoRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
            <input ref={photoGalleryRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
            {photoDataUrl ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoDataUrl} alt="Issue photo" className="w-full rounded-xl border border-slate-200 object-cover max-h-48" />
                <button type="button"
                  onClick={() => { setPhotoDataUrl(null); if (photoRef.current) photoRef.current.value = ''; if (photoGalleryRef.current) photoGalleryRef.current.value = ''; }}
                  className="absolute top-2 right-2 bg-white/90 text-slate-700 rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold shadow">✕</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => photoRef.current?.click()}
                  className="py-3 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors">
                  📷 Take photo
                </button>
                <button type="button" onClick={() => photoGalleryRef.current?.click()}
                  className="py-3 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors">
                  <Upload size={14} /> Upload
                </button>
              </div>
            )}

            {/* Video */}
            <input ref={videoRef} type="file" accept="video/*" capture="environment" onChange={handleVideo} className="hidden" />
            <input ref={videoGalleryRef} type="file" accept="video/*" onChange={handleVideo} className="hidden" />
            {videoPreviewUrl ? (
              <div className="relative">
                <video src={videoPreviewUrl} controls playsInline className="w-full rounded-xl border border-slate-200 max-h-48 bg-black" />
                <button type="button" onClick={clearVideo}
                  className="absolute top-2 right-2 bg-white/90 text-slate-700 rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold shadow">✕</button>
                {videoFile && <p className="text-xs text-slate-400 mt-1">{(videoFile.size / 1024 / 1024).toFixed(1)} MB</p>}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => videoRef.current?.click()}
                  className="py-3 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors">
                  🎥 Record
                </button>
                <button type="button" onClick={() => videoGalleryRef.current?.click()}
                  className="py-3 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors">
                  <Upload size={14} /> Upload
                </button>
              </div>
            )}

            {uploading && (
              <div className="flex items-center gap-2 text-sm text-indigo-600 bg-indigo-50 rounded-xl px-3 py-2">
                <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                Uploading video…
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={() => { setShowIssueForm(false); setIssueDesc(''); setPhotoDataUrl(null); clearVideo(); }}
                className="flex-1 py-2.5 text-sm text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50">Cancel</button>
              <button onClick={submitIssue} disabled={submitting || uploading || !issueDesc.trim()}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50">
                {uploading ? 'Uploading…' : submitting ? 'Sending…' : 'Send report'}
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

  const loadData = useCallback(() => {
    fetch(`${API_URL}/api/stay/${code}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then((d) => { if (d) setData(d); })
      .finally(() => setLoading(false));
  }, [code]);

  useEffect(() => { loadData(); }, [loadData]);

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
        {tab === 'access'   && <AccessTab data={data} guestCode={code} onRefresh={loadData} />}
        {tab === 'guide'    && <GuideTab data={data} />}
        {tab === 'services' && (
          <ServicesTab
            data={data}
            guestCode={code}
            onRequestsUpdate={(reqs) => setData((d) => d ? { ...d, serviceRequests: reqs } : d)}
            onRefresh={loadData}
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
