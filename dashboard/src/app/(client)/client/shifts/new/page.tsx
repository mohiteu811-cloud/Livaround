'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, Venue } from '@/lib/api';
import { ArrowLeft, Plus } from 'lucide-react';

const ROLES = ['WAITER', 'BARTENDER', 'COOK', 'HOUSEKEEPER', 'SECURITY', 'DRIVER', 'CLEANER', 'OTHER'];
const CURRENCIES = [
  { value: 'INR', symbol: '₹', label: 'INR (₹)' },
  { value: 'GBP', symbol: '£', label: 'GBP (£)' },
  { value: 'USD', symbol: '$', label: 'USD ($)' },
  { value: 'EUR', symbol: '€', label: 'EUR (€)' },
];

const COMMON_REQUIREMENTS = [
  'Own vehicle required',
  'Uniform provided by venue',
  'English speaking',
  'Hindi speaking',
  'Fine dining experience',
  'Alcohol licence required',
  'Food handling certificate',
];

export default function NewShiftPage() {
  const router = useRouter();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [customReq, setCustomReq] = useState('');

  const [form, setForm] = useState({
    venueId: '',
    role: 'WAITER',
    date: '',
    startTime: '',
    endTime: '',
    hourlyRate: '',
    currency: 'INR',
    workersNeeded: '1',
    notes: '',
    urgency: 'SCHEDULED',
    requirements: [] as string[],
  });

  useEffect(() => {
    api.venues.list().then((v) => {
      setVenues(v);
      if (v.length > 0) {
        const def = v.find((x) => x.isDefault) ?? v[0];
        setForm((f) => ({ ...f, venueId: def.id }));
      }
    });
  }, []);

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setError('');
  }

  function toggleRequirement(req: string) {
    setForm((f) => ({
      ...f,
      requirements: f.requirements.includes(req)
        ? f.requirements.filter((r) => r !== req)
        : [...f.requirements, req],
    }));
  }

  function addCustomRequirement() {
    const trimmed = customReq.trim();
    if (!trimmed || form.requirements.includes(trimmed)) return;
    setForm((f) => ({ ...f, requirements: [...f.requirements, trimmed] }));
    setCustomReq('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.venueId) { setError('Please select a venue'); return; }

    setLoading(true);
    setError('');
    try {
      const shift = await api.shifts.create({
        venueId: form.venueId,
        role: form.role,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        hourlyRate: parseFloat(form.hourlyRate),
        currency: form.currency,
        workersNeeded: parseInt(form.workersNeeded),
        notes: form.notes || undefined,
        requirements: form.requirements,
        urgency: form.urgency as 'ASAP' | 'SCHEDULED',
      });
      router.push(`/client/shifts/${shift.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post shift');
    } finally {
      setLoading(false);
    }
  }

  const currencySymbol = CURRENCIES.find((c) => c.value === form.currency)?.symbol ?? '₹';

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/client/shifts" className="p-2 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-bold text-slate-100">Post a Shift</h1>
      </div>

      {venues.length === 0 && (
        <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400 text-sm">
          You need to add a venue before posting a shift.{' '}
          <Link href="/client/venues" className="underline font-medium">Add a venue</Link>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Venue */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Location</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Venue</label>
              <div className="flex gap-2">
                <select
                  value={form.venueId}
                  onChange={(e) => set('venueId', e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-brand-500"
                  required
                >
                  <option value="">Select venue</option>
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>{v.name} — {v.address}</option>
                  ))}
                </select>
                <Link
                  href="/client/venues"
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-slate-100 text-sm"
                >
                  <Plus size={16} />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Role & Schedule */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Role & Schedule</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">Role needed</label>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => set('role', r)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      form.role === r
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    {r.charAt(0) + r.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Date</label>
              <input
                type="date"
                value={form.date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => set('date', e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Workers needed</label>
              <input
                type="number"
                value={form.workersNeeded}
                min={1}
                max={50}
                onChange={(e) => set('workersNeeded', e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Start time</label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => set('startTime', e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">End time</label>
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => set('endTime', e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>
        </div>

        {/* Pay */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Pay & Urgency</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Currency</label>
              <select
                value={form.currency}
                onChange={(e) => set('currency', e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-brand-500"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Hourly rate ({currencySymbol})</label>
              <input
                type="number"
                value={form.hourlyRate}
                min={1}
                step="0.01"
                placeholder="300"
                onChange={(e) => set('hourlyRate', e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">Urgency</label>
              <div className="flex gap-3">
                {[
                  { value: 'SCHEDULED', label: 'Scheduled', desc: 'Future date' },
                  { value: 'ASAP', label: 'ASAP', desc: 'Need now' },
                ].map((u) => (
                  <button
                    key={u.value}
                    type="button"
                    onClick={() => set('urgency', u.value)}
                    className={`flex-1 px-3 py-2.5 rounded-lg border text-sm transition-colors text-left ${
                      form.urgency === u.value
                        ? 'border-brand-500 bg-brand-600/10 text-brand-400'
                        : 'border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div className="font-medium">{u.label}</div>
                    <div className="text-xs opacity-70">{u.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Requirements */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Requirements (optional)</h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {COMMON_REQUIREMENTS.map((req) => (
              <button
                key={req}
                type="button"
                onClick={() => toggleRequirement(req)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  form.requirements.includes(req)
                    ? 'bg-brand-600/20 border-brand-500 text-brand-400'
                    : 'border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                {req}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add custom requirement…"
              value={customReq}
              onChange={(e) => setCustomReq(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomRequirement(); } }}
              className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-brand-500 placeholder:text-slate-600"
            />
            <button
              type="button"
              onClick={addCustomRequirement}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-slate-100 text-sm"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Notes (optional)</h2>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Anything workers should know — dress code, parking, who to ask for on arrival…"
            rows={3}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-brand-500 placeholder:text-slate-600 resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading || venues.length === 0}
          className="w-full py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors"
        >
          {loading ? 'Posting shift…' : 'Post Shift & Notify Workers'}
        </button>
      </form>
    </div>
  );
}
