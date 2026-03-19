'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import WorkerShell, { useLang } from '../../../WorkerShell';
import { useVoiceInput } from '../../../useVoice';
import { t } from '../../../i18n';
import { api } from '@/lib/api';

type Severity = 'LOW' | 'MEDIUM' | 'HIGH';

export default function ReportIssuePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [lang] = useLang();
  const tr = t(lang);

  const [severity, setSeverity] = useState<Severity>('MEDIUM');
  const [description, setDescription] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoGalleryRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoGalleryRef = useRef<HTMLInputElement>(null);

  const appendTranscript = useCallback((text: string) => {
    setDescription(prev => prev ? `${prev} ${text}` : text);
  }, []);

  const { listening, supported: voiceSupported, start: startVoice, stop: stopVoice } = useVoiceInput(lang, appendTranscript);

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
    if (videoGalleryRef.current) videoGalleryRef.current.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (description.trim().length < 5) { setError(tr.descriptionRequired); return; }
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

      await api.jobs.reportIssue(id, {
        description: description.trim(),
        severity,
        photoUrl: photoDataUrl ?? undefined,
        videoUrl: uploadedVideoUrl,
      });
      alert(tr.issueSubmitted);
      router.back();
    } catch (err) {
      setUploading(false);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const severities = [
    { value: 'LOW' as Severity,    label: tr.low,    desc: tr.lowDesc,    color: 'border-emerald-500 bg-emerald-500/10 text-emerald-400' },
    { value: 'MEDIUM' as Severity, label: tr.medium, desc: tr.mediumDesc, color: 'border-amber-500 bg-amber-500/10 text-amber-400' },
    { value: 'HIGH' as Severity,   label: tr.high,   desc: tr.highDesc,   color: 'border-red-500 bg-red-500/10 text-red-400' },
  ];

  return (
    <WorkerShell>
      <div className="px-5 pt-12 pb-2 flex items-center gap-4">
        <button onClick={() => router.back()} className="text-blue-400 font-semibold text-sm">{tr.back}</button>
        <h1 className="text-lg font-bold text-white">{tr.reportIssueTitle}</h1>
      </div>

      <form onSubmit={handleSubmit} className="px-5 pt-4 pb-8 space-y-5">
        {/* Severity */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{tr.severity}</label>
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
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{tr.description}</label>
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
                {listening ? tr.listening : tr.tapToSpeak}
              </button>
            )}
          </div>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={tr.descriptionPlaceholder}
            rows={4}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-base resize-none"
          />
          {listening && (
            <p className="text-xs text-red-400 mt-1 animate-pulse">● {lang === 'hi' ? 'हिंदी में बोलें…' : 'Speak now…'}</p>
          )}
        </div>

        {/* Photo */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{tr.photo}</label>
          <input ref={photoInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
          <input ref={photoGalleryRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
          {photoDataUrl ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoDataUrl} alt="Issue photo" className="w-full rounded-xl border border-slate-700 object-cover max-h-56" />
              <button
                type="button"
                onClick={() => { setPhotoDataUrl(null); if (photoInputRef.current) photoInputRef.current.value = ''; if (photoGalleryRef.current) photoGalleryRef.current.value = ''; }}
                className="absolute top-2 right-2 bg-slate-900/80 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold"
              >✕</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => photoInputRef.current?.click()}
                className="py-4 bg-slate-800 border-2 border-dashed border-slate-600 rounded-xl text-slate-400 font-semibold text-sm flex items-center justify-center gap-2">
                📷 {lang === 'hi' ? 'फोटो लें' : 'Take photo'}
              </button>
              <button type="button" onClick={() => photoGalleryRef.current?.click()}
                className="py-4 bg-slate-800 border-2 border-dashed border-slate-600 rounded-xl text-slate-400 font-semibold text-sm flex items-center justify-center gap-2">
                📁 {lang === 'hi' ? 'अपलोड' : 'Upload'}
              </button>
            </div>
          )}
        </div>

        {/* Video */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            🎥 {lang === 'hi' ? 'वीडियो' : 'Video'}
          </label>
          <input ref={videoInputRef} type="file" accept="video/*" capture="environment" onChange={handleVideo} className="hidden" />
          <input ref={videoGalleryRef} type="file" accept="video/*" onChange={handleVideo} className="hidden" />
          {videoPreviewUrl ? (
            <div className="relative">
              <video src={videoPreviewUrl} controls playsInline className="w-full rounded-xl border border-slate-700 max-h-56 bg-black" />
              <button type="button" onClick={clearVideo} className="absolute top-2 right-2 bg-slate-900/80 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">✕</button>
              <p className="text-xs text-slate-500 mt-1">{videoFile ? `${(videoFile.size / 1024 / 1024).toFixed(1)} MB` : ''}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => videoInputRef.current?.click()}
                className="py-4 bg-slate-800 border-2 border-dashed border-slate-600 rounded-xl text-slate-400 font-semibold text-sm flex items-center justify-center gap-2">
                🎥 {lang === 'hi' ? 'रिकॉर्ड करें' : 'Record'}
              </button>
              <button type="button" onClick={() => videoGalleryRef.current?.click()}
                className="py-4 bg-slate-800 border-2 border-dashed border-slate-600 rounded-xl text-slate-400 font-semibold text-sm flex items-center justify-center gap-2">
                📁 {lang === 'hi' ? 'अपलोड' : 'Upload'}
              </button>
            </div>
          )}
        </div>

        {uploading && (
          <div className="px-4 py-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 text-sm flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0" />
            {lang === 'hi' ? 'वीडियो अपलोड हो रहा है…' : 'Uploading video…'}
          </div>
        )}

        {error && (
          <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || uploading}
          className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-bold rounded-2xl text-base transition-colors"
        >
          {uploading ? (lang === 'hi' ? 'अपलोड हो रहा है…' : 'Uploading…') : loading ? tr.submitting : tr.submitIssue}
        </button>
      </form>
    </WorkerShell>
  );
}
