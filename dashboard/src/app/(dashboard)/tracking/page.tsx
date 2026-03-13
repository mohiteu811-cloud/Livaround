'use client';

import { useEffect, useState, useRef } from 'react';
import { MapPin, RefreshCw } from 'lucide-react';
import { api, Worker } from '@/lib/api';
import dynamic from 'next/dynamic';

const WorkerMap = dynamic(() => import('@/components/WorkerMap'), { ssr: false });

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

interface WorkerWithLoc extends Worker {
  lastSeen?: string;
}

export default function TrackingPage() {
  const [workers, setWorkers] = useState<WorkerWithLoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    try {
      const ws = await api.workers.list();
      // Fetch locations for all workers in parallel
      const withLoc = await Promise.all(
        ws.map(async (w) => {
          try {
            const loc = await api.workers.getLocation(w.id);
            return {
              ...w,
              latitude: loc.latitude ?? undefined,
              longitude: loc.longitude ?? undefined,
              lastSeen: loc.updatedAt,
            };
          } catch {
            return w;
          }
        })
      );
      setWorkers(withLoc);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 15000); // refresh every 15s
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const trackableWorkers = workers.filter((w) => w.latitude && w.longitude);
  const selectedWorker = workers.find((w) => w.id === selected);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Worker Tracking</h1>
          <p className="text-slate-400 text-sm mt-1">
            {trackableWorkers.length} of {workers.length} workers with live location
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); load(); }}
          className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Map */}
        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden" style={{ height: 500 }}>
          {loading && trackableWorkers.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : trackableWorkers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
              <MapPin size={48} />
              <p className="text-lg font-medium">No worker locations yet</p>
              <p className="text-sm">Workers will appear here once they open the app and share their location.</p>
            </div>
          ) : (
            <WorkerMap
              workers={trackableWorkers.map((w) => ({
                id: w.id,
                name: w.user.name,
                latitude: w.latitude!,
                longitude: w.longitude!,
                isAvailable: w.isAvailable,
                lastSeen: w.lastSeen,
              }))}
              selectedId={selected}
              onSelect={setSelected}
            />
          )}
        </div>

        {/* Worker list */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800">
            <p className="text-sm font-semibold text-slate-200">Workers</p>
          </div>
          <div className="divide-y divide-slate-800 max-h-[440px] overflow-y-auto">
            {workers.map((w) => {
              const hasLoc = !!(w.latitude && w.longitude);
              const isSelected = selected === w.id;
              return (
                <button
                  key={w.id}
                  onClick={() => setSelected(isSelected ? null : w.id)}
                  className={`w-full text-left px-4 py-3 transition-colors ${
                    isSelected ? 'bg-brand-600/10' : 'hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${hasLoc ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                    <span className="text-sm font-medium text-slate-200 truncate">{w.user.name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 ml-4">
                    {hasLoc ? (
                      <span className="text-xs text-slate-500">{timeAgo(w.lastSeen!)}</span>
                    ) : (
                      <span className="text-xs text-slate-600">No location</span>
                    )}
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      w.isAvailable ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
                    }`}>
                      {w.isAvailable ? 'Available' : 'Unavailable'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
