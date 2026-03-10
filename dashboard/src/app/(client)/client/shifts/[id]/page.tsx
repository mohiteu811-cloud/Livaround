'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, Shift, ShiftApplication } from '@/lib/api';
import { ArrowLeft, MapPin, Clock, Users, Star, Ban, Phone, Mail } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  PARTIALLY_FILLED: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  FILLED: 'text-green-400 bg-green-400/10 border-green-400/20',
  IN_PROGRESS: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  COMPLETED: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
  CANCELLED: 'text-red-400 bg-red-400/10 border-red-400/20',
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  PARTIALLY_FILLED: 'Partially filled',
  FILLED: 'Filled',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const APP_STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-yellow-400 bg-yellow-400/10',
  CONFIRMED: 'text-green-400 bg-green-400/10',
  WITHDRAWN: 'text-slate-500 bg-slate-500/10',
  NO_SHOW: 'text-red-400 bg-red-400/10',
  COMPLETED: 'text-blue-400 bg-blue-400/10',
};

function RatingModal({
  app,
  onRate,
  onClose,
}: {
  app: ShiftApplication;
  onRate: (appId: string, rating: number, note: string) => Promise<void>;
  onClose: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      await onRate(app.id, rating, note);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm">
        <h3 className="text-base font-semibold text-slate-100 mb-1">
          Rate {app.worker?.user.name}
        </h3>
        <p className="text-xs text-slate-400 mb-5">How did they perform?</p>

        <div className="flex gap-2 mb-4 justify-center">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              onClick={() => setRating(s)}
              className={`text-2xl transition-transform ${s <= rating ? 'scale-110' : 'opacity-30'}`}
            >
              ★
            </button>
          ))}
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note…"
          rows={2}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-brand-500 placeholder:text-slate-600 resize-none mb-4"
        />

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex-1 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading ? 'Saving…' : 'Submit rating'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ShiftDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [shift, setShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [ratingApp, setRatingApp] = useState<ShiftApplication | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.shifts.get(id)
      .then((s) => setShift(s))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  async function handleCancel() {
    if (!confirm('Cancel this shift? Workers will lose their confirmed spots.')) return;
    setCancelling(true);
    try {
      await api.shifts.cancel(id);
      setShift((s) => s ? { ...s, status: 'CANCELLED' } : s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel');
    } finally {
      setCancelling(false);
    }
  }

  async function handleRate(appId: string, rating: number, note: string) {
    await api.shifts.rate(id, appId, { rating, note: note || undefined });
    setShift((s) => {
      if (!s) return s;
      return {
        ...s,
        applications: s.applications?.map((a) =>
          a.id === appId ? { ...a, clientRating: rating, clientNote: note } : a
        ),
      };
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!shift) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-400">Shift not found</p>
        <Link href="/client/shifts" className="mt-4 inline-block text-brand-400">Back to shifts</Link>
      </div>
    );
  }

  const confirmedApps = shift.applications?.filter((a) => ['CONFIRMED', 'COMPLETED'].includes(a.status)) ?? [];
  const pendingApps = shift.applications?.filter((a) => a.status === 'PENDING') ?? [];
  const withdrawnApps = shift.applications?.filter((a) => ['WITHDRAWN', 'NO_SHOW'].includes(a.status)) ?? [];

  const currencySymbol = shift.currency === 'INR' ? '₹' : shift.currency;
  const canCancel = !['COMPLETED', 'CANCELLED'].includes(shift.status);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {ratingApp && (
        <RatingModal
          app={ratingApp}
          onRate={handleRate}
          onClose={() => setRatingApp(null)}
        />
      )}

      <div className="flex items-center gap-3 mb-6">
        <Link href="/client/shifts" className="p-2 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-slate-100">
              {shift.role.charAt(0) + shift.role.slice(1).toLowerCase()}
            </h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${STATUS_COLORS[shift.status]}`}>
              {STATUS_LABELS[shift.status]}
            </span>
            {shift.urgency === 'ASAP' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 font-medium">
                ASAP
              </span>
            )}
          </div>
        </div>
        {canCancel && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-50"
          >
            <Ban size={14} />
            Cancel
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>
      )}

      {/* Shift details */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="flex items-start gap-3">
            <MapPin size={16} className="text-slate-500 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs text-slate-500 mb-0.5">Venue</div>
              <div className="text-sm text-slate-200 font-medium">{shift.venue?.name}</div>
              <div className="text-xs text-slate-400">{shift.venue?.address}</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Clock size={16} className="text-slate-500 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs text-slate-500 mb-0.5">Schedule</div>
              <div className="text-sm text-slate-200 font-medium">{shift.date}</div>
              <div className="text-xs text-slate-400">{shift.startTime} – {shift.endTime}</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Users size={16} className="text-slate-500 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs text-slate-500 mb-0.5">Workers</div>
              <div className="text-sm text-slate-200 font-medium">
                {confirmedApps.length} / {shift.workersNeeded} confirmed
              </div>
              <div className="text-xs text-slate-400">{currencySymbol}{shift.hourlyRate}/hr</div>
            </div>
          </div>
        </div>

        {shift.requirements.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-800">
            <div className="text-xs text-slate-500 mb-2">Requirements</div>
            <div className="flex flex-wrap gap-2">
              {shift.requirements.map((r) => (
                <span key={r} className="text-xs px-2.5 py-1 bg-slate-800 text-slate-300 rounded-lg">{r}</span>
              ))}
            </div>
          </div>
        )}

        {shift.notes && (
          <div className="mt-4 pt-4 border-t border-slate-800">
            <div className="text-xs text-slate-500 mb-1">Notes</div>
            <p className="text-sm text-slate-300">{shift.notes}</p>
          </div>
        )}
      </div>

      {/* Confirmed workers */}
      {confirmedApps.length > 0 && (
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">
            Confirmed workers ({confirmedApps.length})
          </h2>
          <div className="space-y-2">
            {confirmedApps.map((app) => (
              <div key={app.id} className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-green-400/20 flex items-center justify-center text-green-400 text-sm font-bold">
                      {app.worker?.user.name?.charAt(0) ?? '?'}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-100">{app.worker?.user.name}</div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {app.worker?.user.phone && (
                          <a href={`tel:${app.worker.user.phone}`} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200">
                            <Phone size={11} />
                            {app.worker.user.phone}
                          </a>
                        )}
                        {app.worker?.user.email && (
                          <a href={`mailto:${app.worker.user.email}`} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200">
                            <Mail size={11} />
                            {app.worker.user.email}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${APP_STATUS_COLORS[app.status]}`}>
                      {app.status.toLowerCase()}
                    </span>
                    {app.checkIn?.checkInAt && (
                      <span className="text-xs text-green-400">
                        In {app.checkIn.checkInAt.slice(11, 16)}
                        {app.checkIn.checkOutAt && ` · Out ${app.checkIn.checkOutAt.slice(11, 16)}`}
                        {app.checkIn.hoursWorked && ` · ${app.checkIn.hoursWorked}h`}
                      </span>
                    )}
                    {app.status === 'COMPLETED' && !app.clientRating && (
                      <button
                        onClick={() => setRatingApp(app)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-brand-600/20 hover:bg-brand-600/40 text-brand-400 text-xs rounded-lg transition-colors"
                      >
                        <Star size={12} />
                        Rate
                      </button>
                    )}
                    {app.clientRating && (
                      <div className="flex items-center gap-1 text-yellow-400 text-xs">
                        <Star size={12} fill="currentColor" />
                        {app.clientRating}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending applications */}
      {pendingApps.length > 0 && (
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">
            Pending applications ({pendingApps.length})
          </h2>
          <div className="space-y-2">
            {pendingApps.map((app) => (
              <div key={app.id} className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-yellow-400/20 flex items-center justify-center text-yellow-400 text-sm font-bold">
                    {app.worker?.user.name?.charAt(0) ?? '?'}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-100">{app.worker?.user.name}</div>
                    <div className="text-xs text-slate-400">Applied {new Date(app.createdAt).toLocaleDateString()}</div>
                  </div>
                  <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${APP_STATUS_COLORS[app.status]}`}>
                    {app.status.toLowerCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Withdrawn */}
      {withdrawnApps.length > 0 && (
        <details className="mb-5">
          <summary className="text-sm text-slate-500 cursor-pointer mb-2">
            Withdrawn / No-show ({withdrawnApps.length})
          </summary>
          <div className="space-y-2 mt-2">
            {withdrawnApps.map((app) => (
              <div key={app.id} className="p-3 bg-slate-900/50 border border-slate-800/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 text-sm font-bold">
                    {app.worker?.user.name?.charAt(0) ?? '?'}
                  </div>
                  <div className="text-sm text-slate-400">{app.worker?.user.name}</div>
                  <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${APP_STATUS_COLORS[app.status]}`}>
                    {app.status.toLowerCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {shift.applications?.length === 0 && !['CANCELLED', 'COMPLETED'].includes(shift.status) && (
        <div className="text-center py-10 bg-slate-900/50 border border-slate-800 rounded-xl">
          <Users size={28} className="text-slate-600 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">Waiting for workers to apply</p>
          <p className="text-slate-600 text-xs mt-1">Push notifications sent to workers in {shift.venue?.city}</p>
        </div>
      )}
    </div>
  );
}
