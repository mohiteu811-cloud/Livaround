'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  ExternalLink,
} from 'lucide-react';
import { api, AdminSubscriptionRow } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'mohit@livaround.com';

function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
    active: { label: 'Active', variant: 'success' },
    trialing: { label: 'Trial', variant: 'info' },
    past_due: { label: 'Past due', variant: 'warning' },
    cancelled: { label: 'Cancelled', variant: 'danger' },
  };
  const entry = map[status] || { label: status, variant: 'default' as const };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}

export default function AdminSubscriptionsPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subs, setSubs] = useState<AdminSubscriptionRow[]>([]);
  const [pastDue, setPastDue] = useState<AdminSubscriptionRow[]>([]);
  const [pastDueCount, setPastDueCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 25;

  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');

  const fetchSubs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.admin.subscriptions({ status: statusFilter, plan: planFilter, page, limit });
      setSubs(res.subscriptions);
      setTotal(res.total);
      setPastDueCount(res.pastDueCount);
      setPastDue(res.pastDue);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, planFilter, page]);

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
    if (authorized) fetchSubs();
  }, [authorized, fetchSubs]);

  if (!authorized) {
    return (
      <div className="flex items-center justify-center h-full min-h-96">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Subscriptions</h1>
        <p className="text-sm text-slate-400 mt-1">{total} subscriptions total</p>
      </div>

      {/* Past due alert */}
      {pastDueCount > 0 && (
        <Card>
          <CardBody>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/20">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-amber-200">
                  {pastDueCount} subscription{pastDueCount > 1 ? 's' : ''} past due
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 mb-3">
                  These organizations have failed payments and need attention.
                </p>
                <div className="space-y-2">
                  {pastDue.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2"
                    >
                      <div>
                        <span className="text-sm font-medium text-slate-200">{s.orgName}</span>
                        <span className="text-xs text-slate-500 ml-2">
                          {s.ownerEmail}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-300">${s.monthlyAmount.toFixed(0)}/mo</span>
                        <span className="text-xs text-slate-500 capitalize">{s.plan}</span>
                        <Link
                          href={`/admin/organizations`}
                          className="text-brand-400 hover:text-brand-300"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="trialing">Trialing</option>
          <option value="past_due">Past due</option>
          <option value="cancelled">Cancelled</option>
        </Select>
        <Select value={planFilter} onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}>
          <option value="">All plans</option>
          <option value="pro">Pro</option>
          <option value="agency">Agency</option>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader title="All Subscriptions" />
        <CardBody>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : subs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <CreditCard className="h-8 w-8 mb-2" />
              <p className="text-sm">No subscriptions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-500">
                    <th className="pb-2 pr-4 font-medium">Organization</th>
                    <th className="pb-2 pr-4 font-medium">Plan</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium">Properties</th>
                    <th className="pb-2 pr-4 font-medium text-right">Monthly</th>
                    <th className="pb-2 pr-4 font-medium">Period end</th>
                    <th className="pb-2 pr-4 font-medium">Trial ends</th>
                    <th className="pb-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-slate-800/50 hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 pr-4">
                        <Link
                          href="/admin/organizations"
                          className="text-slate-200 font-medium hover:text-brand-400 transition-colors"
                        >
                          {s.orgName}
                        </Link>
                        {s.ownerEmail && (
                          <div className="text-xs text-slate-500">{s.ownerEmail}</div>
                        )}
                      </td>
                      <td className="py-3 pr-4 capitalize text-slate-300">{s.plan}</td>
                      <td className="py-3 pr-4">{statusBadge(s.status)}</td>
                      <td className="py-3 pr-4 text-slate-300">{s.propertyCount}</td>
                      <td className="py-3 pr-4 text-right text-slate-300">
                        ${s.monthlyAmount.toFixed(0)}
                      </td>
                      <td className="py-3 pr-4 text-slate-400">
                        {new Date(s.currentPeriodEnd).toLocaleDateString()}
                      </td>
                      <td className="py-3 pr-4 text-slate-400">
                        {s.trialEndsAt ? new Date(s.trialEndsAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3 text-slate-400">
                        {new Date(s.createdAt).toLocaleDateString()}
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
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
