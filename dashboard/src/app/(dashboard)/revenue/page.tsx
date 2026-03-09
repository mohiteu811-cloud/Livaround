'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, BarChart3, Upload, FileText, CheckCircle2, Clock } from 'lucide-react';
import { api, RevenueReport, Property } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input, FormField } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function parseAirbnbCSV(text: string): Partial<{ grossRevenue: number; airbnbServiceFees: number; netRevenue: number }> {
  // Try to parse Airbnb CSV earnings report
  const result: Partial<{ grossRevenue: number; airbnbServiceFees: number; netRevenue: number }> = {};
  const lines = text.split('\n');
  for (const line of lines) {
    const lower = line.toLowerCase();
    // Look for gross earnings row
    if (lower.includes('gross earnings') || lower.includes('gross earning')) {
      const match = line.match(/[\d,]+\.?\d*/g);
      if (match) result.grossRevenue = parseFloat(match[match.length - 1].replace(',', ''));
    }
    // Look for service fees row
    if (lower.includes('service fee') || lower.includes('host fee')) {
      const match = line.match(/-?[\d,]+\.?\d*/g);
      if (match) result.airbnbServiceFees = Math.abs(parseFloat(match[match.length - 1].replace(',', '')));
    }
    // Look for total/payout row
    if (lower.includes('total') && (lower.includes('inr') || lower.includes('payout') || lower.includes('net'))) {
      const match = line.match(/[\d,]+\.?\d*/g);
      if (match) result.netRevenue = parseFloat(match[match.length - 1].replace(',', ''));
    }
  }
  return result;
}

