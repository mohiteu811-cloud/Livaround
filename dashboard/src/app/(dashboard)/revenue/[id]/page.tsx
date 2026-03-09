'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, Trash2, Receipt, CheckCircle2, XCircle, Clock,
  Send, ExternalLink, ChevronDown, ChevronUp
} from 'lucide-react';
import { api, RevenueReport, Expense } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input, FormField } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const CATEGORIES = [
  { value: 'HOUSEKEEPING', label: 'Housekeeping' },
  { value: 'CONSUMABLES', label: 'Consumables' },
  { value: 'REPAIRS', label: 'Repairs & Maintenance' },
  { value: 'UTILITIES', label: 'Utility Bills' },
  { value: 'MISCELLANEOUS', label: 'Miscellaneous' },
];

const APPROVAL_STATUS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PENDING: { label: 'Pending', color: 'text-amber-400 bg-amber-500/10', icon: Clock },
  APPROVED: { label: 'Approved', color: 'text-emerald-400 bg-emerald-500/10', icon: CheckCircle2 },
  REJECTED: { label: 'Rejected', color: 'text-red-400 bg-red-500/10', icon: XCircle },
};

function AddExpenseModal({
  reportId,
  onSave,
  onClose,
}: {
  reportId: string;
  onSave: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    category: 'HOUSEKEEPING',
    description: '',
    amount: '',
    expenseType: 'SHARED',
    requiresApproval: false,
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function set(k: string, v: string | boolean) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      let receiptUrl: string | undefined;
      if (receiptFile) {
        const uploaded = await api.upload.file(receiptFile);
        receiptUrl = uploaded.url;
      }

      await api.revenueReports.addExpense(reportId, {
        category: form.category,
        description: form.description,
        amount: parseFloat(form.amount),
        expenseType: form.expenseType,
        receiptUrl,
        requiresApproval: form.requiresApproval,
      });

      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add expense');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>}

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Category">
          <select
            value={form.category}
            onChange={(e) => set('category', e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-brand-500"
          >
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </FormField>
        <FormField label="Amount (INR)">
          <Input type="number" min="0" step="0.01" placeholder="1482"
            value={form.amount} onChange={(e) => set('amount', e.target.value)} required />
        </FormField>
      </div>

      <FormField label="Description">
        <Input placeholder="e.g. Toiletries and cleaning supplies — Jimmy's Supermarket"
          value={form.description} onChange={(e) => set('description', e.target.value)} required />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Expense type">
          <div className="flex gap-2">
            {[{ v: 'SHARED', l: 'Shared' }, { v: 'OWNER_ONLY', l: 'Owner only' }].map(({ v, l }) => (
              <label key={v} className="flex-1 flex items-center gap-2 cursor-pointer">
                <input type="radio" name="expenseType" value={v}
                  checked={form.expenseType === v}
                  onChange={() => set('expenseType', v)}
                  className="accent-brand-500"
                />
                <span className="text-sm text-slate-300">{l}</span>
              </label>
            ))}
          </div>
        </FormField>
        <FormField label="Owner approval">
          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <input
              type="checkbox"
              checked={form.requiresApproval}
              onChange={(e) => set('requiresApproval', e.target.checked)}
              className="accent-brand-500"
            />
            <span className="text-sm text-slate-300">Requires owner sign-off</span>
          </label>
        </FormField>
      </div>

      {/* Receipt upload */}
      <FormField label="Receipt / proof of expense">
        <div
          className="border border-dashed border-slate-700 rounded-lg p-4 text-center cursor-pointer hover:border-brand-500/50 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
            onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} />
          {receiptFile ? (
            <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm">
              <CheckCircle2 size={14} />
              <span>{receiptFile.name}</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-slate-500 text-sm">
              <Receipt size={14} />
              <span>Upload photo or PDF of bill</span>
            </div>
          )}
        </div>
      </FormField>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onClose} className="flex-1 justify-center">Cancel</Button>
        <Button type="submit" loading={loading} className="flex-1 justify-center">Add expense</Button>
      </div>
    </form>
  );
}

