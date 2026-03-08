'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, CheckCircle, Clock, Eye, X } from 'lucide-react';
import { api, JobIssue } from '@/lib/api';
import { Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

const JOB_TYPE_ICONS: Record<string, string> = {
  CLEANING: '🧹',
  COOKING: '🍳',
  DRIVING: '🚗',
  MAINTENANCE: '🔧',
};

const SEVERITY_STYLES: Record<string, string> = {
  LOW: 'bg-slate-700 text-slate-300',
  MEDIUM: 'bg-amber-500/20 text-amber-400',
  HIGH: 'bg-red-500/20 text-red-400',
};

const STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-red-500/15 text-red-400',
  IN_REVIEW: 'bg-amber-500/15 text-amber-400',
  RESOLVED: 'bg-emerald-500/15 text-emerald-400',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  OPEN: <AlertTriangle size={12} />,
  IN_REVIEW: <Clock size={12} />,
  RESOLVED: <CheckCircle size={12} />,
};

function IssueDetailModal({ issue, onClose, onStatusChange }: {
  issue: JobIssue;
  onClose: () => void;
  onStatusChange: (id: string, status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED') => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  async function handleStatus(s: 'OPEN' | 'IN_REVIEW' | 'RESOLVED') {
    setLoading(true);
    try { await onStatusChange(issue.id, s); onClose(); } finally { setLoading(false); }
  }

  return (
    <div className="space-y-5">
      {/* Meta row */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className={`flex items-center gap-1 px-2 py-1 rounded-full font-medium ${SEVERITY_STYLES[issue.severity]}`}>
          {issue.severity} severity
        </span>
        <span className={`flex items-center gap-1 px-2 py-1 rounded-full font-medium ${STATUS_STYLES[issue.status]}`}>
          {STATUS_ICONS[issue.status]} {issue.status.replace('_', ' ')}
        </span>
        <span className="px-2 py-1 rounded-full bg-slate-800 text-slate-400">
          {format(new Date(issue.createdAt), 'dd MMM yyyy, HH:mm')}
        </span>
      </div>

      {/* Job info */}
      {issue.job && (
        <div className="bg-slate-800/60 rounded-lg p-4 text-sm space-y-1.5">
          <div className="flex items-center gap-2 text-slate-200 font-medium">
            <span>{JOB_TYPE_ICONS[issue.job.type] ?? '📋'}</span>
            <span>{issue.job.type.charAt(0) + issue.job.type.slice(1).toLowerCase()} job</span>
          </div>
          {issue.job.property && (
            <p className="text-slate-400">📍 {issue.job.property.name}</p>
          )}
          {issue.job.worker && (
            <p className="text-slate-400">👷 {issue.job.worker.user.name}</p>
          )}
          <p className="text-slate-500 text-xs">
            Scheduled {format(new Date(issue.job.scheduledAt), 'dd MMM yyyy, HH:mm')}
          </p>
        </div>
      )}

      {/* Description */}
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Description</p>
        <p className="text-slate-300 text-sm leading-relaxed">{issue.description}</p>
      </div>

      {/* Photo */}
      {issue.photoUrl && (
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Photo</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={issue.photoUrl}
            alt="Issue photo"
            className="w-full rounded-lg border border-slate-700 object-cover max-h-72"
          />
        </div>
      )}

      {/* Actions */}
      {issue.status !== 'RESOLVED' && (
        <div className="flex gap-3 pt-1">
          <Button variant="secondary" onClick={onClose} className="flex-1 justify-center">
            <X size={14} /> Close
          </Button>
          {issue.status === 'OPEN' && (
            <Button loading={loading} onClick={() => handleStatus('IN_REVIEW')}
              className="flex-1 justify-center bg-amber-600 hover:bg-amber-500 text-white">
              <Clock size={14} /> Mark in review
            </Button>
          )}
          <Button loading={loading} onClick={() => handleStatus('RESOLVED')}
            className="flex-1 justify-center bg-emerald-600 hover:bg-emerald-500 text-white">
            <CheckCircle size={14} /> Resolve
          </Button>
        </div>
      )}
    </div>
  );
}

export default function IssuesPage() {
  const [issues, setIssues] = useState<JobIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [selected, setSelected] = useState<JobIssue | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await api.jobs.listIssues();
      setIssues(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(id: string, status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED') {
    await api.jobs.resolveIssue(id, status);
    await load();
  }

  const filtered = issues.filter((i) =>
    (!severityFilter || i.severity === severityFilter) &&
    (!statusFilter || i.status === statusFilter)
  );

  const openCount = issues.filter((i) => i.status === 'OPEN').length;
  const highCount = issues.filter((i) => i.severity === 'HIGH' && i.status !== 'RESOLVED').length;

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Issues</h1>
        <p className="text-slate-400 text-sm mt-1">
          {openCount} open{highCount > 0 ? ` · ${highCount} high severity` : ''}
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-44">
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_REVIEW">In review</option>
          <option value="RESOLVED">Resolved</option>
        </Select>
        <Select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="w-44">
          <option value="">All severities</option>
          <option value="HIGH">🔴 High</option>
          <option value="MEDIUM">🟡 Medium</option>
          <option value="LOW">⚪ Low</option>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
                <th className="text-left px-6 py-3">Issue</th>
                <th className="text-left px-6 py-3">Job / Property</th>
                <th className="text-left px-6 py-3">Worker</th>
                <th className="text-left px-6 py-3">Severity</th>
                <th className="text-left px-6 py-3">Status</th>
                <th className="text-left px-6 py-3">Reported</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">No issues found</td>
                </tr>
              )}
              {filtered.map((issue) => (
                <tr key={issue.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 max-w-xs">
                    <p className="text-slate-200 truncate">{issue.description}</p>
                    {issue.photoUrl && (
                      <span className="text-xs text-slate-500 mt-0.5 block">📷 Has photo</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {issue.job ? (
                      <div>
                        <p className="text-slate-300 text-xs">
                          {JOB_TYPE_ICONS[issue.job.type] ?? '📋'} {issue.job.type.charAt(0) + issue.job.type.slice(1).toLowerCase()}
                        </p>
                        <p className="text-slate-500 text-xs">{issue.job.property?.name}</p>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-xs">
                    {issue.job?.worker?.user.name ?? <span className="text-slate-600 italic">Unknown</span>}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_STYLES[issue.severity]}`}>
                      {issue.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium w-fit ${STATUS_STYLES[issue.status]}`}>
                      {STATUS_ICONS[issue.status]} {issue.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-xs">
                    {format(new Date(issue.createdAt), 'dd MMM, HH:mm')}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setSelected(issue)}
                      className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                      title="View details"
                    >
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <Modal open={!!selected} onClose={() => setSelected(null)} title="Issue detail">
          <IssueDetailModal
            issue={selected}
            onClose={() => setSelected(null)}
            onStatusChange={handleStatusChange}
          />
        </Modal>
      )}
    </div>
  );
}
