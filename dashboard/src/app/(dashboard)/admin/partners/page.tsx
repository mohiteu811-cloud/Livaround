'use client';

import { useEffect, useState } from 'react';
import {
  Shield,
  AlertTriangle,
  Users,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Eye,
  Ban,
  Play,
  ArrowUpCircle,
  RefreshCw,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatsCard } from '@/components/StatsCard';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://livaroundbackend-production.up.railway.app';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('livaround_token');
}

async function adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

interface PartnerEntry {
  id: string;
  fullName: string;
  email: string;
  paypalEmail: string;
  country: string;
  promotionMethod: string;
  tier: string;
  referralCode: string;
  commissionRate: number;
  status: string;
  suspendReason: string | null;
  totalEarned: number;
  pendingPayout: number;
  referralCount: number;
  activeCustomers: number;
  churned: number;
  churnRate: number;
  pendingFlags: number;
  createdAt: string;
}

interface FlagEntry {
  id: string;
  reason: string;
  details: string;
  status: string;
  createdAt: string;
  partner: {
    id: string;
    fullName: string;
    email: string;
    referralCode: string;
    tier: string;
    status: string;
    totalEarned: number;
  };
}

interface HealthData {
  summary: {
    totalPartners: number;
    activePartners: number;
    suspendedPartners: number;
    totalCommissionsAmount: number;
    pendingCommissionsAmount: number;
    avgChurnRate: number;
  };
  highVolumePartners: Array<{
    partnerId: string;
    partnerName: string;
    partnerEmail: string;
    referralCode: string;
    referralCount: number;
    churnRate: number;
    avgTimeToFirstJob: number | null;
  }>;
}

