'use client';

import { useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import WorkerShell, { useLang } from '../../../WorkerShell';
import { t } from '../../../i18n';
import { api } from '@/lib/api';

export default function CompleteJobPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [lang] = useLang();
  const tr = t(lang);

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
    setLoading(true);
    setError('');
    try {
      let completionPhotoUrl: string | undefined;
      let completionVideoUrl: string | undefined;

      if (photoDataUrl) {
        completionPhotoUrl = photoDataUrl;
      }
      if (videoFile) {
        setUploading(true);
        const result = await api.upload.file(videoFile);
        completionVideoUrl = result.url;
        setUploading(false);
      }

      await api.jobs.complete(id, { completionPhotoUrl, completionVideoUrl });
      alert('✅ ' + (lang === 'hi' ? 'काम पूरा हुआ! शाबाश।' : 'Job marked complete! Great work.'));
      router.push('/worker/jobs');
    } catch (err) {
      setUploading(false);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <WorkerShell>
      <div className="px-5 pt-12 pb-2 flex items-center gap-4">
        <button onClick={() => router.back()} className="text-blue-400 font-semibold text-sm">{tr.back}</button>
        <h1 className="text-lg font-bold text-slate-100">
          {lang === 'hi' ? 'काम पूरा करें' : 'Complete Job'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="px-5 pt-4 pb-8 space-y-5">
        <p className="text-sm text-slate-400">
          {lang === 'hi'
            ? 'जमा करने से पहले पूरे किए गए काम की फोटो या वीडियो जोड़ें।'
            : 'Add photos or videos of the completed work before submitting.'}
        </p>

        {/* Photo */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{tr.photo}</label>
          <input ref={photoInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
          <input ref={photoGalleryRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
          {photoDataUrl ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoDataUrl} alt="Completion photo" className="w-full rounded-xl border border-slate-700 object-cover max-h-56" />
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
            {lang === 'hi' ? 'अपलोड हो रहा है…' : 'Uploading media…'}
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
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold rounded-2xl text-base transition-colors"
        >
          {uploading
            ? (lang === 'hi' ? 'अपलोड हो रहा है…' : 'Uploading…')
            : loading
              ? (lang === 'hi' ? 'जमा हो रहा है…' : 'Submitting…')
              : (lang === 'hi' ? '✅ पूरा हुआ' : '✅ Mark Complete')}
        </button>
      </form>
    </WorkerShell>
  );
}
