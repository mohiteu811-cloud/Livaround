'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  DollarSign,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Search,
  Banknote,
} from 'lucide-react';
import { api, AdminPayoutRow, AdminPayoutStats } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { StatsCard } from '@/components/StatsCard';

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'mohit@livaround.com';

function payoutStatusBadge(status: string) {
  const map: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
    pending: { label: 'Pending', variant: 'warning' },
    processing: { label: 'Processing', variant: 'info' },
    completed: { label: 'Completed', variant: 'success' },
    failed: { label: 'Failed', variant: 'danger' },
  };
  const entry = map[status] || { label: status, variant: 'default' as const };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}

export default function AdminPayoutsPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [payouts, setPayouts] = useState<AdminPayoutRow[]>([]);
  const [stats, setStats] = useState<AdminPayoutStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 25;

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [partnerSearch, setPartnerSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [processResult, setProcessResult] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [payoutsRes, statsRes] = await Promise.all([
        api.admin.payouts({
          status: statusFilter,
          partner: partnerSearch,
          from: fromDate,
          to: toDate,
          page,
          limit,
        }),
        api.admin.payoutStats(),
      ]);
      setPayouts(payoutsRes.payouts);
      setTotal(payoutsRes.total);
      setStats(statsRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, partnerSearch, fromDate, toDate, page]);

  useEffect(() => {
    getCurrentUser().then((user) => {
      if (user?.email !== ADMIN_EMAIL) {
        router.replace('/dashboard');
        return;
      }
      setAuthorized(true);
    });
  }, [router]);

  useEffect(() => {
    if (authorized) fetchData();
  }, [authorized, fetchData]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      setPartnerSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  async function handleProcess() {
    setActionLoading('process');
    setProcessResult(null);
    try {
      const result = await api.admin.processPayouts();
      setProcessResult(
        `Approved ${result.commissionsApproved} commissions, created ${result.payoutsCreated} payouts`
      );
      fetchData();
    } catch (err) {
      console.error(err);
      setProcessResult('Processing failed');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSendAll() {
    setActionLoading('send');
    setProcessResult(null);
    try {
      const result = await api.admin.sendPayouts();
      setProcessResult(
        result.paypalBatchId
          ? `Sent ${result.processed} payouts via PayPal (batch: ${result.paypalBatchId})`
          : result.message || `Processed ${result.processed} payouts`
      );
      fetchData();
    } catch (err) {
      console.error(err);
      setProcessResult('Send failed — check PayPal configuration');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCheckStatus() {
    setActionLoading('check');
    setProcessResult(null);
    try {
      const result = await api.admin.checkPayoutStatus();
      setProcessResult(
        `Checked: ${result.completed} completed, ${result.failed} failed`
      );
      fetchData();
    } catch (err) {
      console.error(err);
      setProcessResult('Status check failed');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleApprovePayout(id: string) {
    setActionLoading(id);
    try {
      await api.admin.completePayout(id);
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRejectPayout(id: string) {
    setActionLoading(`reject-${id}`);
    try {
      await api.admin.rejectPayout(id);
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  }

  if (!authorized) {
    return (
      <div className="flex items-center justify-center h-full min-h-96">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalPages = Math.ceil(total / limit);
  const pendingPayouts = payouts.filter((p) => p.status === 'pending');
  const processingPayouts = payouts.filter((p) => p.status === 'processing');

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Payouts</h1>
          <p className="text-sm text-slate-400 mt-1">Manage partner commission payouts</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={actionLoading === 'process'}
            onClick={handleProcess}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Process commissions
          </Button>
          <Button
            variant="secondary"
            size="sm"
            loading={actionLoading === 'check'}
            onClick={handleCheckStatus}
            disabled={processingPayouts.length === 0}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Check PayPal status
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={actionLoading === 'send'}
            onClick={handleSendAll}
            disabled={pendingPayouts.length === 0}
          >
            <Send className="h-3.5 w-3.5" /> Send all pending ({pendingPayouts.length})
          </Button>
        </div>
      </div>

      {/* Process result */}
      {processResult && (
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3">
          <p className="text-sm text-slate-300">{processResult}</p>
        </div>
      )}

      {/* KPI cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Paid This Month"
            value={`$${stats.paidThisMonth.toFixed(2)}`}
            subtitle="Current month"
            icon={DollarSign}
            color="emerald"
          />
          <StatsCard
            title="Paid All Time"
            value={`$${stats.paidAllTime.toFixed(2)}`}
            subtitle="Total partner payouts"
            icon={Banknote}
            color="blue"
          />
          <StatsCard
            title="Active Partners"
            value={stats.activePartners}
            subtitle="Earning commissions"
            icon={Users}
            color="purple"
          />
          <StatsCard
            title="Pending Payouts"
            value={stats.pendingPayouts}
            subtitle="Awaiting processing"
            icon={Clock}
            color="amber"
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Search partner..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </Select>
        <Input
          type="date"
          value={fromDate}
          onChange={(e) => {
            setFromDate(e.target.value);
            setPage(1);
          }}
          className="max-w-[160px]"
          placeholder="From"
        />
        <Input
          type="date"
          value={toDate}
          onChange={(e) => {
            setToDate(e.target.value);
            setPage(1);
          }}
          className="max-w-[160px]"
          placeholder="To"
        />
      </div>

      {/* Payouts table */}
      <Card>
        <CardHeader title="Payouts" />
        <CardBody>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : payouts.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">No payouts found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-500">
                    <th className="pb-2 pr-4 font-medium">Partner</th>
                    <th className="pb-2 pr-4 font-medium">Tier</th>
                    <th className="pb-2 pr-4 font-medium text-right">Amount</th>
                    <th className="pb-2 pr-4 font-medium">Commissions</th>
                    <th className="pb-2 pr-4 font-medium">Method</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium">Date</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p) => (
                    <tr key={p.id} className="border-b border-slate-800/50">
                      <td className="py-3 pr-4">
                        <div className="text-slate-200 font-medium">{p.partnerName}</div>
                        <div className="text-xs text-slate-500">{p.partnerEmail}</div>
                      </td>
                      <td className="py-3 pr-4 capitalize text-slate-400">{p.partnerTier}</td>
                      <td className="py-3 pr-4 text-right font-medium text-slate-200">
                        ${p.amount.toFixed(2)}
                      </td>
                      <td className="py-3 pr-4 text-slate-400">{p.commissionCount}</td>
                      <td className="py-3 pr-4 text-slate-400 text-xs">
                        {p.method.replace('_', ' ')}
                      </td>
                      <td className="py-3 pr-4">{payoutStatusBadge(p.status)}</td>
                      <td className="py-3 pr-4 text-slate-400">
                        {p.processedAt
                          ? new Date(p.processedAt).toLocaleDateString()
                          : new Date(p.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3">
                        {p.status === 'pending' && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleApprovePayout(p.id)}
                              disabled={actionLoading === p.id}
                              className="rounded-md p-1.5 text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                              title="Mark as completed"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleRejectPayout(p.id)}
                              disabled={actionLoading === `reject-${p.id}`}
                              className="rounded-md p-1.5 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                              title="Reject payout"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                        {p.status === 'processing' && (
                          <span className="text-xs text-slate-500">
                            {p.reference ? `Batch: ${p.reference.slice(0, 12)}...` : 'Processing...'}
                          </span>
                        )}
                        {p.status === 'completed' && (
                          <span className="text-xs text-emerald-500">Done</span>
                        )}
                        {p.status === 'failed' && (
                          <span className="text-xs text-red-400">Failed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing {(page - 1) * limit + 1}&ndash;{Math.min(page * limit, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
