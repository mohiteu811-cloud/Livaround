'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, Trash2, ChevronDown, ChevronRight,
  Phone, Building2, FolderOpen, Image as ImageIcon, BookOpen, Pencil, X, Check, QrCode,
} from 'lucide-react';
import { api, PropertyGuide, PropertyArea, PropertyDoc, PropertyContact, Property } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { QRCodeModal } from '@/components/ui/QRCodeModal';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://livarounddashboard-production.up.railway.app';

type DocCategory = 'STORAGE' | 'APPLIANCE' | 'ELECTRICAL' | 'UTILITY' | 'ACCESS' | 'SAFETY' | 'PROCEDURE' | 'OTHER';

const CATEGORY_META: Record<DocCategory, { label: string; emoji: string; color: string }> = {
  STORAGE:   { label: 'Storage',   emoji: '🗄️',  color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  APPLIANCE: { label: 'Appliance', emoji: '🔌',  color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  ELECTRICAL:{ label: 'Electrical',emoji: '⚡',  color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  UTILITY:   { label: 'Utility',   emoji: '💧',  color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  ACCESS:    { label: 'Access',    emoji: '🔑',  color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  SAFETY:    { label: 'Safety',    emoji: '🧯',  color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  PROCEDURE: { label: 'Procedure', emoji: '📋',  color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  OTHER:     { label: 'Other',     emoji: '📌',  color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://livaroundbackend-production.up.railway.app';

// ── Doc Card ─────────────────────────────────────────────────────────────────

function DocCard({ doc, onEdit, onDelete }: { doc: PropertyDoc; onEdit: () => void; onDelete: () => void }) {
  const meta = CATEGORY_META[doc.category] ?? CATEGORY_META.OTHER;
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-3">
      <QRCodeModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        url={`${APP_URL}/guide/doc/${doc.id}`}
        title={doc.title}
        subtitle={`${meta.emoji} ${meta.label}`}
        instructions="Scan to see contents, photos & instructions"
      />
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain" />
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-lg">{meta.emoji}</span>
          <div className="min-w-0">
            <p className="text-slate-100 font-semibold text-sm leading-tight">{doc.title}</p>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs border mt-0.5 ${meta.color}`}>
              {meta.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => setQrOpen(true)} title="Print label QR" className="p-1.5 rounded hover:bg-slate-700 text-slate-500 hover:text-brand-400 transition-colors">
            <QrCode size={13} />
          </button>
          <button onClick={onEdit} className="p-1.5 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors">
            <Pencil size={13} />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded hover:bg-slate-700 text-slate-500 hover:text-red-400 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <p className="text-slate-400 text-sm whitespace-pre-wrap leading-relaxed">{doc.description}</p>

      {doc.photos.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {doc.photos.map((url, i) => (
            <button key={i} onClick={() => setLightbox(url.startsWith('http') ? url : `${API_URL}${url}`)}>
              <img
                src={url.startsWith('http') ? url : `${API_URL}${url}`}
                className="h-20 w-28 object-cover rounded-lg border border-slate-600 hover:border-brand-500 transition-colors"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Area Section ──────────────────────────────────────────────────────────────

function AreaSection({
  area, propertyId, onRefresh,
}: { area: PropertyArea; propertyId: string; onRefresh: () => void }) {
  const [open, setOpen] = useState(true);
  const [docModal, setDocModal] = useState(false);
  const [editDoc, setEditDoc] = useState<PropertyDoc | null>(null);

  async function handleDeleteArea() {
    if (!confirm(`Delete area "${area.name}" and all its docs?`)) return;
    await api.guide.deleteArea(propertyId, area.id);
    onRefresh();
  }

  async function handleDeleteDoc(docId: string) {
    if (!confirm('Delete this doc entry?')) return;
    await api.guide.deleteDoc(propertyId, docId);
    onRefresh();
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-800/40 transition-colors" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-3">
          {open ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
          <div>
            <p className="font-semibold text-slate-200 text-sm">{area.name}</p>
            {area.floor && <p className="text-xs text-slate-500">{area.floor}</p>}
          </div>
          <span className="text-xs text-slate-600">{area.docs.length} item{area.docs.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            onClick={() => setDocModal(true)}
            className="text-xs py-1 px-2 h-auto"
          >
            <Plus size={12} /> Add Doc
          </Button>
          <button onClick={handleDeleteArea} className="p-1.5 rounded hover:bg-slate-700 text-slate-600 hover:text-red-400 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-800 pt-3">
          {area.description && <p className="text-xs text-slate-500 italic">{area.description}</p>}
          {area.docs.length === 0 ? (
            <p className="text-sm text-slate-600 italic text-center py-4">No items documented yet. Add a doc entry above.</p>
          ) : (
            area.docs.map((doc) => (
              <DocCard
                key={doc.id}
                doc={doc}
                onEdit={() => setEditDoc(doc)}
                onDelete={() => handleDeleteDoc(doc.id)}
              />
            ))
          )}
        </div>
      )}

      {(docModal || editDoc) && (
        <Modal
          open={true}
          onClose={() => { setDocModal(false); setEditDoc(null); }}
          title={editDoc ? 'Edit doc entry' : `Add doc to: ${area.name}`}
        >
          <DocForm
            propertyId={propertyId}
            areaId={area.id}
            initial={editDoc ?? undefined}
            onSave={() => { setDocModal(false); setEditDoc(null); onRefresh(); }}
            onCancel={() => { setDocModal(false); setEditDoc(null); }}
          />
        </Modal>
      )}
    </div>
  );
}

// ── Doc Form ─────────────────────────────────────────────────────────────────

function DocForm({
  propertyId, areaId, initial, onSave, onCancel,
}: {
  propertyId: string;
  areaId?: string;
  initial?: PropertyDoc;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [category, setCategory] = useState(initial?.category ?? 'OTHER');
  const [photos, setPhotos] = useState<string[]>(initial?.photos ?? []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of files) {
        const result = await api.upload.file(file);
        urls.push(result.url);
      }
      setPhotos((prev) => [...prev, ...urls]);
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!title.trim() || !description.trim()) return;
    setSaving(true);
    try {
      if (initial) {
        await api.guide.updateDoc(propertyId, initial.id, { title, description, category: category as PropertyDoc['category'], photos });
      } else {
        await api.guide.createDoc(propertyId, { areaId, title, description, category, photos });
      }
      onSave();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-slate-400 mb-1">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Cleaning Equipment Cabinet"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-brand-500"
        />
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1">Category</label>
        <div className="grid grid-cols-4 gap-1.5">
          {Object.entries(CATEGORY_META).map(([key, meta]) => (
            <button
              key={key}
              type="button"
              onClick={() => setCategory(key as DocCategory)}
              className={`py-1.5 px-1 rounded-lg text-xs font-medium transition-colors border ${category === key ? 'bg-brand-600 text-white border-brand-600' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}
            >
              {meta.emoji} {meta.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1">Description / Instructions</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Describe what it is, where it is, how to use it..."
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-brand-500 resize-none"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-slate-400">Photos</label>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"
          >
            <Plus size={12} /> {uploading ? 'Uploading…' : 'Add photos'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
        </div>
        {photos.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {photos.map((url, i) => (
              <div key={i} className="relative group">
                <img
                  src={url.startsWith('http') ? url : `${API_URL}${url}`}
                  className="h-20 w-28 object-cover rounded-lg border border-slate-600"
                />
                <button
                  onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={10} className="text-white" />
                </button>
              </div>
            ))}
          </div>
        )}
        {photos.length === 0 && (
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-slate-700 rounded-xl py-6 text-center cursor-pointer hover:border-slate-600 transition-colors"
          >
            <ImageIcon size={20} className="mx-auto text-slate-600 mb-1" />
            <p className="text-xs text-slate-600">Click to upload photos</p>
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1 justify-center">Cancel</Button>
        <Button loading={saving} onClick={handleSave} className="flex-1 justify-center" disabled={!title.trim() || !description.trim()}>
          {initial ? 'Save changes' : 'Add entry'}
        </Button>
      </div>
    </div>
  );
}

// ── Contact Row ───────────────────────────────────────────────────────────────

function ContactRow({ contact, propertyId, onRefresh }: { contact: PropertyContact; propertyId: string; onRefresh: () => void }) {
  const [editing, setEditing] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete contact "${contact.agency}"?`)) return;
    await api.guide.deleteContact(propertyId, contact.id);
    onRefresh();
  }

  if (editing) {
    return (
      <ContactForm
        propertyId={propertyId}
        initial={contact}
        onSave={() => { setEditing(false); onRefresh(); }}
        onCancel={() => setEditing(false)}
        inline
      />
    );
  }

  return (
    <div className="flex items-start justify-between gap-3 py-3 border-b border-slate-800 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-slate-200">{contact.agency}</p>
          {contact.company && (
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Building2 size={10} /> {contact.company}
            </span>
          )}
        </div>
        {contact.name && <p className="text-xs text-slate-400 mt-0.5">{contact.name}</p>}
        {contact.phones.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {contact.phones.map((phone, i) => (
              <a key={i} href={`tel:${phone.replace(/\s/g, '')}`} className="text-xs text-brand-400 flex items-center gap-1 hover:text-brand-300">
                <Phone size={10} /> {phone}
              </a>
            ))}
          </div>
        )}
        {contact.notes && <p className="text-xs text-slate-600 mt-1 italic">{contact.notes}</p>}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={() => setEditing(true)} className="p-1.5 rounded hover:bg-slate-800 text-slate-600 hover:text-slate-300 transition-colors">
          <Pencil size={13} />
        </button>
        <button onClick={handleDelete} className="p-1.5 rounded hover:bg-slate-800 text-slate-600 hover:text-red-400 transition-colors">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ── Contact Form ──────────────────────────────────────────────────────────────

function ContactForm({
  propertyId, initial, onSave, onCancel, inline,
}: {
  propertyId: string;
  initial?: PropertyContact;
  onSave: () => void;
  onCancel: () => void;
  inline?: boolean;
}) {
  const [agency, setAgency] = useState(initial?.agency ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [phones, setPhones] = useState<string[]>(initial?.phones ?? ['']);
  const [company, setCompany] = useState(initial?.company ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [saving, setSaving] = useState(false);

  function addPhone() { setPhones((p) => [...p, '']); }
  function setPhone(i: number, val: string) { setPhones((p) => p.map((v, j) => j === i ? val : v)); }
  function removePhone(i: number) { setPhones((p) => p.filter((_, j) => j !== i)); }

  async function handleSave() {
    if (!agency.trim()) return;
    setSaving(true);
    const cleanPhones = phones.filter((p) => p.trim());
    try {
      if (initial) {
        await api.guide.updateContact(propertyId, initial.id, { agency, name: name || undefined, phones: cleanPhones, company: company || undefined, notes: notes || undefined });
      } else {
        await api.guide.createContact(propertyId, { agency, name: name || undefined, phones: cleanPhones, company: company || undefined, notes: notes || undefined });
      }
      onSave();
    } finally {
      setSaving(false);
    }
  }

  const cls = inline
    ? 'bg-slate-800/60 border border-slate-700 rounded-xl p-3 space-y-3'
    : 'space-y-4';

  return (
    <div className={cls}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Agency / Trade *</label>
          <input value={agency} onChange={(e) => setAgency(e.target.value)} placeholder="e.g. Electrician"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-brand-500" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Contact Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Eknath Baragundi"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-brand-500" />
        </div>
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1">Phone Numbers</label>
        {phones.map((phone, i) => (
          <div key={i} className="flex gap-2 mb-1.5">
            <input value={phone} onChange={(e) => setPhone(i, e.target.value)} placeholder="+91 98765 43210"
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-brand-500" />
            {phones.length > 1 && (
              <button onClick={() => removePhone(i)} className="p-2 rounded text-slate-500 hover:text-red-400">
                <X size={14} />
              </button>
            )}
          </div>
        ))}
        <button onClick={addPhone} className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 mt-0.5">
          <Plus size={11} /> Add another number
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Company</label>
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. TAG Engineers"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-brand-500" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Notes</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-brand-500" />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1 justify-center text-xs py-1.5 h-auto">Cancel</Button>
        <Button loading={saving} onClick={handleSave} className="flex-1 justify-center text-xs py-1.5 h-auto" disabled={!agency.trim()}>
          {initial ? <><Check size={12} /> Save</> : <><Plus size={12} /> Add</>}
        </Button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PropertyGuidePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [property, setProperty] = useState<Property | null>(null);
  const [guide, setGuide] = useState<PropertyGuide | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'areas' | 'contacts'>('areas');
  const [areaModal, setAreaModal] = useState(false);
  const [contactModal, setContactModal] = useState(false);
  const [entryQrOpen, setEntryQrOpen] = useState(false);

  // Area form state
  const [areaName, setAreaName] = useState('');
  const [areaFloor, setAreaFloor] = useState('');
  const [areaDesc, setAreaDesc] = useState('');
  const [savingArea, setSavingArea] = useState(false);

  useEffect(() => { load(); }, [id]);

  async function load() {
    setLoading(true);
    try {
      const [prop, g] = await Promise.all([api.properties.get(id), api.guide.get(id)]);
      setProperty(prop);
      setGuide(g);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateArea() {
    if (!areaName.trim()) return;
    setSavingArea(true);
    try {
      await api.guide.createArea(id, { name: areaName, floor: areaFloor || undefined, description: areaDesc || undefined });
      setAreaModal(false);
      setAreaName(''); setAreaFloor(''); setAreaDesc('');
      await load();
    } finally {
      setSavingArea(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Entry QR modal */}
      <QRCodeModal
        open={entryQrOpen}
        onClose={() => setEntryQrOpen(false)}
        url={`${APP_URL}/worker/checkin/${id}`}
        title={property?.name ?? 'Property Check-in'}
        subtitle={property?.city}
        instructions="Workers: scan on arrival to view your job and mark check-in"
      />

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-100">{property?.name} — Operations Guide</h1>
          <p className="text-slate-400 text-sm mt-0.5">Documented areas, equipment locations, procedures, and vendor contacts for staff reference</p>
        </div>
        <Button variant="secondary" onClick={() => setEntryQrOpen(true)} className="flex-shrink-0 text-xs py-1.5 px-3 h-auto">
          <QrCode size={13} /> Entry QR
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/50 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('areas')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${tab === 'areas' ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <FolderOpen size={15} /> Docs & Areas
          {guide && <span className="text-xs text-slate-500">({guide.areas.length})</span>}
        </button>
        <button
          onClick={() => setTab('contacts')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${tab === 'contacts' ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <Phone size={15} /> Vendor Contacts
          {guide && <span className="text-xs text-slate-500">({guide.contacts.length})</span>}
        </button>
      </div>

      {/* ── Docs & Areas tab ── */}
      {tab === 'areas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Document each room, cabinet, appliance, and procedure so new staff can quickly get up to speed.
            </p>
            <Button onClick={() => setAreaModal(true)} className="flex-shrink-0">
              <Plus size={14} /> Add Area
            </Button>
          </div>

          {guide?.areas.length === 0 && guide?.ungroupedDocs.length === 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl py-16 text-center space-y-3">
              <BookOpen size={32} className="mx-auto text-slate-700" />
              <p className="text-slate-400 font-medium">No documentation yet</p>
              <p className="text-sm text-slate-600 max-w-sm mx-auto">
                Start by creating an area (e.g. "Ground Floor Kitchen") then add doc entries for cabinets, appliances, and procedures with photos.
              </p>
              <Button onClick={() => setAreaModal(true)} className="mx-auto">
                <Plus size={14} /> Create first area
              </Button>
            </div>
          )}

          {guide?.areas.map((area) => (
            <AreaSection key={area.id} area={area} propertyId={id} onRefresh={load} />
          ))}

          {(guide?.ungroupedDocs.length ?? 0) > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-400">Uncategorised docs</p>
              {guide?.ungroupedDocs.map((doc) => (
                <DocCard
                  key={doc.id}
                  doc={doc}
                  onEdit={() => {}} // TODO: edit modal
                  onDelete={async () => { await api.guide.deleteDoc(id, doc.id); load(); }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Contacts tab ── */}
      {tab === 'contacts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Vendor and service contacts provided by your architect, contractor, and building management.
            </p>
            <Button onClick={() => setContactModal(true)} className="flex-shrink-0">
              <Plus size={14} /> Add Contact
            </Button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4">
            {guide?.contacts.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <Phone size={28} className="mx-auto text-slate-700" />
                <p className="text-slate-400">No contacts yet</p>
                <Button onClick={() => setContactModal(true)} className="mx-auto">
                  <Plus size={14} /> Add first contact
                </Button>
              </div>
            ) : (
              guide?.contacts.map((contact) => (
                <ContactRow key={contact.id} contact={contact} propertyId={id} onRefresh={load} />
              ))
            )}
          </div>
        </div>
      )}

      {/* Area modal */}
      <Modal open={areaModal} onClose={() => setAreaModal(false)} title="Add area / room">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Area Name *</label>
            <input value={areaName} onChange={(e) => setAreaName(e.target.value)} placeholder="e.g. 1st Floor Laundry Room"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-brand-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Floor / Zone</label>
            <input value={areaFloor} onChange={(e) => setAreaFloor(e.target.value)} placeholder="e.g. 1st Floor, Outdoor, Common Area"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-brand-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Description (optional)</label>
            <input value={areaDesc} onChange={(e) => setAreaDesc(e.target.value)} placeholder="Brief description of this area"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-brand-500" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setAreaModal(false)} className="flex-1 justify-center">Cancel</Button>
            <Button loading={savingArea} onClick={handleCreateArea} className="flex-1 justify-center" disabled={!areaName.trim()}>
              Create area
            </Button>
          </div>
        </div>
      </Modal>

      {/* Contact modal */}
      <Modal open={contactModal} onClose={() => setContactModal(false)} title="Add vendor contact">
        <ContactForm
          propertyId={id}
          onSave={() => { setContactModal(false); load(); }}
          onCancel={() => setContactModal(false)}
        />
      </Modal>
    </div>
  );
}
