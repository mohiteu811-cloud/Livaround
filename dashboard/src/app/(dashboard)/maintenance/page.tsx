'use client';

import { useEffect, useState } from 'react';
import { ClipboardList, CheckCircle, XCircle, Clock, ChevronDown, User } from 'lucide-react';
import { api, MaintenanceRequest, Property, Worker, TradeRole } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'text-slate-400 bg-slate-800',
  MEDIUM: 'text-amber-400 bg-amber-500/10',
  HIGH: 'text-orange-400 bg-orange-500/10',
  URGENT: 'text-red-400 bg-red-500/10',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-amber-400 bg-amber-500/10',
  APPROVED: 'text-blue-400 bg-blue-500/10',
  AUTO_ASSIGNED: 'text-purple-400 bg-purple-500/10',
  ASSIGNED: 'text-indigo-400 bg-indigo-500/10',
  IN_PROGRESS: 'text-cyan-400 bg-cyan-500/10',
  COMPLETED: 'text-emerald-400 bg-emerald-500/10',
  REJECTED: 'text-red-400 bg-red-500/10',
};

function ReviewModal({
  request,
  workers,
  onDone,
  onClose,
}: {
  request: MaintenanceRequest;
  workers: Worker[];
  onDone: () => void;
  onClose: () => void;
}) {
  const [action, setAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [assignedWorkerId, setAssignedWorkerId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [hostNotes, setHostNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filter workers with the matching trade role
  const eligibleWorkers = request.tradeRoleId
    ? workers.filter((w) => (w as Worker & { tradeRoleId?: string }).tradeRoleId === request.tradeRoleId)
    : workers;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.maintenance.review(request.id, {
        action,
        assignedWorkerId: action === 'APPROVE' ? assignedWorkerId || undefined : undefined,
        scheduledAt: action === 'APPROVE' ? scheduledAt || undefined : undefined,
        hostNotes: hostNotes || undefined,
      });
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to review');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>}

      <div className="bg-slate-800/50 rounded-lg p-4 space-y-2">
        <p className="text-sm font-medium text-slate-200">{request.title}</p>
        <p className="text-xs text-slate-400">{request.description}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[request.priority]}`}>{request.priority}</span>
          {request.tradeRole && (
            <span className="text-xs text-slate-500">· {request.tradeRole.name}</span>
          )}
          <span className="text-xs text-slate-500">· {request.property?.name}</span>
        </div>
        {request.photoUrl && (
          <img src={request.photoUrl} alt="Issue photo" className="w-full h-32 object-cover rounded-lg mt-2" />
        )}
      </div>

      <div>
        <p className="text-sm font-medium text-slate-300 mb-2">Decision</p>
        <div className="flex gap-2">
          {(['APPROVE', 'REJECT'] as const).map((a) => (
            <button
              key={a} type="button"
              onClick={() => setAction(a)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                action === a
                  ? a === 'APPROVE' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {a === 'APPROVE' ? <span className="flex items-center justify-center gap-1"><CheckCircle size={14} /> Approve</span>
                : <span className="flex items-center justify-center gap-1"><XCircle size={14} /> Reject</span>}
            </button>
          ))}
        </div>
      </div>

      {action === 'APPROVE' && (
        <>
          <FormField label="Assign tradesperson (optional — can be assigned later)">
            <select
              value={assignedWorkerId}
              onChange={(e) => setAssignedWorkerId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-brand-500"
            >
              <option value="">Leave unassigned</option>
              {eligibleWorkers.map((w) => (
                <option key={w.id} value={w.id}>{w.user.name}</option>
              ))}
              {eligibleWorkers.length === 0 && workers.length > 0 && workers.map((w) => (
                <option key={w.id} value={w.id}>{w.user.name} (no matching trade)</option>
              ))}
            </select>
          </FormField>
          <FormField label="Scheduled date (optional)">
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </FormField>
        </>
      )}

      <FormField label="Notes to caretaker (optional)">
        <Input placeholder="Any instructions or reason..." value={hostNotes} onChange={(e) => setHostNotes(e.target.value)} />
      </FormField>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onClose} className="flex-1 justify-center">Cancel</Button>
        <Button type="submit" loading={loading} className="flex-1 justify-center">Confirm</Button>
      </div>
    </form>
  );
}

export default function MaintenancePage() {
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [reviewing, setReviewing] = useState<MaintenanceRequest | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { load(); }, [statusFilter, priorityFilter]);

  async function load() {
    setLoading(true);
    try {
      const [reqs, wks] = await Promise.all([
        api.maintenance.list({
          ...(statusFilter && { status: statusFilter }),
          ...(priorityFilter && { priority: priorityFilter }),
        }),
        api.workers.list(),
      ]);
      setRequests(reqs);
      setWorkers(wks);
    } finally {
      setLoading(false);
    }
  }

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Maintenance Requests</h1>
          <p className="text-slate-400 text-sm mt-1">
            {pendingCount > 0 ? <span className="text-amber-400 font-medium">{pendingCount} awaiting review</span> : 'All requests up to date'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm focus:outline-none focus:border-brand-500"
        >
          <option value="">All statuses</option>
          {['PENDING', 'APPROVED', 'AUTO_ASSIGNED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'].map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm focus:outline-none focus:border-brand-500"
        >
          <option value="">All priorities</option>
          {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center py-16 gap-3">
          <ClipboardList size={40} className="text-slate-600" />
          <p className="text-slate-400">No maintenance requests</p>
          <p className="text-slate-600 text-sm">Requests raised by caretakers & cleaners will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-colors">
              <div
                className="flex items-center justify-between p-4 cursor-pointer"
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex-shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] || 'text-slate-400 bg-slate-800'}`}>
                      {r.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-slate-100 font-medium text-sm truncate">{r.title}</p>
                    <p className="text-xs text-slate-500">
                      {r.property?.name} · {new Date(r.createdAt).toLocaleDateString()} · by {r.reportedBy?.user.name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {r.tradeRole && (
                    <span className="hidden sm:block text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                      {r.tradeRole.name}
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[r.priority]}`}>{r.priority}</span>
                  {r.status === 'PENDING' && (
                    <Button
                      onClick={(e) => { e.stopPropagation(); setReviewing(r); }}
                      className="text-xs py-1 px-2 h-auto"
                    >
                      Review
                    </Button>
                  )}
                  <ChevronDown size={15} className={`text-slate-600 transition-transform ${expanded === r.id ? 'rotate-180' : ''}`} />
                </div>
              </div>

              {expanded === r.id && (
                <div className="border-t border-slate-800 p-4 space-y-3">
                  <p className="text-sm text-slate-400">{r.description}</p>
                  {r.photoUrl && <img src={r.photoUrl} alt="Issue photo" className="rounded-lg h-48 w-auto object-cover" />}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {r.assignedWorker && (
                      <div>
                        <p className="text-slate-600 mb-1">Assigned to</p>
                        <p className="text-slate-300 flex items-center gap-1"><User size={11} /> {r.assignedWorker.user.name}</p>
                      </div>
                    )}
                    {r.scheduledAt && (
                      <div>
                        <p className="text-slate-600 mb-1">Scheduled</p>
                        <p className="text-slate-300 flex items-center gap-1"><Clock size={11} /> {new Date(r.scheduledAt).toLocaleString()}</p>
                      </div>
                    )}
                    {r.hostNotes && (
                      <div className="col-span-2">
                        <p className="text-slate-600 mb-1">Host notes</p>
                        <p className="text-slate-400">{r.hostNotes}</p>
                      </div>
                    )}
                    {r.job && (
                      <div>
                        <p className="text-slate-600 mb-1">Linked job</p>
                        <p className="text-slate-300">{r.job.status}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {reviewing && (
        <Modal open onClose={() => setReviewing(null)} title="Review maintenance request">
          <ReviewModal
            request={reviewing}
            workers={workers}
            onDone={load}
            onClose={() => setReviewing(null)}
          />
        </Modal>
      )}
    </div>
  );
}
