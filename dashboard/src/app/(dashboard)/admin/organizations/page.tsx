'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  CreditCard,
  Calendar,
  Mail,
  Phone,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
} from 'lucide-react';
import { api, AdminOrgRow, AdminOrgDetail } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'mohit@livaround.com';

function statusBadge(status: string | null) {
  if (!status) return <Badge variant="default">No sub</Badge>;
  const map: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
    active: { label: 'Active', variant: 'success' },
    trialing: { label: 'Trial', variant: 'info' },
    past_due: { label: 'Past due', variant: 'warning' },
    cancelled: { label: 'Cancelled', variant: 'danger' },
  };
  const entry = map[status] || { label: status, variant: 'default' as const };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}

export default function AdminOrganizationsPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState<AdminOrgRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 25;

  // Filters
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Detail view
  const [selectedOrg, setSelectedOrg] = useState<AdminOrgDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Actions
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showTrialModal, setShowTrialModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [newPlan, setNewPlan] = useState('');
  const [trialDays, setTrialDays] = useState(14);

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.admin.organizations({ search, plan: planFilter, status: statusFilter, page, limit });
      setOrgs(res.organizations);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, planFilter, statusFilter, page]);

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
    if (authorized) fetchOrgs();
  }, [authorized, fetchOrgs]);

  // Debounced search
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  async function openDetail(orgId: string) {
    setDetailLoading(true);
    try {
      const detail = await api.admin.organization(orgId);
      setSelectedOrg(detail);
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleChangePlan() {
    if (!selectedOrg || !newPlan) return;
    setActionLoading(true);
    try {
      await api.admin.changePlan(selectedOrg.id, newPlan);
      const detail = await api.admin.organization(selectedOrg.id);
      setSelectedOrg(detail);
      setShowPlanModal(false);
      fetchOrgs();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleExtendTrial() {
    if (!selectedOrg || trialDays < 1) return;
    setActionLoading(true);
    try {
      await api.admin.extendTrial(selectedOrg.id, trialDays);
      const detail = await api.admin.organization(selectedOrg.id);
      setSelectedOrg(detail);
      setShowTrialModal(false);
      fetchOrgs();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
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

  // ── Detail view ───────────────────────────────────────────────────────────
  if (selectedOrg) {
    const org = selectedOrg;
    const sub = org.subscription;

    return (
      <div className="p-4 md:p-8 space-y-6">
        <button
          onClick={() => setSelectedOrg(null)}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to organizations
        </button>

        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-2xl font-bold text-slate-100">{org.name}</h1>
          {statusBadge(sub?.status ?? null)}
        </div>

        {/* Owner & plan info */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader title="Owner" />
            <CardBody className="space-y-2">
              {org.owner ? (
                <>
                  <div className="flex items-center gap-2 text-sm text-slate-200">
                    <Building2 className="h-4 w-4 text-slate-500" /> {org.owner.name}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Mail className="h-4 w-4 text-slate-500" /> {org.owner.email}
                  </div>
                  {org.owner.phone && (
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Phone className="h-4 w-4 text-slate-500" /> {org.owner.phone}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500">No owner linked</p>
              )}
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Calendar className="h-4 w-4 text-slate-500" /> Created {new Date(org.createdAt).toLocaleDateString()}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Subscription" />
            <CardBody className="space-y-3">
              {sub ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Plan</span>
                    <span className="text-sm font-medium capitalize text-slate-200">{sub.plan}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Monthly amount</span>
                    <span className="text-sm font-medium text-slate-200">${sub.monthlyAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Properties</span>
                    <span className="text-sm font-medium text-slate-200">{sub.propertyCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Period</span>
                    <span className="text-sm text-slate-300">
                      {new Date(sub.currentPeriodStart).toLocaleDateString()} &ndash; {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                    </span>
                  </div>
                  {sub.trialEndsAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Trial ends</span>
                      <span className="text-sm text-amber-400">{new Date(sub.trialEndsAt).toLocaleDateString()}</span>
                    </div>
                  )}
                  {sub.cancelledAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Cancelled</span>
                      <span className="text-sm text-red-400">{new Date(sub.cancelledAt).toLocaleDateString()}</span>
                    </div>
                  )}
                  {sub.paypalSubId && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">PayPal Sub ID</span>
                      <span className="text-xs font-mono text-slate-400">{sub.paypalSubId}</span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500">No subscription (community plan)</p>
              )}

              <div className="flex gap-2 pt-2 border-t border-slate-800">
                <Button size="sm" variant="secondary" onClick={() => { setNewPlan(sub?.plan ?? 'pro'); setShowPlanModal(true); }}>
                  <CreditCard className="h-3.5 w-3.5" /> Change plan
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setShowTrialModal(true)}>
                  <Clock className="h-3.5 w-3.5" /> Extend trial
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Referred by */}
        {org.referredBy && (
          <Card>
            <CardHeader title="Referred By" />
            <CardBody>
              <div className="flex flex-wrap gap-6 text-sm">
                <div>
                  <span className="text-slate-500">Partner: </span>
                  <span className="text-slate-200">{org.referredBy.name}</span>
                </div>
                <div>
                  <span className="text-slate-500">Email: </span>
                  <span className="text-slate-400">{org.referredBy.email}</span>
                </div>
                <div>
                  <span className="text-slate-500">Code: </span>
                  <span className="font-mono text-slate-300">{org.referredBy.code}</span>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Properties */}
        <Card>
          <CardHeader title={`Properties (${org.properties.length})`} />
          <CardBody>
            {org.properties.length === 0 ? (
              <p className="text-sm text-slate-500">No properties</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs text-slate-500">
                      <th className="pb-2 pr-4 font-medium">Name</th>
                      <th className="pb-2 pr-4 font-medium">City</th>
                      <th className="pb-2 pr-4 font-medium">Status</th>
                      <th className="pb-2 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {org.properties.map((p) => (
                      <tr key={p.id} className="border-b border-slate-800/50">
                        <td className="py-2 pr-4 text-slate-200">{p.name}</td>
                        <td className="py-2 pr-4 text-slate-400">{p.city}</td>
                        <td className="py-2 pr-4">
                          <Badge variant={p.isActive ? 'success' : 'default'}>
                            {p.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="py-2 text-slate-400">{new Date(p.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Payment history */}
        <Card>
          <CardHeader title="Payment History" />
          <CardBody>
            {org.payments.length === 0 ? (
              <p className="text-sm text-slate-500">No payments recorded</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs text-slate-500">
                      <th className="pb-2 pr-4 font-medium">Period</th>
                      <th className="pb-2 pr-4 font-medium text-right">Amount</th>
                      <th className="pb-2 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {org.payments.map((p) => (
                      <tr key={p.period} className="border-b border-slate-800/50">
                        <td className="py-2 pr-4 text-slate-200">{p.period}</td>
                        <td className="py-2 pr-4 text-right text-slate-200">${p.amount.toFixed(2)}</td>
                        <td className="py-2 text-slate-400">{new Date(p.date).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Change plan modal */}
        <Modal open={showPlanModal} onClose={() => setShowPlanModal(false)} title="Change Plan" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Manually change the plan for <span className="text-slate-200 font-medium">{org.name}</span>.
              This will take effect immediately.
            </p>
            <div className="space-y-2">
              {['community', 'pro', 'agency'].map((p) => (
                <label
                  key={p}
                  className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    newPlan === p ? 'border-brand-500 bg-brand-500/10' : 'border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="plan"
                    value={p}
                    checked={newPlan === p}
                    onChange={() => setNewPlan(p)}
                    className="accent-brand-500"
                  />
                  <div>
                    <span className="text-sm font-medium capitalize text-slate-200">{p}</span>
                    <span className="text-xs text-slate-500 ml-2">
                      {p === 'community' ? 'Free' : p === 'pro' ? '$10/property/mo' : '$100/mo flat'}
                    </span>
                  </div>
                  {p === sub?.plan && (
                    <span className="ml-auto text-xs text-brand-400">Current</span>
                  )}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={() => setShowPlanModal(false)}>Cancel</Button>
              <Button
                variant="primary"
                size="sm"
                loading={actionLoading}
                onClick={handleChangePlan}
                disabled={newPlan === sub?.plan}
              >
                {newPlan && sub?.plan && ['community', 'pro', 'agency'].indexOf(newPlan) > ['community', 'pro', 'agency'].indexOf(sub.plan)
                  ? <><ArrowUpRight className="h-3.5 w-3.5" /> Upgrade</>
                  : <><ArrowDownRight className="h-3.5 w-3.5" /> Downgrade</>
                }
              </Button>
            </div>
          </div>
        </Modal>

        {/* Extend trial modal */}
        <Modal open={showTrialModal} onClose={() => setShowTrialModal(false)} title="Extend Trial" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Set or extend the trial for <span className="text-slate-200 font-medium">{org.name}</span>.
              The subscription will be set to &quot;trialing&quot; status.
            </p>
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1 block">Trial duration (days from now)</label>
              <Input
                type="number"
                min={1}
                max={365}
                value={trialDays}
                onChange={(e) => setTrialDays(parseInt(e.target.value) || 14)}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={() => setShowTrialModal(false)}>Cancel</Button>
              <Button variant="primary" size="sm" loading={actionLoading} onClick={handleExtendTrial}>
                <Clock className="h-3.5 w-3.5" /> Extend trial
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Organizations</h1>
        <p className="text-sm text-slate-400 mt-1">{total} organizations total</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Search by name or email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={planFilter} onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}>
          <option value="">All plans</option>
          <option value="community">Community</option>
          <option value="pro">Pro</option>
          <option value="agency">Agency</option>
        </Select>
        <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="trialing">Trialing</option>
          <option value="past_due">Past due</option>
          <option value="cancelled">Cancelled</option>
          <option value="none">No subscription</option>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardBody>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : orgs.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">No organizations found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-500">
                    <th className="pb-2 pr-4 font-medium">Organization</th>
                    <th className="pb-2 pr-4 font-medium">Plan</th>
                    <th className="pb-2 pr-4 font-medium">Properties</th>
                    <th className="pb-2 pr-4 font-medium text-right">Monthly</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium">Created</th>
                    <th className="pb-2 font-medium">Last active</th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.map((org) => (
                    <tr
                      key={org.id}
                      className="border-b border-slate-800/50 cursor-pointer hover:bg-slate-800/40 transition-colors"
                      onClick={() => openDetail(org.id)}
                    >
                      <td className="py-3 pr-4">
                        <div className="text-slate-200 font-medium">{org.name}</div>
                        {org.ownerEmail && (
                          <div className="text-xs text-slate-500">{org.ownerEmail}</div>
                        )}
                      </td>
                      <td className="py-3 pr-4 capitalize text-slate-300">{org.plan}</td>
                      <td className="py-3 pr-4 text-slate-300">{org.propertyCount}</td>
                      <td className="py-3 pr-4 text-right text-slate-300">
                        ${org.monthlyAmount.toFixed(0)}
                      </td>
                      <td className="py-3 pr-4">{statusBadge(org.status)}</td>
                      <td className="py-3 pr-4 text-slate-400">
                        {new Date(org.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-slate-400">
                        {new Date(org.updatedAt).toLocaleDateString()}
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

      {/* Detail loading overlay */}
      {detailLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
