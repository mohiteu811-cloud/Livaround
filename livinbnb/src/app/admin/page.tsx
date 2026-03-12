'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Trash2, Plus, LogIn, ExternalLink,
  Users, Megaphone, Home, ChevronDown, Copy, Check,
  ArrowRight, RefreshCw,
} from 'lucide-react';
import type { OutreachKit } from '@/app/api/admin/outreach/route';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Listing {
  id: string; name: string; email: string;
  airbnbUrl: string | null; homeExchangeUrl: string | null;
  title: string; location: string; destination: string;
  travelStart: string; travelEnd: string; createdAt: string;
}

interface Lead {
  id: string; name: string; contact: string; source: string;
  location: string; destination: string; status: string;
  notes: string | null; followUpAt: string | null; createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  IDENTIFIED: 'bg-slate-100 text-slate-600',
  CONTACTED:  'bg-blue-100 text-blue-700',
  RESPONDED:  'bg-amber-100 text-amber-700',
  LISTED:     'bg-green-100 text-green-700',
  DECLINED:   'bg-red-100 text-red-600',
};

const LEAD_STATUSES = ['IDENTIFIED', 'CONTACTED', 'RESPONDED', 'LISTED', 'DECLINED'];

function splitLocation(input: string) {
  const parts = input.split(',').map(s => s.trim());
  return { city: parts[0] ?? input, country: parts[parts.length - 1] ?? input };
}

