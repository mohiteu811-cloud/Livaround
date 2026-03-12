'use client';

import { useState } from 'react';
import { ArrowRight, Link2, MapPin, Loader2, CheckCircle2, AlertCircle, User } from 'lucide-react';

type Step = 'listing' | 'destination' | 'dates' | 'done';

interface FormData {
  name: string;
  email: string;
  airbnbUrl: string;
  homeExchangeUrl: string;
  location: string;
  city: string;
  country: string;
  destination: string;
  destCity: string;
  destCountry: string;
  startDate: string;
  endDate: string;
}

function isValidUrl(url: string) {
  if (!url) return false;
  try { new URL(url); return true; } catch { return false; }
}

function splitLocation(input: string): { city: string; country: string; location: string } {
  const parts = input.split(',').map(s => s.trim());
  return { city: parts[0] ?? input, country: parts[parts.length - 1] ?? input, location: input };
}

export default function UrlImportForm({ onListingAdded }: { onListingAdded?: () => void }) {
  const [step, setStep] = useState<Step>('listing');
  const [form, setForm] = useState<FormData>({
    name: '', email: '',
    airbnbUrl: '', homeExchangeUrl: '',
    location: '', city: '', country: '',
    destination: '', destCity: '', destCountry: '',
    startDate: '', endDate: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function update(field: keyof FormData, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    setError('');
  }

  function handleListingNext() {
    if (!form.airbnbUrl && !form.homeExchangeUrl) {
      setError('Paste at least one listing URL — Airbnb or HomeExchange.');
      return;
    }
    if (form.airbnbUrl && !isValidUrl(form.airbnbUrl)) {
      setError('Airbnb URL doesn\'t look right. Make sure it starts with https://');
      return;
    }
    if (form.homeExchangeUrl && !isValidUrl(form.homeExchangeUrl)) {
      setError('HomeExchange URL doesn\'t look right. Make sure it starts with https://');
      return;
    }
    if (!form.location.trim()) {
      setError('Where is your property? e.g. "North Goa, India"');
      return;
    }
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
          airbnbUrl: form.airbnbUrl || null,
          homeExchangeUrl: form.homeExchangeUrl || null,
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
          <strong>{form.email}</strong> when we find a match for <strong>{form.destination}</strong>.
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
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
              i === stepIndex ? 'bg-sand-500 text-white' : i < stepIndex ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-400'
            }`}>
              {i < stepIndex ? '✓' : i + 1}
            </div>
            {i < 2 && <div className="flex-1 h-px bg-slate-200" />}
          </div>
        ))}
      </div>

      {/* Step 1 — Listing URLs + location */}
      {step === 'listing' && (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-xl font-semibold mb-1">Link your listing profiles</h3>
            <p className="text-slate-500 text-sm">
              Add your Airbnb and/or HomeExchange URL — others can see both profiles for the same property.
              At least one is required.
            </p>
          </div>

          {/* Airbnb URL */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1.5 block">
              <span className="w-4 h-4 rounded bg-rose-500 flex items-center justify-center text-white text-[9px] font-bold">A</span>
              Airbnb listing URL <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="url"
                placeholder="https://www.airbnb.com/rooms/..."
                value={form.airbnbUrl}
                onChange={e => update('airbnbUrl', e.target.value)}
                className="w-full pl-9 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 focus:border-transparent transition"
              />
              {form.airbnbUrl && isValidUrl(form.airbnbUrl) && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">✓</span>
              )}
            </div>
          </div>

          {/* HomeExchange URL */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1.5 block">
              <span className="w-4 h-4 rounded bg-green-600 flex items-center justify-center text-white text-[9px] font-bold">H</span>
              HomeExchange listing URL <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="url"
                placeholder="https://www.homeexchange.com/en/listing/..."
                value={form.homeExchangeUrl}
                onChange={e => update('homeExchangeUrl', e.target.value)}
                className="w-full pl-9 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 focus:border-transparent transition"
              />
              {form.homeExchangeUrl && isValidUrl(form.homeExchangeUrl) && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">✓</span>
              )}
            </div>
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
            <p className="text-slate-500 text-sm">Be as specific or broad as you like — &quot;London&quot;, &quot;UK&quot;, &quot;Europe&quot;.</p>
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
              <input type="date" value={form.startDate} onChange={e => update('startDate', e.target.value)}
                className="w-full px-3 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 focus:border-transparent transition" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium mb-1 block">To</label>
              <input type="date" value={form.endDate} min={form.startDate} onChange={e => update('endDate', e.target.value)}
                className="w-full px-3 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 focus:border-transparent transition" />
            </div>
          </div>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Your first name (shown publicly)" value={form.name}
              onChange={e => update('name', e.target.value)}
              className="w-full pl-9 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 focus:border-transparent transition" />
          </div>
          <input type="email" placeholder="your@email.com (private — for match notifications)" value={form.email}
            onChange={e => update('email', e.target.value)}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 focus:border-transparent transition" />
          {error && <ErrorMsg>{error}</ErrorMsg>}
          <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-60">
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Listing your home…</> : <>List my home &amp; find exchanges <ArrowRight className="w-4 h-4" /></>}
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
