'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, CheckCircle, Clock, Eye, X, Sparkles, ChevronDown, ChevronRight, ThumbsUp, XCircle } from 'lucide-react';
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

const URGENCY_STYLES: Record<string, string> = {
  CRITICAL: 'text-red-400 bg-red-500/15',
  HIGH: 'text-orange-400 bg-orange-500/15',
  MEDIUM: 'text-yellow-400 bg-yellow-500/15',
  LOW: 'text-slate-400 bg-slate-500/15',
};

const SUGGESTION_STATUS_STYLES: Record<string, string> = {
  PENDING: 'text-amber-400 bg-amber-500/15',
  APPROVED: 'text-emerald-400 bg-emerald-500/15',
  DISMISSED: 'text-slate-400 bg-slate-600/15',
};

interface AiSuggestion {
  id: string;
  category: string;
  urgency: string;
  sentiment: string;
  summary: string;
  suggestedAction: string;
  suggestedReply?: string;
  status: string;
  actionPayload?: {
    dispatchData?: { suggestedRole: string; reason?: string };
    tradesmanData?: { suggestedTrade: string; reason?: string };
    jobData?: { type: string; notes?: string };
  };
}

function AiSuggestionsSection({ issueId }: { issueId: string }) {
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [acting, setActing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // The issue GET endpoint returns aiSuggestions; fall back to listing all
        const data = await api.aiSuggestions.list();
        // Filter to suggestions that may relate to this issue
        setSuggestions(data.filter((s: any) => s.issueId === issueId || s.createdIssueId === issueId));
        // Auto-expand pending
        const exp: Record<string, boolean> = {};
        data.forEach((s: any) => {
          if (s.status === 'PENDING' && (s.issueId === issueId || s.createdIssueId === issueId)) exp[s.id] = true;
        });
        setExpanded(exp);
      } catch {
        setSuggestions([]);
      }
      setLoading(false);
    })();
  }, [issueId]);

  async function handleApprove(id: string) {
    setActing(true);
    try {
      await api.aiSuggestions.approve(id);
      setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status: 'APPROVED' } : s));
    } catch {}
    setActing(false);
  }

  async function handleDismiss(id: string) {
    setActing(true);
    try {
      await api.aiSuggestions.dismiss(id);
      setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status: 'DISMISSED' } : s));
    } catch {}
    setActing(false);
  }

  if (loading) return <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (suggestions.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Sparkles size={12} className="text-amber-400" /> AI Analysis ({suggestions.length})
      </p>
      <div className="space-y-2">
        {suggestions.map(s => {
          const isExpanded = expanded[s.id];
          const isPending = s.status === 'PENDING';
          const payload = s.actionPayload || {};
          return (
            <div key={s.id} className="bg-slate-800/60 rounded-lg border border-slate-700/50 overflow-hidden">
              <button
                onClick={() => setExpanded(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
                className="w-full text-left px-4 py-3 flex items-start gap-2 hover:bg-slate-800 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 font-medium">{s.summary}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-300">{s.category}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${URGENCY_STYLES[s.urgency] || 'bg-slate-700 text-slate-300'}`}>{s.urgency}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SUGGESTION_STATUS_STYLES[s.status] || 'bg-slate-700 text-slate-300'}`}>{s.status}</span>
                  </div>
                </div>
                {isExpanded ? <ChevronDown size={16} className="text-slate-400 mt-1 shrink-0" /> : <ChevronRight size={16} className="text-slate-400 mt-1 shrink-0" />}
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-slate-700/50 pt-3">
                  {s.sentiment && (
                    <div>
                      <p className="text-xs text-slate-500">Sentiment</p>
                      <p className="text-sm text-slate-300">{s.sentiment}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-slate-500">Recommended Action</p>
                    <p className="text-sm text-slate-300">{s.suggestedAction.replace(/_/g, ' ')}</p>
                  </div>
                  {s.suggestedReply && (
                    <div>
                      <p className="text-xs text-slate-500">Next Steps</p>
                      <p className="text-sm text-slate-300">{s.suggestedReply}</p>
                    </div>
                  )}
                  {payload.dispatchData && (
                    <div>
                      <p className="text-xs text-slate-500">Dispatch Details</p>
                      <p className="text-sm text-slate-300">Role needed: {payload.dispatchData.suggestedRole}{payload.dispatchData.reason ? ` — ${payload.dispatchData.reason}` : ''}</p>
                    </div>
                  )}
                  {payload.tradesmanData && (
                    <div>
                      <p className="text-xs text-slate-500">Tradesman Details</p>
                      <p className="text-sm text-slate-300">Trade needed: {payload.tradesmanData.suggestedTrade}{payload.tradesmanData.reason ? ` — ${payload.tradesmanData.reason}` : ''}</p>
                    </div>
                  )}
                  {payload.jobData && (
                    <div>
                      <p className="text-xs text-slate-500">Job Details</p>
                      <p className="text-sm text-slate-300">Type: {payload.jobData.type}{payload.jobData.notes ? ` — ${payload.jobData.notes}` : ''}</p>
                    </div>
                  )}
                  {isPending && (
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleApprove(s.id)}
                        disabled={acting}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        <ThumbsUp size={12} /> Approve
                      </button>
                      <button
                        onClick={() => handleDismiss(s.id)}
                        disabled={acting}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        <XCircle size={12} /> Dismiss
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

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

      {/* Media */}
      {(() => {
        const mediaList: { url: string; type: string }[] =
          issue.mediaUrls && issue.mediaUrls.length > 0
            ? issue.mediaUrls
            : [
                ...(issue.photoUrl ? [{ url: issue.photoUrl, type: 'image' }] : []),
                ...(issue.videoUrl ? [{ url: issue.videoUrl, type: 'video' }] : []),
              ];
        if (mediaList.length === 0) return null;
        return (
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
              Media ({mediaList.length})
            </p>
            <div className="grid grid-cols-2 gap-2">
              {mediaList.map((m, i) =>
                m.type === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={m.url}
                    alt={`Issue media ${i + 1}`}
                    className="w-full rounded-lg border border-slate-700 object-cover max-h-72 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => window.open(m.url, '_blank')}
                  />
                ) : (
                  <video
                    key={i}
                    src={m.url}
                    controls
                    playsInline
                    className="w-full rounded-lg border border-slate-700 max-h-72 bg-black"
                  />
                )
              )}
            </div>
          </div>
        );
      })()}

      {/* AI Analysis */}
      <AiSuggestionsSection issueId={issue.id} />

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
    } catch {
      setIssues([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(id: string, status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED') {
    try {
      await api.jobs.resolveIssue(id, status);
      await load();
    } catch {}
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
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="flex-1 sm:w-44 sm:flex-none">
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_REVIEW">In review</option>
          <option value="RESOLVED">Resolved</option>
        </Select>
        <Select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="flex-1 sm:w-44 sm:flex-none">
          <option value="">All severities</option>
          <option value="HIGH">🔴 High</option>
          <option value="MEDIUM">🟡 Medium</option>
          <option value="LOW">⚪ Low</option>
        </Select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-6 py-12 text-center text-slate-500">
          No issues found
        </div>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="md:hidden space-y-3">
            {filtered.map((issue) => (
              <button
                key={issue.id}
                onClick={() => setSelected(issue)}
                className="w-full text-left bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2 active:bg-slate-800 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-slate-200 text-sm font-medium leading-snug line-clamp-2">{issue.description}</p>
                  <Eye size={15} className="text-slate-500 shrink-0 mt-0.5" />
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${SEVERITY_STYLES[issue.severity]}`}>
                    {issue.severity}
                  </span>
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[issue.status]}`}>
                    {STATUS_ICONS[issue.status]} {issue.status.replace('_', ' ')}
                  </span>
                </div>
                {issue.job && (
                  <p className="text-slate-500 text-xs">
                    {JOB_TYPE_ICONS[issue.job.type] ?? '📋'} {issue.job.type.charAt(0) + issue.job.type.slice(1).toLowerCase()} · {issue.job.property?.name}
                    {issue.job.worker && ` · ${issue.job.worker.user.name}`}
                  </p>
                )}
                <div className="flex gap-2">
                  {(() => {
                    const mediaCount = issue.mediaUrls?.length || ((issue.photoUrl ? 1 : 0) + (issue.videoUrl ? 1 : 0));
                    const imageCount = issue.mediaUrls?.filter((m: any) => m.type === 'image').length || (issue.photoUrl ? 1 : 0);
                    const videoCount = issue.mediaUrls?.filter((m: any) => m.type === 'video').length || (issue.videoUrl ? 1 : 0);
                    return (
                      <>
                        {imageCount > 0 && <span className="text-xs text-slate-500">📷 {imageCount > 1 ? `${imageCount} Photos` : 'Photo'}</span>}
                        {videoCount > 0 && <span className="text-xs text-slate-500">🎥 {videoCount > 1 ? `${videoCount} Videos` : 'Video'}</span>}
                      </>
                    );
                  })()}
                </div>
              </button>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
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
        </>
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
