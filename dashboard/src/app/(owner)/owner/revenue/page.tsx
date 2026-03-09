'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3, CheckCircle2, XCircle, Clock, Receipt, ChevronDown, ChevronUp,
  ExternalLink, ArrowLeft, TrendingUp,
} from 'lucide-react';
import { api, RevenueReport, Expense } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, FormField } from '@/components/ui/Input';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const CATEGORIES: Record<string, string> = {
  HOUSEKEEPING: 'Housekeeping',
  CONSUMABLES: 'Consumables',
  REPAIRS: 'Repairs & Maintenance',
  UTILITIES: 'Utility Bills',
  MISCELLANEOUS: 'Miscellaneous',
};

function ApprovalModal({
  expense,
  reportId,
  onDone,
  onClose,
}: {
  expense: Expense;
  reportId: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const [action, setAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.revenueReports.reviewExpense(reportId, expense.id, { action, notes: notes || undefined });
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit review');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>}

      <div className="bg-slate-800 rounded-lg p-4 space-y-1.5">
        <p className="text-sm font-medium text-slate-200">{expense.description}</p>
        <p className="text-xs text-slate-500">{CATEGORIES[expense.category]}</p>
        <p className="text-lg font-bold text-slate-100">₹{expense.amount.toLocaleString('en-IN')}</p>
        {expense.receiptUrl && (
          <div className="mt-2">
            {expense.receiptUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
              <img src={expense.receiptUrl} alt="Receipt" className="max-h-40 rounded-lg border border-slate-700" />
            ) : (
              <a href={expense.receiptUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-brand-400 hover:underline">
                <ExternalLink size={11} /> View receipt
              </a>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {(['APPROVE', 'REJECT'] as const).map((a) => (
          <label key={a} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border cursor-pointer transition-colors ${
            action === a
              ? a === 'APPROVE'
                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                : 'border-red-500/50 bg-red-500/10 text-red-400'
              : 'border-slate-700 text-slate-500'
          }`}>
            <input type="radio" name="action" value={a} checked={action === a}
              onChange={() => setAction(a)} className="hidden" />
            {a === 'APPROVE' ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
            <span className="text-sm font-medium">{a === 'APPROVE' ? 'Approve' : 'Reject'}</span>
          </label>
        ))}
      </div>

      <FormField label="Notes (optional)">
        <Input placeholder="Any comments or reason for rejection..."
          value={notes} onChange={(e) => setNotes(e.target.value)} />
      </FormField>

      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={onClose} className="flex-1 justify-center">Cancel</Button>
        <Button type="submit" loading={loading} className="flex-1 justify-center">Submit review</Button>
      </div>
    </form>
  );
}

function ExpenseReviewRow({
  expense,
  reportId,
  onRefresh,
}: {
  expense: Expense;
  reportId: string;
  onRefresh: () => void;
}) {
  const [reviewModal, setReviewModal] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const isPending = expense.requiresApproval && expense.approvalStatus === 'PENDING';
  const isApproved = expense.approvalStatus === 'APPROVED';
  const isRejected = expense.approvalStatus === 'REJECTED';

  return (
    <div className={`border rounded-lg overflow-hidden ${isPending ? 'border-amber-500/30 bg-amber-500/5' : 'border-slate-800'}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-slate-200">{expense.description}</span>
            <span className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">{CATEGORIES[expense.category]}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${expense.expenseType === 'OWNER_ONLY' ? 'text-purple-400 bg-purple-500/10' : 'text-blue-400 bg-blue-500/10'}`}>
              {expense.expenseType === 'OWNER_ONLY' ? 'Owner only' : 'Shared'}
            </span>
          </div>
          {expense.approverNotes && (
            <p className="text-xs text-slate-500 mt-0.5 italic">"{expense.approverNotes}"</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm font-semibold text-slate-200">₹{expense.amount.toLocaleString('en-IN')}</span>
          {expense.requiresApproval && (
            <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
              isPending ? 'text-amber-400 bg-amber-500/10' :
              isApproved ? 'text-emerald-400 bg-emerald-500/10' :
              'text-red-400 bg-red-500/10'
            }`}>
              {isPending && <><Clock size={10} /> Pending</>}
              {isApproved && <><CheckCircle2 size={10} /> Approved</>}
              {isRejected && <><XCircle size={10} /> Rejected</>}
            </span>
          )}
          {expense.receiptUrl && (
            <button onClick={() => setExpanded((v) => !v)} className="text-slate-500 hover:text-slate-300">
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          )}
          {isPending && (
            <Button variant="secondary" onClick={() => setReviewModal(true)} className="text-xs py-1 px-2 h-auto">
              Review
            </Button>
          )}
        </div>
      </div>

      {expanded && expense.receiptUrl && (
        <div className="px-4 pb-4 border-t border-slate-800/50">
          <p className="text-xs text-slate-500 mb-2 mt-3">Receipt</p>
          {expense.receiptUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
            <img src={expense.receiptUrl} alt="Receipt" className="max-h-64 rounded-lg border border-slate-700" />
          ) : (
            <a href={expense.receiptUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-brand-400 text-sm hover:underline">
              <ExternalLink size={13} /> View receipt
            </a>
          )}
        </div>
      )}

      <Modal open={reviewModal} onClose={() => setReviewModal(false)} title="Review expense">
        <ApprovalModal
          expense={expense}
          reportId={reportId}
          onDone={onRefresh}
          onClose={() => setReviewModal(false)}
        />
      </Modal>
    </div>
  );
}

function ReportCard({ report, onRefresh }: { report: RevenueReport; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const totalExpenses = report.expenses.reduce((s, e) => s + e.amount, 0);
  const netPayable = report.netRevenue - report.commissionAmount - totalExpenses;
  const pendingApprovals = report.expenses.filter((e) => e.requiresApproval && e.approvalStatus === 'PENDING').length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div
        className="flex items-start justify-between px-5 py-4 cursor-pointer hover:bg-slate-800/30 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold text-slate-100">{MONTHS[report.month - 1]} {report.year}</p>
            {pendingApprovals > 0 && (
              <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full font-medium">
                {pendingApprovals} needs review
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">{report.property?.name} · {report.property?.city}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-slate-500">Net payable to you</p>
            <p className={`font-bold ${netPayable >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              ₹{netPayable.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </div>
          {expanded ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-800 p-5 space-y-5">
          {/* Revenue breakdown */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Gross revenue (Airbnb)</span>
              <span className="text-slate-200">₹{report.grossRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </div>
            {report.airbnbServiceFees > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-400">Airbnb fees</span>
                <span className="text-slate-400">−₹{report.airbnbServiceFees.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-400">Net from Airbnb</span>
              <span className="text-slate-200">₹{report.netRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Management commission ({report.commissionPct}%)</span>
              <span className="text-amber-400">−₹{report.commissionAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </div>
            {totalExpenses > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-400">Expenses</span>
                <span className="text-red-400">−₹{totalExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
            )}
            <div className="border-t border-slate-800 pt-2 flex justify-between font-semibold">
              <span className="text-slate-200">Net to you</span>
              <span className={netPayable >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                ₹{netPayable.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>

          {/* Expenses requiring approval */}
          {report.expenses.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Expenses</p>
              {report.expenses.map((expense) => (
                <ExpenseReviewRow
                  key={expense.id}
                  expense={expense}
                  reportId={report.id}
                  onRefresh={onRefresh}
                />
              ))}
            </div>
          )}

          {report.notes && (
            <div className="bg-slate-800/50 rounded-lg px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">Notes from manager</p>
              <p className="text-sm text-slate-300">{report.notes}</p>
            </div>
          )}

          {report.airbnbReportUrl && (
            <a href={report.airbnbReportUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-brand-400 hover:underline">
              <ExternalLink size={11} /> View Airbnb report
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function OwnerRevenuePage() {
  const router = useRouter();
  const [reports, setReports] = useState<RevenueReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await api.revenueReports.ownerReports();
      setReports(r);
    } finally {
      setLoading(false);
    }
  }

  const totalNet = reports.reduce((s, r) => {
    const exp = r.expenses.reduce((es, e) => es + e.amount, 0);
    return s + r.netRevenue - r.commissionAmount - exp;
  }, 0);
  const pendingApprovals = reports.reduce((s, r) =>
    s + r.expenses.filter((e) => e.requiresApproval && e.approvalStatus === 'PENDING').length, 0);

  return (
    <div className="min-h-screen bg-slate-950 pb-12">
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <button onClick={() => router.push('/owner/dashboard')} className="text-slate-400 hover:text-slate-200">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="font-semibold text-slate-100 flex items-center gap-2">
            <BarChart3 size={16} className="text-brand-400" /> Revenue Reports
          </h1>
          <p className="text-xs text-slate-500">Monthly earnings statements from your manager</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-16 text-slate-600">
            <BarChart3 size={40} className="mx-auto mb-3 opacity-40" />
            <p>No revenue reports yet.</p>
            <p className="text-sm mt-1">Your property manager will publish monthly statements here.</p>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wider mb-2">
                  <TrendingUp size={12} /> Total net earnings
                </div>
                <p className={`text-2xl font-bold ${totalNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  ₹{totalNet.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-slate-600 mt-1">{reports.length} {reports.length === 1 ? 'report' : 'reports'}</p>
              </div>
              {pendingApprovals > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-xs text-amber-500 uppercase tracking-wider mb-2">
                    <Clock size={12} /> Awaiting your review
                  </div>
                  <p className="text-2xl font-bold text-amber-400">{pendingApprovals}</p>
                  <p className="text-xs text-slate-500 mt-1">expense{pendingApprovals > 1 ? 's' : ''} need approval</p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {reports.map((r) => <ReportCard key={r.id} report={r} onRefresh={load} />)}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
