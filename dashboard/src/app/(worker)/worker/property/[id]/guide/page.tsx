'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import WorkerShell from '../../../WorkerShell';
import { api, PropertyGuide, PropertyArea, PropertyDoc, PropertyContact } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://livaroundbackend-production.up.railway.app';

const CATEGORY_META: Record<string, { emoji: string; label: string }> = {
  STORAGE:    { emoji: '🗄️',  label: 'Storage' },
  APPLIANCE:  { emoji: '🔌',  label: 'Appliance' },
  ELECTRICAL: { emoji: '⚡',  label: 'Electrical' },
  UTILITY:    { emoji: '💧',  label: 'Utility' },
  ACCESS:     { emoji: '🔑',  label: 'Access' },
  SAFETY:     { emoji: '🧯',  label: 'Safety' },
  PROCEDURE:  { emoji: '📋',  label: 'Procedure' },
  OTHER:      { emoji: '📌',  label: 'Other' },
};

function WorkerDocCard({ doc }: { doc: PropertyDoc }) {
  const meta = CATEGORY_META[doc.category] ?? CATEGORY_META.OTHER;
  const [lightbox, setLightbox] = useState<string | null>(null);

  return (
    <div className="bg-slate-700/50 border border-slate-600 rounded-2xl p-4 space-y-3">
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} className="max-h-[85vh] max-w-full rounded-xl object-contain" />
          <button className="absolute top-4 right-4 text-white text-2xl font-bold">✕</button>
        </div>
      )}

      <div className="flex items-start gap-3">
        <span className="text-2xl">{meta.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-base leading-tight">{doc.title}</p>
          <span className="text-xs text-slate-400 bg-slate-700 px-2 py-0.5 rounded mt-1 inline-block">{meta.label}</span>
        </div>
      </div>

      <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">{doc.description}</p>

      {doc.photos.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Photos</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {doc.photos.map((url, i) => {
              const src = url.startsWith('http') ? url : `${API_URL}${url}`;
              return (
                <button key={i} onClick={() => setLightbox(src)} className="flex-shrink-0">
                  <img src={src} className="h-24 w-32 object-cover rounded-xl border border-slate-600" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function WorkerAreaSection({ area }: { area: PropertyArea }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="space-y-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between bg-slate-700 rounded-2xl px-4 py-3 text-left"
      >
        <div>
          <p className="text-white font-semibold">{area.name}</p>
          {area.floor && <p className="text-xs text-slate-400">{area.floor}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{area.docs.length} item{area.docs.length !== 1 ? 's' : ''}</span>
          <span className="text-slate-400 text-lg">{open ? '▾' : '▸'}</span>
        </div>
      </button>

      {open && area.docs.length > 0 && (
        <div className="space-y-3 pl-2">
          {area.docs.map((doc) => <WorkerDocCard key={doc.id} doc={doc} />)}
        </div>
      )}

      {open && area.docs.length === 0 && (
        <p className="text-sm text-slate-600 italic pl-4">No items documented in this area.</p>
      )}
    </div>
  );
}

function WorkerContactCard({ contact }: { contact: PropertyContact }) {
  return (
    <div className="bg-slate-700/50 border border-slate-600 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">{contact.agency}</p>
          {contact.company && <p className="text-xs text-slate-400 mt-0.5">{contact.company}</p>}
          {contact.name && <p className="text-xs text-slate-300 mt-1">{contact.name}</p>}
          {contact.notes && <p className="text-xs text-slate-500 mt-1 italic">{contact.notes}</p>}
        </div>
        {contact.phones.length > 0 && (
          <div className="flex flex-col gap-1.5 items-end flex-shrink-0">
            {contact.phones.map((phone, i) => (
              <a
                key={i}
                href={`tel:${phone.replace(/\s/g, '')}`}
                className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-xl text-xs font-semibold"
              >
                📞 {phone}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Supervisor Audit Form ─────────────────────────────────────────────────────

function AuditForm({ jobId, onDone }: { jobId: string; onDone: () => void }) {
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit() {
    if (!rating || !notes.trim()) return;
    setSaving(true);
    try {
      await api.guide.submitAudit(jobId, { rating, notes });
      setSaved(true);
      setTimeout(onDone, 1200);
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 text-center">
        <p className="text-2xl mb-2">✅</p>
        <p className="text-emerald-400 font-semibold">Audit submitted!</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-700/50 border border-amber-500/20 rounded-2xl p-4 space-y-4">
      <p className="text-amber-400 font-semibold text-sm flex items-center gap-2">🔍 Submit Audit Report</p>

      <div>
        <p className="text-xs text-slate-400 mb-2">Work Quality Rating</p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setRating(n)}
              className={`w-10 h-10 rounded-xl text-lg transition-colors ${rating >= n ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-500'}`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-slate-400 mb-1">Audit Notes</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Describe what you observed during the inspection..."
          className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-amber-500 resize-none"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={!rating || !notes.trim() || saving}
        className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm disabled:opacity-50 transition-colors"
      >
        {saving ? 'Submitting…' : 'Submit Audit'}
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function WorkerPropertyGuidePage() {
  const router = useRouter();
  const { id: propertyId } = useParams<{ id: string }>();
  const jobId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('jobId') : null;
  const isSupervisor = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('supervisor') === '1' : false;

  const [guide, setGuide] = useState<PropertyGuide | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'docs' | 'contacts'>('docs');
  const [showAudit, setShowAudit] = useState(false);

  useEffect(() => {
    api.guide.get(propertyId)
      .then(setGuide)
      .catch(() => router.back())
      .finally(() => setLoading(false));
  }, [propertyId, router]);

  if (loading) {
    return (
      <WorkerShell>
        <div className="flex justify-center pt-32">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </WorkerShell>
    );
  }

  return (
    <WorkerShell>
      <div className="px-5 pt-12 pb-2 flex items-center justify-between">
        <button onClick={() => router.back()} className="text-blue-400 font-semibold text-sm">← Back</button>
        <span className="text-slate-400 text-sm font-semibold">📖 Property Guide</span>
      </div>

      {/* Tab bar */}
      <div className="px-5 pt-3 pb-2 flex gap-2">
        <button
          onClick={() => setTab('docs')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${tab === 'docs' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}
        >
          📂 Areas & Docs
        </button>
        <button
          onClick={() => setTab('contacts')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${tab === 'contacts' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}
        >
          📞 Contacts
        </button>
      </div>

      <div className="px-5 pb-10 space-y-4">
        {/* Supervisor audit button */}
        {isSupervisor && jobId && (
          <div>
            {showAudit ? (
              <AuditForm jobId={jobId} onDone={() => setShowAudit(false)} />
            ) : (
              <button
                onClick={() => setShowAudit(true)}
                className="w-full py-3 rounded-2xl border border-amber-500/30 text-amber-400 font-semibold text-sm"
              >
                🔍 Submit Audit Report for This Job
              </button>
            )}
          </div>
        )}

        {tab === 'docs' && (
          <>
            {(guide?.areas.length === 0 && guide?.ungroupedDocs.length === 0) && (
              <div className="text-center py-12 text-slate-500">
                <p className="text-2xl mb-2">📖</p>
                <p>No documentation available yet.</p>
                <p className="text-xs mt-1">Your host will add property docs here.</p>
              </div>
            )}

            {guide?.areas.map((area) => (
              <WorkerAreaSection key={area.id} area={area} />
            ))}

            {(guide?.ungroupedDocs.length ?? 0) > 0 && (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold px-1">General</p>
                {guide?.ungroupedDocs.map((doc) => <WorkerDocCard key={doc.id} doc={doc} />)}
              </div>
            )}
          </>
        )}

        {tab === 'contacts' && (
          <>
            {guide?.contacts.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <p className="text-2xl mb-2">📞</p>
                <p>No contacts added yet.</p>
              </div>
            )}
            {guide?.contacts.map((contact) => (
              <WorkerContactCard key={contact.id} contact={contact} />
            ))}
          </>
        )}
      </div>
    </WorkerShell>
  );
}
