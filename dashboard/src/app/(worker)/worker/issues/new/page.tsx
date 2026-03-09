'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import WorkerShell, { useLang } from '../../WorkerShell';
import { useVoiceInput } from '../../useVoice';
import { api } from '@/lib/api';

type Severity = 'LOW' | 'MEDIUM' | 'HIGH';

interface Property { id: string; name: string; city: string; _count: { issues: number } }
interface Job { id: string; type: string; scheduledAt: string; status: string }

export default function SupervisorReportIssuePage() {
  const router = useRouter();
  const [lang] = useLang();

  // Step 1: pick property
  const [properties, setProperties] = useState<Property[]>([]);
  const [loadingProps, setLoadingProps] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  // Step 2: pick job (optional)
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string>('');

  // Step 3: issue details
  const [severity, setSeverity] = useState<Severity>('MEDIUM');
  const [description, setDescription] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const appendTranscript = useCallback((text: string) => {
    setDescription(prev => prev ? `${prev} ${text}` : text);
  }, []);
  const { listening, supported: voiceSupported, start: startVoice, stop: stopVoice } = useVoiceInput(lang, appendTranscript);

  useEffect(() => {
    api.issues.myProperties()
      .then(setProperties)
      .catch(() => setProperties([]))
      .finally(() => setLoadingProps(false));
  }, []);

  async function selectProperty(p: Property) {
    setSelectedProperty(p);
    setSelectedJobId('');
    setLoadingJobs(true);
    try {
      const j = await api.jobs.list({ propertyId: p.id });
      setJobs(j);
    } catch {
      setJobs([]);
    } finally {
      setLoadingJobs(false);
    }
  }

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
    if (videoInputRef.current) videoInputRef.current.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProperty) { setError('Please select a property'); return; }
    if (description.trim().length < 5) { setError('Description must be at least 5 characters'); return; }
    setLoading(true);
    setError('');
    try {
      let uploadedVideoUrl: string | undefined;
      if (videoFile) {
        setUploading(true);
        const result = await api.upload.file(videoFile);
        uploadedVideoUrl = result.url;
        setUploading(false);
      }
      await api.issues.create({
        propertyId: selectedProperty.id,
        jobId: selectedJobId || undefined,
        description: description.trim(),
        severity,
        photoUrl: photoDataUrl ?? undefined,
        videoUrl: uploadedVideoUrl,
      });
      alert('Issue reported successfully');
      router.back();
    } catch (err) {
      setUploading(false);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const severities = [
    { value: 'LOW' as Severity,    label: 'Low',    desc: 'Minor issue, not urgent',          color: 'border-emerald-500 bg-emerald-500/10 text-emerald-400' },
    { value: 'MEDIUM' as Severity, label: 'Medium', desc: 'Needs attention soon',              color: 'border-amber-500 bg-amber-500/10 text-amber-400' },
    { value: 'HIGH' as Severity,   label: 'High',   desc: 'Urgent — affects guests or safety', color: 'border-red-500 bg-red-500/10 text-red-400' },
  ];

  return (
    <WorkerShell>
      <div className="px-5 pt-12 pb-2 flex items-center gap-4">
        <button onClick={() => router.back()} className="text-blue-400 font-semibold text-sm">← Back</button>
        <h1 className="text-lg font-bold text-white">Report Issue</h1>
      </div>

      <form onSubmit={handleSubmit} className="px-5 pt-4 pb-8 space-y-6">

        {/* Property picker */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Property *</label>
          {loadingProps ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm py-2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              Loading properties…
            </div>
          ) : properties.length === 0 ? (
            <p className="text-slate-500 text-sm">You are not assigned as supervisor to any properties.</p>
          ) : (
            <div className="space-y-2">
              {properties.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectProperty(p)}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-colors ${
                    selectedProperty?.id === p.id
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-700 bg-slate-800'
                  }`}
                >
                  <p className="font-bold text-white text-sm">{p.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{p.city} · {p._count.issues} issue{p._count.issues !== 1 ? 's' : ''} reported</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Job picker (optional) */}
        {selectedProperty && (
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Link to a Job <span className="normal-case font-normal text-slate-500">(optional)</span>
            </label>
            {loadingJobs ? (
              <div className="flex items-center gap-2 text-slate-500 text-sm py-2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                Loading jobs…
              </div>
            ) : (
              <select
                value={selectedJobId}
                onChange={e => setSelectedJobId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 text-sm"
              >
                <option value="">— No job linked —</option>
                {jobs.map(j => (
                  <option key={j.id} value={j.id}>
                    {j.type} · {new Date(j.scheduledAt).toLocaleDateString()} · {j.status}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Severity */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Severity</label>
          <div className="space-y-2">
            {severities.map(s => (
              <button
                key={s.value}
                type="button"
                onClick={() => setSeverity(s.value)}
                className={`w-full p-4 rounded-xl border-2 text-left transition-colors ${
                  severity === s.value ? s.color : 'border-slate-700 bg-slate-800'
                }`}
              >
                <p className={`font-bold ${severity === s.value ? '' : 'text-slate-300'}`}>{s.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Description + Voice */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Description *</label>
            {voiceSupported && (
              <button
                type="button"
                onClick={listening ? stopVoice : startVoice}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  listening
                    ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                    : 'bg-slate-700 text-slate-300 border border-slate-600'
                }`}
              >
                {listening ? '● Listening…' : '🎤 Speak'}
              </button>
            )}
          </div>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe the issue in detail…"
            rows={4}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-base resize-none"
          />
        </div>

        {/* Photo */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">📷 Photo</label>
          <input ref={photoInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
          {photoDataUrl ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoDataUrl} alt="Issue photo" className="w-full rounded-xl border border-slate-700 object-cover max-h-56" />
              <button
                type="button"
                onClick={() => { setPhotoDataUrl(null); if (photoInputRef.current) photoInputRef.current.value = ''; }}
                className="absolute top-2 right-2 bg-slate-900/80 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold"
              >✕</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="w-full py-4 bg-slate-800 border-2 border-dashed border-slate-600 rounded-xl text-slate-400 font-semibold text-sm flex items-center justify-center gap-2"
            >📷 Take / Upload Photo</button>
          )}
        </div>

        {/* Video */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">🎥 Video</label>
          <input ref={videoInputRef} type="file" accept="video/*" capture="environment" onChange={handleVideo} className="hidden" />
          {videoPreviewUrl ? (
            <div className="relative">
              <video src={videoPreviewUrl} controls playsInline className="w-full rounded-xl border border-slate-700 max-h-56 bg-black" />
              <button type="button" onClick={clearVideo} className="absolute top-2 right-2 bg-slate-900/80 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">✕</button>
              <p className="text-xs text-slate-500 mt-1">{videoFile ? `${(videoFile.size / 1024 / 1024).toFixed(1)} MB` : ''}</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              className="w-full py-4 bg-slate-800 border-2 border-dashed border-slate-600 rounded-xl text-slate-400 font-semibold text-sm flex items-center justify-center gap-2"
            >🎥 Record / Upload Video</button>
          )}
        </div>

        {uploading && (
          <div className="px-4 py-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 text-sm flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0" />
            Uploading video…
          </div>
        )}

        {error && (
          <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading || uploading || !selectedProperty}
          className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-bold rounded-2xl text-base transition-colors"
        >
          {uploading ? 'Uploading…' : loading ? 'Submitting…' : 'Submit Issue'}
        </button>
      </form>
    </WorkerShell>
  );
}
