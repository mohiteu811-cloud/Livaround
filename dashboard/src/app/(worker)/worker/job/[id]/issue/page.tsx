'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import WorkerShell from '../../../WorkerShell';
import { api } from '@/lib/api';

const SEVERITIES = [
  { value: 'LOW',    label: 'Low',    desc: 'Minor / non-urgent',      color: 'border-emerald-500 bg-emerald-500/10 text-emerald-400' },
  { value: 'MEDIUM', label: 'Medium', desc: 'Needs attention soon',     color: 'border-amber-500 bg-amber-500/10 text-amber-400' },
  { value: 'HIGH',   label: 'High',   desc: 'Urgent / safety concern',  color: 'border-red-500 bg-red-500/10 text-red-400' },
] as const;

type Severity = 'LOW' | 'MEDIUM' | 'HIGH';

export default function ReportIssuePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [severity, setSeverity] = useState<Severity>('MEDIUM');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (description.trim().length < 5) { setError('Please describe the issue (min 5 chars).'); return; }
    setLoading(true);
    setError('');
    try {
      await api.jobs.reportIssue(id, { description: description.trim(), severity });
      alert('Issue reported. The host has been notified.');
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <WorkerShell>
      <div className="px-5 pt-12 pb-2 flex items-center gap-4">
        <button onClick={() => router.back()} className="text-blue-400 font-semibold text-sm">← Back</button>
        <h1 className="text-lg font-bold text-white">Report Issue</h1>
      </div>

      <form onSubmit={handleSubmit} className="px-5 pt-4 pb-8 space-y-5">
        {/* Severity */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Severity</label>
          <div className="space-y-2">
            {SEVERITIES.map(s => (
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

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe the issue in detail…"
            rows={5}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-base resize-none"
          />
        </div>

        {error && (
          <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-bold rounded-2xl text-base transition-colors"
        >
          {loading ? 'Submitting…' : '⚠️ Submit Issue Report'}
        </button>
      </form>
    </WorkerShell>
  );
}
