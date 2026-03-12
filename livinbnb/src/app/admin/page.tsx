'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Trash2, Plus, LogIn, ExternalLink } from 'lucide-react';

interface Listing {
  id: string;
  name: string;
  email: string;
  airbnbUrl: string | null;
  homeExchangeUrl: string | null;
  title: string;
  location: string;
  destination: string;
  travelStart: string;
  travelEnd: string;
  createdAt: string;
}

function splitLocation(input: string) {
  const parts = input.split(',').map(s => s.trim());
  return { city: parts[0] ?? input, country: parts[parts.length - 1] ?? input };
}

const EMPTY = {
  name: '', email: '', airbnbUrl: '', homeExchangeUrl: '',
  location: '', destination: '', startDate: '', endDate: '',
};

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');
  const [listings, setListings] = useState<Listing[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const load = useCallback(async (pw: string) => {
    const res = await fetch('/api/admin/seed', { headers: { 'x-admin-password': pw } });
    if (res.status === 401) { setAuthError('Wrong password'); return false; }
    const data = await res.json();
    setListings(data.listings ?? []);
    return true;
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    const ok = await load(password);
    if (ok) setAuthed(true);
  }

  useEffect(() => {
    if (authed) load(password);
  }, [authed, load, password]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError('');
    setSuccessMsg('');
    if (!form.email || (!form.airbnbUrl && !form.homeExchangeUrl) || !form.location || !form.destination || !form.startDate || !form.endDate) {
      setSubmitError('Fill in all required fields (email, at least one URL, location, destination, dates).');
      return;
    }
    setAdding(true);
    const loc = splitLocation(form.location);
    const dest = splitLocation(form.destination);
    try {
      const res = await fetch('/api/admin/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({
          name: form.name || 'Anonymous',
          email: form.email,
          airbnbUrl: form.airbnbUrl || null,
          homeExchangeUrl: form.homeExchangeUrl || null,
          location: form.location,
          city: loc.city,
          country: loc.country,
          destination: form.destination,
          destCity: dest.city,
          destCountry: dest.country,
          startDate: form.startDate,
          endDate: form.endDate,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setSubmitError(d.error ?? 'Error adding listing');
        return;
      }
      setSuccessMsg(`✓ ${form.name || 'Anonymous'} (${form.location} → ${form.destination}) added. Confirmation email sent.`);
      setForm(EMPTY);
      load(password);
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this listing?')) return;
    setDeletingId(id);
    await fetch('/api/admin/seed', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({ id }),
    });
    setDeletingId(null);
    load(password);
  }

  function upd(field: keyof typeof EMPTY, val: string) {
    setForm(f => ({ ...f, [field]: val }));
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <form onSubmit={handleLogin} className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 w-full max-w-sm flex flex-col gap-4">
          <h1 className="text-xl font-bold text-slate-900">Admin</h1>
          <input
            type="password"
            placeholder="Admin password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400"
          />
          {authError && <p className="text-red-500 text-sm">{authError}</p>}
          <button type="submit" className="btn-primary">
            <LogIn className="w-4 h-4" /> Sign in
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">
            livin<span className="text-sand-500">bnb</span> Admin
          </h1>
          <span className="text-sm text-slate-400">{listings.length} listings total</span>
        </div>

        {/* Add listing form */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-sand-500" /> Seed a listing
          </h2>
          <form onSubmit={handleAdd} className="grid grid-cols-2 gap-3">
            <input placeholder="Name *" value={form.name} onChange={e => upd('name', e.target.value)}
              className="input-field" />
            <input type="email" placeholder="Email *" value={form.email} onChange={e => upd('email', e.target.value)}
              className="input-field" />
            <input type="url" placeholder="Airbnb URL (optional)" value={form.airbnbUrl} onChange={e => upd('airbnbUrl', e.target.value)}
              className="input-field" />
            <input type="url" placeholder="HomeExchange URL (optional)" value={form.homeExchangeUrl} onChange={e => upd('homeExchangeUrl', e.target.value)}
              className="input-field" />
            <input placeholder="Property location * e.g. North Goa, India" value={form.location} onChange={e => upd('location', e.target.value)}
              className="input-field col-span-2" />
            <input placeholder="Destination * e.g. London, UK" value={form.destination} onChange={e => upd('destination', e.target.value)}
              className="input-field col-span-2" />
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Travel from *</label>
              <input type="date" value={form.startDate} onChange={e => upd('startDate', e.target.value)} className="input-field w-full" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Travel to *</label>
              <input type="date" value={form.endDate} onChange={e => upd('endDate', e.target.value)} className="input-field w-full" />
            </div>
            {submitError && <p className="col-span-2 text-red-500 text-sm">{submitError}</p>}
            {successMsg && <p className="col-span-2 text-green-600 text-sm font-medium">{successMsg}</p>}
            <button type="submit" disabled={adding} className="col-span-2 btn-primary disabled:opacity-60">
              {adding ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding & sending emails…</> : <>Add listing + send confirmation email</>}
            </button>
          </form>
        </div>

        {/* Listings table */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Name', 'Email', 'Location → Destination', 'Dates', 'Platforms', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {listings.map(l => (
                <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium">{l.name}</td>
                  <td className="px-4 py-3 text-slate-500">{l.email}</td>
                  <td className="px-4 py-3">
                    <span className="text-slate-500">{l.location}</span>
                    <span className="text-sand-400 mx-1">→</span>
                    <span className="font-medium">{l.destination}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                    {new Date(l.travelStart).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}
                    {' – '}
                    {new Date(l.travelEnd).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {l.airbnbUrl && (
                        <a href={l.airbnbUrl} target="_blank" rel="noopener noreferrer"
                           className="text-xs text-rose-500 hover:underline flex items-center gap-0.5">
                          Airbnb <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {l.homeExchangeUrl && (
                        <a href={l.homeExchangeUrl} target="_blank" rel="noopener noreferrer"
                           className="text-xs text-green-600 hover:underline flex items-center gap-0.5">
                          HE <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(l.id)} disabled={deletingId === l.id}
                      className="text-slate-300 hover:text-red-400 transition-colors disabled:opacity-50">
                      {deletingId === l.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
              ))}
              {listings.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No listings yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
