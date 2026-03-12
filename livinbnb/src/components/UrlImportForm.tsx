'use client';

import { useState } from 'react';
import { ArrowRight, Link2, MapPin, Calendar, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

type Step = 'listing' | 'destination' | 'dates' | 'done';

interface FormData {
  listingUrl: string;
  destination: string;
  startDate: string;
  endDate: string;
  email: string;
}

function detectPlatform(url: string): 'airbnb' | 'homeexchange' | 'other' | null {
  if (!url) return null;
  if (url.includes('airbnb.')) return 'airbnb';
  if (url.includes('homeexchange.')) return 'homeexchange';
  try { new URL(url); return 'other'; } catch { return null; }
}

const PLATFORM_LABELS: Record<string, string> = {
  airbnb: 'Airbnb',
  homeexchange: 'HomeExchange',
  other: 'listing',
};

export default function UrlImportForm() {
  const [step, setStep] = useState<Step>('listing');
  const [form, setForm] = useState<FormData>({
    listingUrl: '',
    destination: '',
    startDate: '',
    endDate: '',
    email: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const platform = detectPlatform(form.listingUrl);

  function update(field: keyof FormData, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    setError('');
  }

  function handleListingNext() {
    if (!platform) {
      setError('Please paste a valid Airbnb or HomeExchange listing URL.');
      return;
    }
    setStep('destination');
  }

  function handleDestinationNext() {
    if (!form.destination.trim()) {
      setError('Where do you want to go?');
      return;
    }
    setStep('dates');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.startDate || !form.endDate) {
      setError('Please pick your travel dates.');
      return;
    }
    if (!form.email.includes('@')) {
      setError('Please enter a valid email.');
      return;
    }
    setSubmitting(true);
    // Simulate API call — replace with real endpoint
    await new Promise(r => setTimeout(r, 1200));
    setSubmitting(false);
    setStep('done');
  }

  if (step === 'done') {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <CheckCircle2 className="w-14 h-14 text-green-500" />
        <h3 className="text-2xl font-semibold text-slate-900">You&apos;re on the list!</h3>
        <p className="text-slate-500 max-w-xs">
          We&apos;ll email <strong>{form.email}</strong> when we find a match for{' '}
          <strong>{form.destination}</strong>. We&apos;re working through the waitlist now.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {(['listing', 'destination', 'dates'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                step === s
                  ? 'bg-sand-500 text-white'
                  : ['destination', 'dates'].indexOf(step) > i ||
                    (step === 'dates' && s !== 'dates')
                  ? 'bg-green-500 text-white'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {(['destination', 'dates'].indexOf(step) > i ||
                (step === 'dates' && s !== 'dates')) ? '✓' : i + 1}
            </div>
            {i < 2 && <div className="flex-1 h-px bg-slate-200" />}
          </div>
        ))}
      </div>

      {/* Step 1 — Listing URL */}
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
              onKeyDown={e => e.key === 'Enter' && handleListingNext()}
              className="w-full pl-9 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 focus:border-transparent transition"
            />
            {platform && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                {PLATFORM_LABELS[platform]} detected
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Also works with HomeExchange.com listings.
          </p>
          {error && <ErrorMsg>{error}</ErrorMsg>}
          <button
            onClick={handleListingNext}
            className="btn-primary"
          >
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
              Be as specific or broad as you like — "London", "UK", "Europe".
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

      {/* Step 3 — Dates + Email */}
      {step === 'dates' && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <h3 className="text-xl font-semibold mb-1">When do you want to travel?</h3>
            <p className="text-slate-500 text-sm">
              We&apos;ll match you with exchanges whose windows overlap with yours.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium mb-1 block">From</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={form.startDate}
                  onChange={e => update('startDate', e.target.value)}
                  className="w-full pl-9 pr-3 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 focus:border-transparent transition"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium mb-1 block">To</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={form.endDate}
                  min={form.startDate}
                  onChange={e => update('endDate', e.target.value)}
                  className="w-full pl-9 pr-3 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 focus:border-transparent transition"
                />
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium mb-1 block">Your email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={e => update('email', e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 focus:border-transparent transition"
            />
          </div>
          {error && <ErrorMsg>{error}</ErrorMsg>}
          <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-60">
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Finding matches…</>
            ) : (
              <>Find my exchange <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
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