export default function AdminPartnersPage() {
  const [tab, setTab] = useState<'partners' | 'flagged' | 'health'>('partners');
  const [partners, setPartners] = useState<PartnerEntry[]>([]);
  const [flags, setFlags] = useState<FlagEntry[]>([]);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [search, statusFilter]);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const qs = params.toString() ? `?${params}` : '';

      const [partnersRes, flagsRes, healthRes] = await Promise.all([
        adminRequest<{ partners: PartnerEntry[] }>(`/api/admin/partners${qs}`),
        adminRequest<{ flags: FlagEntry[] }>('/api/admin/partners/flagged'),
        adminRequest<HealthData>('/api/admin/partners/health'),
      ]);

      setPartners(partnersRes.partners);
      setFlags(flagsRes.flags);
      setHealth(healthRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleFlagReview(flagId: string, action: string) {
    setActionLoading(flagId);
    try {
      await adminRequest(`/api/admin/partners/flags/${flagId}/review`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSuspend(partnerId: string) {
    setActionLoading(partnerId);
    try {
      await adminRequest(`/api/admin/partners/${partnerId}/suspend`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Suspended by admin' }),
      });
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleActivate(partnerId: string) {
    setActionLoading(partnerId);
    try {
      await adminRequest(`/api/admin/partners/${partnerId}/activate`, { method: 'POST' });
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleProcessHolds() {
    setActionLoading('holds');
    try {
      const res = await adminRequest<{ approved: number }>('/api/admin/partners/process-holds', { method: 'POST' });
      alert(`Processed: ${res.approved} commissions approved`);
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  }

  const tierBadge = (tier: string) => {
    const map: Record<string, 'info' | 'purple' | 'warning'> = {
      referral: 'info', channel: 'purple', strategic: 'warning',
    };
    return <Badge variant={map[tier] || 'default'} className="capitalize">{tier}</Badge>;
  };

  const statusBadge = (status: string) => {
    const map: Record<string, 'success' | 'danger' | 'warning' | 'default'> = {
      active: 'success', suspended: 'danger', pending: 'warning', flagged: 'warning',
    };
    return <Badge variant={map[status] || 'default'} className="capitalize">{status}</Badge>;
  };

  if (loading && !partners.length) {
    return (
      <div className="flex items-center justify-center h-full min-h-96">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-100">Partner Management</h1>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={actionLoading === 'holds'}
            onClick={handleProcessHolds}
          >
            <RefreshCw className="h-4 w-4" />
            Process Commission Holds
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      {health && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatsCard title="Total Partners" value={health.summary.totalPartners} subtitle={`${health.summary.activePartners} active`} icon={Users} color="blue" />
          <StatsCard title="Suspended" value={health.summary.suspendedPartners} subtitle="Need review" icon={Ban} color="red" />
          <StatsCard title="Total Commissions" value={`$${health.summary.totalCommissionsAmount.toFixed(0)}`} subtitle="All time" icon={DollarSign} color="emerald" />
          <StatsCard title="Pending Commissions" value={`$${health.summary.pendingCommissionsAmount.toFixed(0)}`} subtitle="In hold" icon={TrendingUp} color="amber" />
          <StatsCard title="Avg Churn Rate" value={`${(health.summary.avgChurnRate * 100).toFixed(1)}%`} subtitle="Across partners" icon={AlertTriangle} color="purple" />
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-800 flex gap-1">
        {[
          { key: 'partners', label: 'All Partners' },
          { key: 'flagged', label: `Flagged (${flags.length})` },
          { key: 'health', label: 'Commission Health' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Partners Tab */}
      {tab === 'partners' && (
        <>
          <div className="flex gap-3 flex-wrap">
            <Input
              placeholder="Search partners..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg bg-slate-800 border border-slate-700 text-slate-100 px-3 py-2 text-sm"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="flagged">Flagged</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <Card>
            <CardBody>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs text-slate-500">
                      <th className="pb-2 pr-4 font-medium">Partner</th>
                      <th className="pb-2 pr-4 font-medium">Tier</th>
                      <th className="pb-2 pr-4 font-medium">Code</th>
                      <th className="pb-2 pr-4 font-medium text-right">Referrals</th>
                      <th className="pb-2 pr-4 font-medium text-right">Active</th>
                      <th className="pb-2 pr-4 font-medium text-right">Churn</th>
                      <th className="pb-2 pr-4 font-medium text-right">Earned</th>
                      <th className="pb-2 pr-4 font-medium">Status</th>
                      <th className="pb-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partners.map((p) => (
                      <tr key={p.id} className="border-b border-slate-800/50">
                        <td className="py-3 pr-4">
                          <div>
                            <p className="text-slate-200">{p.fullName}</p>
                            <p className="text-xs text-slate-500">{p.email}</p>
                          </div>
                        </td>
                        <td className="py-3 pr-4">{tierBadge(p.tier)}</td>
                        <td className="py-3 pr-4">
                          <code className="text-xs text-slate-400">{p.referralCode}</code>
                        </td>
                        <td className="py-3 pr-4 text-right text-slate-300">{p.referralCount}</td>
                        <td className="py-3 pr-4 text-right text-slate-300">{p.activeCustomers}</td>
                        <td className="py-3 pr-4 text-right">
                          <span className={p.churnRate > 0.5 ? 'text-red-400' : p.churnRate > 0.3 ? 'text-amber-400' : 'text-slate-400'}>
                            {(p.churnRate * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-right text-emerald-400">${p.totalEarned.toFixed(2)}</td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-1">
                            {statusBadge(p.status)}
                            {p.pendingFlags > 0 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
                                {p.pendingFlags}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3">
                          <div className="flex gap-1">
                            {p.status === 'active' ? (
                              <button
                                onClick={() => handleSuspend(p.id)}
                                disabled={actionLoading === p.id}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Suspend"
                              >
                                <Ban className="h-4 w-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleActivate(p.id)}
                                disabled={actionLoading === p.id}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                                title="Activate"
                              >
                                <Play className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {partners.length === 0 && (
                  <p className="text-sm text-slate-500 py-8 text-center">No partners found.</p>
                )}
              </div>
            </CardBody>
          </Card>
        </>
      )}

      {/* Flagged Tab */}
      {tab === 'flagged' && (
        <div className="space-y-3">
          {flags.length === 0 ? (
            <Card>
              <CardBody>
                <div className="py-8 text-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No pending flags. All clear!</p>
                </div>
              </CardBody>
            </Card>
          ) : (
            flags.map((flag) => (
              <Card key={flag.id}>
                <CardBody>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/20">
                        <AlertTriangle className="h-5 w-5 text-amber-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-slate-200">{flag.partner.fullName}</p>
                          <code className="text-xs text-slate-500">{flag.partner.referralCode}</code>
                          <Badge variant={
                            flag.reason === 'self_referral' ? 'danger' :
                            flag.reason === 'same_ip' ? 'warning' :
                            flag.reason === 'high_churn' ? 'danger' :
                            'warning'
                          }>
                            {flag.reason.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-400">{flag.details}</p>
                        <p className="text-xs text-slate-600 mt-1">
                          {new Date(flag.createdAt).toLocaleString()} | Earned: ${flag.partner.totalEarned.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={actionLoading === flag.id}
                        onClick={() => handleFlagReview(flag.id, 'dismiss')}
                      >
                        Dismiss
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        loading={actionLoading === flag.id}
                        onClick={() => handleFlagReview(flag.id, 'reject')}
                      >
                        Suspend Partner
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Health Tab */}
      {tab === 'health' && health && (
        <div className="space-y-6">
          <Card>
            <CardHeader title="High-Volume Partners" />
            <CardBody>
              {health.highVolumePartners.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">
                  No high-volume partners yet (partners with 5+ referrals).
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs text-slate-500">
                        <th className="pb-2 pr-4 font-medium">Partner</th>
                        <th className="pb-2 pr-4 font-medium">Code</th>
                        <th className="pb-2 pr-4 font-medium text-right">Referrals</th>
                        <th className="pb-2 pr-4 font-medium text-right">Churn Rate</th>
                        <th className="pb-2 font-medium text-right">Avg Time to First Job</th>
                      </tr>
                    </thead>
                    <tbody>
                      {health.highVolumePartners.map((p) => (
                        <tr key={p.partnerId} className="border-b border-slate-800/50">
                          <td className="py-3 pr-4">
                            <div>
                              <p className="text-slate-200">{p.partnerName}</p>
                              <p className="text-xs text-slate-500">{p.partnerEmail}</p>
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <code className="text-xs text-slate-400">{p.referralCode}</code>
                          </td>
                          <td className="py-3 pr-4 text-right text-slate-300">{p.referralCount}</td>
                          <td className="py-3 pr-4 text-right">
                            <span className={p.churnRate > 0.5 ? 'text-red-400 font-medium' : p.churnRate > 0.3 ? 'text-amber-400' : 'text-slate-400'}>
                              {(p.churnRate * 100).toFixed(0)}%
                            </span>
                          </td>
                          <td className="py-3 text-right text-slate-400">
                            {p.avgTimeToFirstJob !== null ? `${p.avgTimeToFirstJob.toFixed(1)} days` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