function CreateReportModal({
  properties,
  onSave,
  onClose,
}: {
  properties: Property[];
  onSave: () => void;
  onClose: () => void;
}) {
  const now = new Date();
  const [form, setForm] = useState({
    propertyId: properties[0]?.id || '',
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    grossRevenue: '',
    airbnbServiceFees: '',
    netRevenue: '',
    commissionPct: '20',
    notes: '',
  });
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleCSVUpload(file: File) {
    setCsvFile(file);
    const text = await file.text();
    const parsed = parseAirbnbCSV(text);
    if (parsed.grossRevenue) set('grossRevenue', String(parsed.grossRevenue));
    if (parsed.airbnbServiceFees) set('airbnbServiceFees', String(parsed.airbnbServiceFees));
    if (parsed.netRevenue) set('netRevenue', String(parsed.netRevenue));
    else if (parsed.grossRevenue && parsed.airbnbServiceFees) {
      set('netRevenue', String(parsed.grossRevenue - parsed.airbnbServiceFees));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      let airbnbReportUrl: string | undefined;
      if (csvFile) {
        setUploading(true);
        const uploaded = await api.upload.file(csvFile);
        airbnbReportUrl = uploaded.url;
        setUploading(false);
      }

      await api.revenueReports.create({
        propertyId: form.propertyId,
        month: parseInt(form.month as unknown as string),
        year: parseInt(form.year as unknown as string),
        grossRevenue: parseFloat(form.grossRevenue),
        airbnbServiceFees: parseFloat(form.airbnbServiceFees || '0'),
        netRevenue: parseFloat(form.netRevenue),
        commissionPct: parseFloat(form.commissionPct),
        airbnbReportUrl,
        notes: form.notes || undefined,
      });

      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create report');
    } finally {
      setLoading(false);
      setUploading(false);
    }
  }

  const commission = form.netRevenue && form.commissionPct
    ? (parseFloat(form.netRevenue) * parseFloat(form.commissionPct)) / 100
    : 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>}

      {/* Airbnb report upload */}
      <div
        className="border-2 border-dashed border-slate-700 rounded-xl p-6 text-center cursor-pointer hover:border-brand-500/50 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden"
          onChange={(e) => e.target.files?.[0] && handleCSVUpload(e.target.files[0])}
        />
        {csvFile ? (
          <div className="flex items-center justify-center gap-2 text-emerald-400">
            <CheckCircle2 size={18} />
            <span className="text-sm font-medium">{csvFile.name}</span>
          </div>
        ) : (
          <div className="space-y-1">
            <Upload size={24} className="mx-auto text-slate-500" />
            <p className="text-sm text-slate-400">Upload Airbnb earnings CSV to auto-fill</p>
            <p className="text-xs text-slate-600">or enter values manually below</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Property">
          <select
            value={form.propertyId}
            onChange={(e) => set('propertyId', e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-brand-500"
            required
          >
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </FormField>
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Month">
            <select
              value={form.month}
              onChange={(e) => set('month', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-brand-500"
            >
              {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m.slice(0, 3)}</option>)}
            </select>
          </FormField>
          <FormField label="Year">
            <Input
              type="number" min="2020" max="2100"
              value={form.year}
              onChange={(e) => set('year', e.target.value)}
            />
          </FormField>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <FormField label="Gross earnings (INR)">
          <Input type="number" min="0" step="0.01" placeholder="108885"
            value={form.grossRevenue} onChange={(e) => set('grossRevenue', e.target.value)} required />
        </FormField>
        <FormField label="Airbnb fees (INR)">
          <Input type="number" min="0" step="0.01" placeholder="3920"
            value={form.airbnbServiceFees} onChange={(e) => set('airbnbServiceFees', e.target.value)} />
        </FormField>
        <FormField label="Net credited (INR)">
          <Input type="number" min="0" step="0.01" placeholder="104963"
            value={form.netRevenue} onChange={(e) => set('netRevenue', e.target.value)} required />
        </FormField>
      </div>

      <FormField label="Management commission %">
        <Input type="number" min="0" max="100" step="0.1" placeholder="20"
          value={form.commissionPct} onChange={(e) => set('commissionPct', e.target.value)} required />
      </FormField>

      {commission > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg px-4 py-3 text-sm">
          <span className="text-slate-400">Commission amount: </span>
          <span className="text-amber-400 font-semibold">₹{commission.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
        </div>
      )}

      <FormField label="Notes (optional)">
        <Input placeholder="Any additional notes..." value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      </FormField>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onClose} className="flex-1 justify-center">Cancel</Button>
        <Button type="submit" loading={loading || uploading} className="flex-1 justify-center">
          {uploading ? 'Uploading...' : 'Create report'}
        </Button>
      </div>
    </form>
  );
}

function ReportCard({ report }: { report: RevenueReport }) {
  const router = useRouter();
  const totalExpenses = report.expenses.reduce((s, e) => s + e.amount, 0);
  const netPayable = report.netRevenue - report.commissionAmount - totalExpenses;
  const pendingApprovals = report.expenses.filter((e) => e.requiresApproval && e.approvalStatus === 'PENDING').length;

  return (
    <div
      className="bg-slate-900 border border-slate-800 rounded-xl p-5 cursor-pointer hover:border-slate-700 transition-colors"
      onClick={() => router.push(`/revenue/${report.id}`)}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold text-slate-100">
              {MONTHS[(report.month - 1)]} {report.year}
            </p>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              report.status === 'PUBLISHED'
                ? 'text-emerald-400 bg-emerald-500/10'
                : 'text-slate-400 bg-slate-800'
            }`}>
              {report.status === 'PUBLISHED' ? 'Published' : 'Draft'}
            </span>
            {pendingApprovals > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium text-amber-400 bg-amber-500/10">
                {pendingApprovals} pending approval
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">{report.property?.name} · {report.property?.city}</p>
        </div>
        <FileText size={16} className="text-slate-600 mt-0.5" />
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div>
          <p className="text-xs text-slate-600 mb-0.5">Gross revenue</p>
          <p className="text-sm font-medium text-slate-200">₹{report.grossRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
        </div>
        <div>
          <p className="text-xs text-slate-600 mb-0.5">Commission ({report.commissionPct}%)</p>
          <p className="text-sm font-medium text-amber-400">₹{report.commissionAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
        </div>
        <div>
          <p className="text-xs text-slate-600 mb-0.5">Total expenses</p>
          <p className="text-sm font-medium text-slate-300">₹{totalExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
        </div>
        <div>
          <p className="text-xs text-slate-600 mb-0.5">Net to owner</p>
          <p className="text-sm font-bold text-emerald-400">₹{netPayable.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
        </div>
      </div>
    </div>
  );
}

export default function RevenuePage() {
  const [reports, setReports] = useState<RevenueReport[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([api.revenueReports.list(), api.properties.list()]);
      setReports(r);
      setProperties(p);
    } finally {
      setLoading(false);
    }
  }

  const totalRevenue = reports.reduce((s, r) => s + r.netRevenue, 0);
  const totalCommission = reports.reduce((s, r) => s + r.commissionAmount, 0);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Revenue Reports</h1>
          <p className="text-slate-400 text-sm mt-1">Upload Airbnb earnings, track commissions and expenses</p>
        </div>
        <Button onClick={() => setCreateModal(true)}><Plus size={16} /> New report</Button>
      </div>

      {/* Summary cards */}
      {reports.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Total net revenue</p>
            <p className="text-xl font-bold text-slate-100">₹{totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Total commission</p>
            <p className="text-xl font-bold text-amber-400">₹{totalCommission.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Reports</p>
            <p className="text-xl font-bold text-slate-100">{reports.length}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Pending approvals</p>
            <p className="text-xl font-bold text-amber-400">
              {reports.reduce((s, r) => s + r.expenses.filter((e) => e.requiresApproval && e.approvalStatus === 'PENDING').length, 0)}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center py-16 gap-3">
          <BarChart3 size={40} className="text-slate-600" />
          <p className="text-slate-400">No revenue reports yet</p>
          <p className="text-slate-600 text-sm text-center max-w-xs">Upload your Airbnb earnings report to calculate commissions, track expenses, and generate owner statements.</p>
          <Button onClick={() => setCreateModal(true)}>Create first report</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => <ReportCard key={r.id} report={r} />)}
        </div>
      )}

      <Modal open={createModal} onClose={() => setCreateModal(false)} title="New revenue report">
        <CreateReportModal
          properties={properties}
          onSave={load}
          onClose={() => setCreateModal(false)}
        />
      </Modal>
    </div>
  );
}
