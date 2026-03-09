'use client';

// Public page — no authentication required.
// Accessed by scanning a QR code label on a physical cabinet/appliance/item.

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://livaroundbackend-production.up.railway.app';

const CATEGORY_META: Record<string, { emoji: string; label: string; bg: string }> = {
  STORAGE:    { emoji: '🗄️',  label: 'Storage',   bg: '#78350f' },
  APPLIANCE:  { emoji: '🔌',  label: 'Appliance', bg: '#1e3a5f' },
  ELECTRICAL: { emoji: '⚡',  label: 'Electrical',bg: '#713f12' },
  UTILITY:    { emoji: '💧',  label: 'Utility',   bg: '#164e63' },
  ACCESS:     { emoji: '🔑',  label: 'Access',    bg: '#14532d' },
  SAFETY:     { emoji: '🧯',  label: 'Safety',    bg: '#7f1d1d' },
  PROCEDURE:  { emoji: '📋',  label: 'Procedure', bg: '#3b0764' },
  OTHER:      { emoji: '📌',  label: 'Other',     bg: '#1e293b' },
};

interface DocData {
  id: string;
  title: string;
  description: string;
  category: string;
  photos: string[];
  area?: { name: string; floor?: string };
  property?: { name: string; city: string };
}

export default function PublicDocPage() {
  const { id } = useParams<{ id: string }>();
  const [doc, setDoc] = useState<DocData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/guide/doc/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then(setDoc)
      .catch(() => setError('This QR code label could not be found.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
          <p style={{ fontSize: 18, fontWeight: 600, color: '#e2e8f0', marginBottom: 8 }}>Label not found</p>
          <p style={{ fontSize: 14 }}>{error}</p>
        </div>
      </div>
    );
  }

  const meta = CATEGORY_META[doc.category] ?? CATEGORY_META.OTHER;

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <img src={lightbox} style={{ maxHeight: '85vh', maxWidth: '100%', borderRadius: 12, objectFit: 'contain' }} />
        </div>
      )}

      {/* Category banner */}
      <div style={{ background: meta.bg, padding: '20px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 36 }}>{meta.emoji}</span>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
              {meta.label}
              {doc.property && ` · ${doc.property.name}`}
            </p>
            <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: '4px 0 0' }}>
              {doc.title}
            </h1>
            {doc.area && (
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, margin: '4px 0 0' }}>
                📍 {doc.area.name}{doc.area.floor ? ` · ${doc.area.floor}` : ''}
              </p>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 20px 40px', maxWidth: 520, margin: '0 auto' }}>
        {/* Description */}
        <div style={{ background: '#1e293b', borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <p style={{ color: '#94a3b8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px', fontWeight: 600 }}>
            Description / Instructions
          </p>
          <p style={{ color: '#e2e8f0', fontSize: 15, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
            {doc.description}
          </p>
        </div>

        {/* Photos */}
        {doc.photos.length > 0 && (
          <div style={{ background: '#1e293b', borderRadius: 16, padding: 20 }}>
            <p style={{ color: '#94a3b8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px', fontWeight: 600 }}>
              Photos
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {doc.photos.map((url, i) => {
                const src = url.startsWith('http') ? url : `${API_URL}${url}`;
                return (
                  <button
                    key={i}
                    onClick={() => setLightbox(src)}
                    style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
                  >
                    <img
                      src={src}
                      style={{ width: 130, height: 100, objectFit: 'cover', borderRadius: 10, border: '2px solid #334155' }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <p style={{ color: '#334155', fontSize: 11, textAlign: 'center', marginTop: 32 }}>
          LivAround Property Operations Guide
        </p>
      </div>
    </div>
  );
}