// ── Clipboard helper ────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy}
      className="flex items-center gap-1 text-xs text-slate-400 hover:text-sand-500 transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');
  const [tab, setTab] = useState<'listings' | 'leads' | 'outreach'>('listings');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/seed', { headers: { 'x-admin-password': password } });
    if (res.status === 401) { setAuthError('Wrong password'); return; }
    setAuthed(true);
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <form onSubmit={handleLogin} className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 w-full max-w-sm flex flex-col gap-4">
          <h1 className="text-xl font-bold text-slate-900">Admin</h1>
          <input type="password" placeholder="Admin password" value={password}
            onChange={e => setPassword(e.target.value)}
            className="input-field" />
          {authError && <p className="text-red-500 text-sm">{authError}</p>}
          <button type="submit" className="btn-primary"><LogIn className="w-4 h-4" /> Sign in</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">
            livin<span className="text-sand-500">bnb</span> CEO Dashboard
          </h1>
          <div className="flex gap-1 bg-white border border-slate-100 rounded-xl p-1">
            {([
              { id: 'listings', icon: Home, label: 'Listings' },
              { id: 'leads', icon: Users, label: 'Leads' },
              { id: 'outreach', icon: Megaphone, label: 'Outreach' },
            ] as const).map(({ id, icon: Icon, label }) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === id ? 'bg-sand-500 text-white' : 'text-slate-500 hover:text-slate-700'
                }`}>
                <Icon className="w-4 h-4" />{label}
              </button>
            ))}
          </div>
        </div>

        {tab === 'listings' && <ListingsTab password={password} />}
        {tab === 'leads' && <LeadsTab password={password} />}
        {tab === 'outreach' && <OutreachTab password={password} />}
      </div>
    </div>
  );
}

// ── LISTINGS TAB ───────────────────────────────────────────────────────────────
const EMPTY_LISTING = {
  name: '', email: '', airbnbUrl: '', homeExchangeUrl: '',
  location: '', destination: '', startDate: '', endDate: '',
};

function ListingsTab({ password }: { password: string }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [form, setForm] = useState(EMPTY_LISTING);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const headers = { 'Content-Type': 'application/json', 'x-admin-password': password };

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/seed', { headers: { 'x-admin-password': password } });
    const d = await res.json();
    setListings(d.listings ?? []);
  }, [password]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!form.email || (!form.airbnbUrl && !form.homeExchangeUrl) || !form.location || !form.destination || !form.startDate || !form.endDate) {
      setError('Fill in all required fields.'); return;
    }
    setAdding(true);
    const loc = splitLocation(form.location);
    const dest = splitLocation(form.destination);
    try {
      const res = await fetch('/api/admin/seed', {
        method: 'POST', headers,
        body: JSON.stringify({
          name: form.name || 'Anonymous', email: form.email,
          airbnbUrl: form.airbnbUrl || null, homeExchangeUrl: form.homeExchangeUrl || null,
          location: form.location, city: loc.city, country: loc.country,
          destination: form.destination, destCity: dest.city, destCountry: dest.country,
          startDate: form.startDate, endDate: form.endDate,
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Error'); return; }
      setSuccess(`✓ Added ${form.name || 'Anonymous'} — confirmation email sent.`);
      setForm(EMPTY_LISTING);
      load();
    } finally { setAdding(false); }
  }

  async function del(id: string) {
    if (!confirm('Delete this listing?')) return;
    setDeletingId(id);
    await fetch('/api/admin/seed', { method: 'DELETE', headers, body: JSON.stringify({ id }) });
    setDeletingId(null);
    load();
  }

  const upd = (k: keyof typeof EMPTY_LISTING, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="flex flex-col gap-6">
      {/* Add form */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-sand-500" /> Seed a listing on behalf of someone
        </h2>
        <form onSubmit={handleAdd} className="grid grid-cols-2 gap-3">
          <input placeholder="Name" value={form.name} onChange={e => upd('name', e.target.value)} className="input-field" />
          <input type="email" placeholder="Email *" value={form.email} onChange={e => upd('email', e.target.value)} className="input-field" />
          <input type="url" placeholder="Airbnb URL" value={form.airbnbUrl} onChange={e => upd('airbnbUrl', e.target.value)} className="input-field" />
          <input type="url" placeholder="HomeExchange URL" value={form.homeExchangeUrl} onChange={e => upd('homeExchangeUrl', e.target.value)} className="input-field" />
          <input placeholder="Property location * e.g. North Goa, India" value={form.location} onChange={e => upd('location', e.target.value)} className="input-field col-span-2" />
          <input placeholder="Destination * e.g. London, UK" value={form.destination} onChange={e => upd('destination', e.target.value)} className="input-field col-span-2" />
          <div><label className="text-xs text-slate-500 mb-1 block">Travel from *</label>
            <input type="date" value={form.startDate} onChange={e => upd('startDate', e.target.value)} className="input-field w-full" /></div>
          <div><label className="text-xs text-slate-500 mb-1 block">Travel to *</label>
            <input type="date" value={form.endDate} onChange={e => upd('endDate', e.target.value)} className="input-field w-full" /></div>
          {error && <p className="col-span-2 text-red-500 text-sm">{error}</p>}
          {success && <p className="col-span-2 text-green-600 text-sm font-medium">{success}</p>}
          <button type="submit" disabled={adding} className="col-span-2 btn-primary disabled:opacity-60">
            {adding ? <><Loader2 className="w-4 h-4 animate-spin" />Adding…</> : 'Add listing + send confirmation email'}
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">{listings.length} listings</span>
          <button onClick={load} className="text-slate-400 hover:text-slate-600"><RefreshCw className="w-4 h-4" /></button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>{['Name', 'Email', 'Route', 'Dates', 'Links', ''].map(h =>
              <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {listings.map(l => (
              <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{l.name}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{l.email}</td>
                <td className="px-4 py-3 text-sm">
                  <span className="text-slate-500">{l.location}</span>
                  <ArrowRight className="w-3 h-3 text-sand-400 inline mx-1" />
                  <span className="font-medium">{l.destination}</span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                  {new Date(l.travelStart).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}–
                  {new Date(l.travelEnd).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {l.airbnbUrl && <a href={l.airbnbUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-rose-500 hover:underline flex items-center gap-0.5">Airbnb<ExternalLink className="w-3 h-3" /></a>}
                    {l.homeExchangeUrl && <a href={l.homeExchangeUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-green-600 hover:underline flex items-center gap-0.5">HE<ExternalLink className="w-3 h-3" /></a>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => del(l.id)} disabled={deletingId === l.id} className="text-slate-300 hover:text-red-400 transition-colors">
                    {deletingId === l.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </td>
              </tr>
            ))}
            {listings.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No listings yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── LEADS TAB ──────────────────────────────────────────────────────────────────
const EMPTY_LEAD = {
  name: '', contact: '', source: '', location: '', destination: '',
  status: 'IDENTIFIED', notes: '', followUpAt: '',
};

function LeadsTab({ password }: { password: string }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [form, setForm] = useState(EMPTY_LEAD);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState('ALL');

  const headers = { 'Content-Type': 'application/json', 'x-admin-password': password };

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/leads', { headers: { 'x-admin-password': password } });
    const d = await res.json();
    setLeads(d.leads ?? []);
  }, [password]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.contact || !form.location || !form.destination) return;
    setAdding(true);
    await fetch('/api/admin/leads', {
      method: 'POST', headers,
      body: JSON.stringify({
        name: form.name, contact: form.contact, source: form.source || 'Manual',
        location: form.location, destination: form.destination,
        status: form.status, notes: form.notes || null,
        followUpAt: form.followUpAt ? new Date(form.followUpAt) : null,
      }),
    });
    setForm(EMPTY_LEAD);
    setAdding(false);
    load();
  }

  async function updateStatus(id: string, status: string) {
    await fetch('/api/admin/leads', { method: 'PATCH', headers, body: JSON.stringify({ id, status }) });
    load();
  }

  async function del(id: string) {
    if (!confirm('Remove lead?')) return;
    await fetch('/api/admin/leads', { method: 'DELETE', headers, body: JSON.stringify({ id }) });
    load();
  }

  const upd = (k: keyof typeof EMPTY_LEAD, v: string) => setForm(f => ({ ...f, [k]: v }));
  const filtered = filter === 'ALL' ? leads : leads.filter(l => l.status === filter);
  const counts = LEAD_STATUSES.reduce((acc, s) => ({ ...acc, [s]: leads.filter(l => l.status === s).length }), {} as Record<string, number>);

  return (
    <div className="flex flex-col gap-6">
      {/* Stats strip */}
      <div className="grid grid-cols-5 gap-3">
        {LEAD_STATUSES.map(s => (
          <button key={s} onClick={() => setFilter(filter === s ? 'ALL' : s)}
            className={`bg-white rounded-xl border p-3 text-center transition-all ${filter === s ? 'border-sand-400 ring-1 ring-sand-300' : 'border-slate-100'}`}>
            <div className="text-2xl font-bold text-slate-800">{counts[s] ?? 0}</div>
            <div className={`text-xs font-medium mt-1 px-2 py-0.5 rounded-full inline-block ${STATUS_COLORS[s]}`}>{s}</div>
          </button>
        ))}
      </div>

      {/* Add form */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-sand-500" /> Add a lead
        </h2>
        <form onSubmit={handleAdd} className="grid grid-cols-3 gap-3">
          <input placeholder="Name *" value={form.name} onChange={e => upd('name', e.target.value)} className="input-field" />
          <input placeholder="Contact (email or FB URL) *" value={form.contact} onChange={e => upd('contact', e.target.value)} className="input-field" />
          <input placeholder="Source (FB group, HE search…)" value={form.source} onChange={e => upd('source', e.target.value)} className="input-field" />
          <input placeholder="Their location * e.g. Goa, India" value={form.location} onChange={e => upd('location', e.target.value)} className="input-field" />
          <input placeholder="Their destination * e.g. London, UK" value={form.destination} onChange={e => upd('destination', e.target.value)} className="input-field" />
          <select value={form.status} onChange={e => upd('status', e.target.value)} className="input-field">
            {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <textarea placeholder="Notes" value={form.notes} onChange={e => upd('notes', e.target.value)}
            className="input-field col-span-2 resize-none" rows={2} />
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Follow-up date</label>
            <input type="date" value={form.followUpAt} onChange={e => upd('followUpAt', e.target.value)} className="input-field w-full" />
          </div>
          <button type="submit" disabled={adding} className="col-span-3 btn-primary disabled:opacity-60">
            {adding ? <><Loader2 className="w-4 h-4 animate-spin" />Adding…</> : 'Add lead'}
          </button>
        </form>
      </div>

      {/* Leads table */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">
            {filtered.length} leads {filter !== 'ALL' && `· ${filter}`}
          </span>
          <button onClick={load} className="text-slate-400 hover:text-slate-600"><RefreshCw className="w-4 h-4" /></button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>{['Name', 'Contact', 'Route', 'Source', 'Status', 'Notes', ''].map(h =>
              <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map(l => (
              <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium whitespace-nowrap">{l.name}</td>
                <td className="px-4 py-3 text-xs text-slate-500 max-w-[160px] truncate">
                  {l.contact.startsWith('http')
                    ? <a href={l.contact} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center gap-0.5">FB Profile<ExternalLink className="w-3 h-3" /></a>
                    : l.contact}
                </td>
                <td className="px-4 py-3 text-sm whitespace-nowrap">
                  <span className="text-slate-400">{l.location}</span>
                  <ArrowRight className="w-3 h-3 text-sand-400 inline mx-1" />
                  <span className="font-medium">{l.destination}</span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{l.source}</td>
                <td className="px-4 py-3">
                  <div className="relative">
                    <select value={l.status} onChange={e => updateStatus(l.id, e.target.value)}
                      className={`text-xs font-medium px-2 py-1 rounded-full border-0 appearance-none pr-5 cursor-pointer ${STATUS_COLORS[l.status]}`}>
                      {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown className="w-3 h-3 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400 max-w-[180px] truncate">{l.notes}</td>
                <td className="px-4 py-3">
                  <button onClick={() => del(l.id)} className="text-slate-300 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No leads yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── OUTREACH TAB ───────────────────────────────────────────────────────────────
function OutreachTab({ password }: { password: string }) {
  const [fromCity, setFromCity] = useState('');
  const [fromCountry, setFromCountry] = useState('');
  const [toCity, setToCity] = useState('');
  const [toCountry, setToCountry] = useState('');
  const [listerName, setListerName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [kit, setKit] = useState<OutreachKit | null>(null);
  const [openSection, setOpenSection] = useState<string>('fbGroupPost');

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (!fromCity || !toCity) return;
    setGenerating(true);
    const res = await fetch('/api/admin/outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({ fromCity, fromCountry, toCity, toCountry, listerName }),
    });
    const data = await res.json();
    setKit(data);
    setGenerating(false);
  }

  const sections: { key: keyof OutreachKit; label: string; isText: boolean }[] = [
    { key: 'fbGroupPost', label: 'Facebook Group Post', isText: true },
    { key: 'directMessage', label: 'Direct Message (FB / WhatsApp)', isText: true },
    { key: 'emailBody', label: 'Email Body', isText: true },
    { key: 'emailSubject', label: 'Email Subject Line', isText: false },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Generator form */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-sand-500" /> Generate outreach copy
        </h2>
        <p className="text-sm text-slate-400 mb-4">Enter a city pair to get ready-to-paste messages for every channel.</p>
        <form onSubmit={generate} className="grid grid-cols-2 gap-3">
          <input placeholder="From city * e.g. Goa" value={fromCity} onChange={e => setFromCity(e.target.value)} className="input-field" />
          <input placeholder="From country * e.g. India" value={fromCountry} onChange={e => setFromCountry(e.target.value)} className="input-field" />
          <input placeholder="To city * e.g. London" value={toCity} onChange={e => setToCity(e.target.value)} className="input-field" />
          <input placeholder="To country e.g. UK" value={toCountry} onChange={e => setToCountry(e.target.value)} className="input-field" />
          <input placeholder="Lister name (optional — personalises DM)" value={listerName} onChange={e => setListerName(e.target.value)} className="input-field col-span-2" />
          <button type="submit" disabled={generating || !fromCity || !toCity} className="col-span-2 btn-primary disabled:opacity-60">
            {generating ? <><Loader2 className="w-4 h-4 animate-spin" />Generating…</> : 'Generate outreach kit'}
          </button>
        </form>
      </div>

      {kit && (
        <>
          {/* Talking points */}
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-amber-800 mb-3">Key talking points</h3>
            <ul className="space-y-1.5">
              {kit.talkingPoints.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                  <span className="text-sand-400 font-bold">·</span>{p}
                </li>
              ))}
            </ul>
          </div>

          {/* Suggested groups */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <h3 className="text-sm font-semibold mb-3 text-slate-700">Suggested Facebook groups to post in</h3>
            <div className="flex flex-wrap gap-2">
              {kit.suggestedGroups.map(g => (
                <span key={g} className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full">{g}</span>
              ))}
            </div>
          </div>

          {/* Copy sections */}
          <div className="flex flex-col gap-3">
            {sections.map(({ key, label, isText }) => (
              <div key={key} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <button
                  onClick={() => setOpenSection(openSection === key ? '' : key)}
                  className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  {label}
                  <div className="flex items-center gap-3">
                    <CopyButton text={String(kit[key])} />
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${openSection === key ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {openSection === key && (
                  <div className="px-5 pb-5">
                    {isText
                      ? <pre className="whitespace-pre-wrap text-sm text-slate-600 bg-slate-50 rounded-xl p-4 leading-relaxed font-sans">{String(kit[key])}</pre>
                      : <div className="text-sm font-medium text-slate-800 bg-slate-50 rounded-xl p-4">{String(kit[key])}</div>
                    }
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
