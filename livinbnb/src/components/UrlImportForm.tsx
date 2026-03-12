'use client';

import { useState } from 'react';
import { ArrowRight, Link2, MapPin, Calendar, Loader2, CheckCircle2, AlertCircle, User } from 'lucide-react';

type Step = 'listing' | 'destination' | 'dates' | 'done';

interface FormData {
  name: string;
  email: string;
  listingUrl: string;
  // location fields (auto-parsed or user-typed)
  location: string;   // "North Goa, India"
  city: string;
  country: string;
  // destination
  destination: string;
  destCity: string;
  destCountry: string;
  startDate: string;
  endDate: string;
}

function detectPlatform(url: string): 'airbnb' | 'homeexchange' | 'other' | null {
  if (!url) return null;
  if (url.includes('airbnb.')) return 'airbnb';
  if (url.includes('homeexchange.')) return 'homeexchange';
  try { new URL(url); return 'other'; } catch { return null; }
}

/** Very naive "City, Country" splitter — e.g. "North Goa, India" → {city, country} */
function splitLocation(input: string): { city: string; country: string; location: string } {
  const parts = input.split(',').map(s => s.trim());
  return {
    city: parts[0] ?? input,
    country: parts[parts.length - 1] ?? input,
    location: input,
  };
}

const PLATFORM_LABELS: Record<string, string> = {
  airbnb: 'Airbnb',
  homeexchange: 'HomeExchange',
  other: 'listing',
};

export default function UrlImportForm({ onListingAdded }: { onListingAdded?: () => void }) {
  const [step, setStep] = useState<Step>('listing');
  const [form, setForm] = useState<FormData>({
    name: '', email: '',
    listingUrl: '',
    location: '', city: '', country: '',
    destination: '', destCity: '', destCountry: '',
    startDate: '', endDate: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const platform = detectPlatform(form.listingUrl);

  function update(field: keyof FormData, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    setError('');
  }

  function handleListingNext() {
    if (!platform) { setError('Please paste a valid Airbnb or HomeExchange listing URL.'); return; }
    if (!form.location.trim()) { setError('Where is your property located? e.g. "North Goa, India"'); return; }
    const parsed = splitLocation(form.location);
    setForm(f => ({ ...f, ...parsed }));
    setStep('destination');
  }

  function handleDestinationNext() {
    if (!form.destination.trim()) { setError('Where do you want to go?'); return; }
    const parsed = splitLocation(form.destination);
    setForm(f => ({ ...f, destCity: parsed.city, destCountry: parsed.country }));
    setStep('dates');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.startDate || !form.endDate) { setError('Please pick your travel dates.'); return; }
    if (!form.email.includes('@')) { setError('Please enter a valid email.'); return; }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name || 'Anonymous',
          email: form.email,
          platform,
          listingUrl: form.listingUrl,
          location: form.location,
          city: form.city,
          country: form.country,
          destination: form.destination,
          destCity: form.destCity,
          destCountry: form.destCountry,
          startDate: form.startDate,
          endDate: form.endDate,
        }),
      });
      if (!res.ok) {
        let msg = `Server error (${res.status}) — please try again.`;
        try { const d = await res.json(); msg = d.error ?? msg; } catch { /* non-JSON body */ }
        setError(msg);
        return;
      }
      setStep('done');
      onListingAdded?.();
    } catch (err) {
      setError(`Could not reach the server — ${err instanceof Error ? err.message : 'please try again'}.`);
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'done') {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <CheckCircle2 className="w-14 h-14 text-green-500" />
        <h3 className="text-2xl font-semibold text-slate-900">You&apos;re listed!</h3>
        <p className="text-slate-500 max-w-xs">
          Your home is now visible on the board below. We&apos;ll email{' '}
          <strong>{form.email}</strong> when we find a match for{' '}
          <strong>{form.destination}</strong>.
        </p>
      </div>
    );
  }

  const stepIndex = { listing: 0, destination: 1, dates: 2 }[step] ?? 0;

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {[0, 1, 2].map(i => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                i === stepIndex ? 'bg-sand-500 text-white'
                  : i < stepIndex ? 'bg-green-500 text-white'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {i < stepIndex ? '✓' : i + 1}
            </div>
            {i < 2 && <div className="flex-1 h-px bg-slate-200" />}
          </div>
        ))}
      </div>

      {/* Step 1 — Listing URL + location */}
      {step === 'listing' && (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-xl font-semibold mb-1">Link your existing listing</h3>
            <p className="text-slate-500 text-sm">
              Paste your Airbnb or HomeExchange URL — we import your property details automatically.
            </p>
          </div>
          <div className="relative">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="url"
              placeholder="https://www.airbnb.com/rooms/..."
              value={form.listingUrl}
              onChange={e => update('listingUrl', e.target.value)}
              className="w-full pl-9 pr-36 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 focus:border-transparent transition"
            />
            {platform && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                {PLATFORM_LABELS[platform]} detected
              </span>
            )}
          </div>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Where is your property? e.g. North Goa, India"
              value={form.location}
              onChange={e => update('location', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleListingNext()}
              className="w-full pl-9 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 focus:border-transparent transition"
            />
          </div>
          {error && <ErrorMsg>{error}</ErrorMsg>}
          <button onClick={handleListingNext} className="btn-primary">
            Continue <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Step 2 — Destination */}
      {step === 'destination' && (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-xl font-semibold mb-1">Where do you want to go?</h3>
            <p className="text-slate-500 text-sm">
              Be as specific or broad as you like — &quot;London&quot;, &quot;UK&quot;, &quot;Europe&quot;.
            </p>
          </div>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="London, UK"
              value={form.destination}
              onChange={e => update('destination', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleDestinationNext()}
              autoFocus
              className="w-full pl-9 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 focus:border-transparent transition"
            />
          </div>
          {error && <ErrorMsg>{error}</ErrorMsg>}
          <button onClick={handleDestinationNext} className="btn-primary">
            Continue <ArrowRight className="w-4 h-4" />
          </button>
          <button onClick={() => setStep('listing')} className="btn-ghost">Back</button>
        </div>
      )}

      {/* Step 3 — Dates + personal info */}
      {step === 'dates' && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <h3 className="text-xl font-semibold mb-1">Almost there</h3>
            <p className="text-slate-500 text-sm">Your travel dates and contact so we can notify you of matches.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium mb-1 block">From</label>
              <input
                type="date"
                value={form.startDate}
                onChange={e => update('startDate', e.target.value)}
                className="w-full px-3 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium mb-1 block">To</label>
              <input
                type="date"
                value={form.endDate}
                min={form.startDate}
                onChange={e => update('endDate', e.target.value)}
                className="w-full px-3 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 focus:border-transparent transition"
              />
            </div>
          </div>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Your first name (shown publicly)"
              value={form.name}
              onChange={e => update('name', e.target.value)}
              className="w-full pl-9 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 focus:border-transparent transition"
            />
          </div>
          <input
            type="email"
            placeholder="your@email.com (private — for match notifications)"
            value={form.email}
            onChange={e => update('email', e.target.value)}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 focus:border-transparent transition"
          />
          {error && <ErrorMsg>{error}</ErrorMsg>}
          <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-60">
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Listing your home…</>
            ) : (
              <>List my home &amp; find exchanges <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
          <p className="text-xs text-center text-slate-400">Your email is never shown publicly.</p>
          <button type="button" onClick={() => setStep('destination')} className="btn-ghost">Back</button>
        </form>
      )}
    </div>
  );
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-red-600 text-sm">
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      {children}
    </div>
  );
}