function ExpenseRow({
  expense,
  onDelete,
  onRefresh,
}: {
  expense: Expense;
  reportId: string;
  onDelete: () => void;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cat = CATEGORIES.find((c) => c.value === expense.category);
  const approval = APPROVAL_STATUS[expense.approvalStatus] || APPROVAL_STATUS.PENDING;
  const ApprovalIcon = approval.icon;

  return (
    <div className="border border-slate-800 rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-slate-200 font-medium">{expense.description}</span>
            <span className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">{cat?.label}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${expense.expenseType === 'OWNER_ONLY' ? 'text-purple-400 bg-purple-500/10' : 'text-blue-400 bg-blue-500/10'}`}>
              {expense.expenseType === 'OWNER_ONLY' ? 'Owner only' : 'Shared'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-sm font-semibold text-slate-200">₹{expense.amount.toLocaleString('en-IN')}</span>
          {expense.requiresApproval && (
            <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${approval.color}`}>
              <ApprovalIcon size={11} />
              {approval.label}
            </span>
          )}
          {expense.receiptUrl && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
          <button onClick={onDelete} className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-red-400 transition-colors">
            <Trash2 size={13} />
          </button>
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
              <ExternalLink size={13} />
              View receipt
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function RevenueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [report, setReport] = useState<RevenueReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [addExpenseModal, setAddExpenseModal] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => { load(); }, [id]);

  async function load() {
    setLoading(true);
    try {
      const r = await api.revenueReports.get(id);
      setReport(r);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteExpense(expenseId: string) {
    if (!confirm('Remove this expense?')) return;
    await api.revenueReports.deleteExpense(id, expenseId);
    load();
  }

  async function handlePublish() {
    if (!confirm('Publish this report? Owners will be able to see it.')) return;
    setPublishing(true);
    try {
      await api.revenueReports.update(id, { status: 'PUBLISHED' });
      load();
    } finally {
      setPublishing(false);
    }
  }

  async function handleUnpublish() {
    await api.revenueReports.update(id, { status: 'DRAFT' });
    load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!report) return null;

  const totalExpenses = report.expenses.reduce((s, e) => s + e.amount, 0);
  const ownerOnlyExpenses = report.expenses.filter((e) => e.expenseType === 'OWNER_ONLY').reduce((s, e) => s + e.amount, 0);
  const sharedExpenses = totalExpenses - ownerOnlyExpenses;
  const netPayable = report.netRevenue - report.commissionAmount - totalExpenses;
  const amountOwedToHost = report.commissionAmount + totalExpenses;
  const pendingApprovals = report.expenses.filter((e) => e.requiresApproval && e.approvalStatus === 'PENDING').length;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="text-slate-400 hover:text-slate-200 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-100">
              {MONTHS[report.month - 1]} {report.year}
            </h1>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              report.status === 'PUBLISHED'
                ? 'text-emerald-400 bg-emerald-500/10'
                : 'text-slate-400 bg-slate-800'
            }`}>
              {report.status === 'PUBLISHED' ? 'Published' : 'Draft'}
            </span>
          </div>
          <p className="text-slate-500 text-sm">{report.property?.name} · {report.property?.city}</p>
        </div>
        <div className="flex gap-2">
          {report.status === 'DRAFT' ? (
            <Button onClick={handlePublish} loading={publishing}>
              <Send size={14} /> Publish to owners
            </Button>
          ) : (
            <Button variant="secondary" onClick={handleUnpublish} className="text-xs">
              Revert to draft
            </Button>
          )}
        </div>
      </div>

      {/* Revenue summary */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Revenue Summary</h2>
        </div>
        <div className="p-5 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Gross earnings (Airbnb)</span>
            <span className="text-slate-200">₹{report.grossRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>
          {report.airbnbServiceFees > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Less: Airbnb service fees</span>
              <span className="text-slate-400">−₹{report.airbnbServiceFees.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Net credited to host (Airbnb)</span>
            <span className="text-slate-200 font-medium">₹{report.netRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="border-t border-slate-800 pt-2 mt-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Less: Management commission ({report.commissionPct}%)</span>
              <span className="text-amber-400">−₹{report.commissionAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </div>
            {totalExpenses > 0 && (
              <div className="flex justify-between text-sm mt-1">
                <span className="text-slate-400">Less: Expenses</span>
                <span className="text-red-400">−₹{totalExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
            )}
          </div>
          <div className="border-t border-slate-700 pt-3 flex justify-between">
            <span className="font-semibold text-slate-200">Net payable to owner</span>
            <span className={`font-bold text-lg ${netPayable >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              ₹{netPayable.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg px-4 py-3 flex justify-between mt-2">
            <span className="text-sm text-slate-400">Amount owed to management</span>
            <span className="text-sm font-semibold text-amber-400">₹{amountOwedToHost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>
        </div>

        {report.airbnbReportUrl && (
          <div className="px-5 pb-4">
            <a href={report.airbnbReportUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-brand-400 hover:underline">
              <ExternalLink size={11} />
              View Airbnb report
            </a>
          </div>
        )}
      </div>

      {/* Expenses */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Expenses</h2>
            {totalExpenses > 0 && (
              <p className="text-xs text-slate-500 mt-0.5">
                Total: ₹{totalExpenses.toLocaleString('en-IN')}
                {sharedExpenses > 0 && ` · Shared: ₹${sharedExpenses.toLocaleString('en-IN')}`}
                {ownerOnlyExpenses > 0 && ` · Owner only: ₹${ownerOnlyExpenses.toLocaleString('en-IN')}`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {pendingApprovals > 0 && (
              <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full">
                {pendingApprovals} awaiting owner approval
              </span>
            )}
            <Button variant="secondary" onClick={() => setAddExpenseModal(true)} className="text-xs py-1.5 px-3 h-auto">
              <Plus size={13} /> Add expense
            </Button>
          </div>
        </div>

        {report.expenses.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl py-10 text-center">
            <Receipt size={28} className="mx-auto text-slate-600 mb-2" />
            <p className="text-slate-500 text-sm">No expenses recorded</p>
            <p className="text-slate-600 text-xs mt-1">Add expenses with receipt photos for proper documentation</p>
          </div>
        ) : (
          <div className="space-y-2">
            {report.expenses.map((expense) => (
              <ExpenseRow
                key={expense.id}
                expense={expense}
                reportId={id}
                onDelete={() => handleDeleteExpense(expense.id)}
                onRefresh={load}
              />
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      {report.notes && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Notes</p>
          <p className="text-sm text-slate-300">{report.notes}</p>
        </div>
      )}

      <Modal open={addExpenseModal} onClose={() => setAddExpenseModal(false)} title="Add expense">
        <AddExpenseModal
          reportId={id}
          onSave={load}
          onClose={() => setAddExpenseModal(false)}
        />
      </Modal>
    </div>
  );
}
