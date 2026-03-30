'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Copy,
  Check,
  DollarSign,
  Clock,
  TrendingUp,
  Users,
  AlertTriangle,
  CheckCircle2,
  Banknote,
} from 'lucide-react';
import { api, PartnerDashboard } from '@/lib/api';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StatsCard } from '@/components/StatsCard';

const IS_COMMERCIAL = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === 'true';

function commissionStatusBadge(status: string) {
  const map: Record<string, { label: string; variant: 'success' | 'warning' | 'info' | 'default' }> = {
    pending: { label: 'Pending', variant: 'warning' },
    approved: { label: 'Approved', variant: 'info' },
    paid: { label: 'Paid', variant: 'success' },
  };
  const entry = map[status] || { label: status, variant: 'default' as const };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}

function subStatusBadge(status: string) {
  const map: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
    active: { label: 'Active', variant: 'success' },
    trialing: { label: 'Trial', variant: 'info' },
    past_due: { label: 'Past due', variant: 'warning' },
    cancelled: { label: 'Cancelled', variant: 'danger' },
    no_subscription: { label: 'Free', variant: 'default' },
  };
  const entry = map[status] || { label: status, variant: 'default' as const };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}

export default function PartnerPage() {
  const router = useRouter();
  const [data, setData] = useState<PartnerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [notPartner, setNotPartner] = useState(false);
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);

  useEffect(() => {
    if (!IS_COMMERCIAL) {
      router.replace('/dashboard');
      return;
    }

    api.partner
      .dashboard()
      .then(setData)
      .catch((err) => {
        if (err.message === 'not_a_partner') {
          setNotPartner(true);
        } else {
          console.error(err);
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-96">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notPartner) {
    return (
      <div className="p-4 md:p-8">
        <h1 className="text-2xl font-bold text-slate-100">Partner Program</h1>
        <Card className="mt-6 max-w-2xl">
          <CardBody>
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/20">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Not a partner yet</h2>
                <p className="mt-1 text-sm text-slate-400">
                  You haven&apos;t registered as a partner. Visit your billing settings to join the
                  partner program and start earning commissions.
                </p>
                <a
                  href="/settings/billing"
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-400 hover:text-brand-300"
                >
                  Go to billing settings
                </a>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 md:p-8 text-slate-400">Failed to load partner data.</div>
    );
  }

  const { partner, kpis, referrals, commissions, payout } = data;

  function copyToClipboard(text: string, type: 'link' | 'code') {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  const referralLink = typeof window !== 'undefined'
    ? `${window.location.origin}/signup?ref=${partner.referralCode}`
    : `https://app.livaround.com/signup?ref=${partner.referralCode}`;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-100">Partner Dashboard</h1>
        <Badge variant="info" className="capitalize">{partner.tier}</Badge>
        <span className="text-sm text-slate-500">
          {(partner.commissionRate * 100).toFixed(0)}% commission rate
          {partner.overrideRate ? ` + ${(partner.overrideRate * 100).toFixed(0)}% override` : ''}
        </span>
      </div>

      {/* Referral link & code */}
      <Card>
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-500 mb-1.5">Your referral link</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-300 truncate">
                  {referralLink}
                </code>
                <button
                  onClick={() => copyToClipboard(referralLink, 'link')}
                  className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors"
                >
                  {copied === 'link' ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1.5">Referral code</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-slate-800 px-3 py-2 text-sm font-mono text-slate-200">
                  {partner.referralCode}
                </code>
                <button
                  onClick={() => copyToClipboard(partner.referralCode, 'code')}
                  className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors"
                >
                  {copied === 'code' ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Earned"
          value={`$${kpis.totalEarned.toFixed(2)}`}
          subtitle="All time"
          icon={DollarSign}
          color="emerald"
        />
        <StatsCard
          title="Pending Payout"
          value={`$${kpis.pendingPayout.toFixed(2)}`}
          subtitle="Awaiting payment"
          icon={Clock}
          color="amber"
        />
        <StatsCard
          title="This Month"
          value={`$${kpis.monthEarnings.toFixed(2)}`}
          subtitle="Current month earnings"
          icon={TrendingUp}
          color="blue"
        />
        <StatsCard
          title="Referrals"
          value={kpis.referralCount}
          subtitle="Organizations referred"
          icon={Users}
          color="purple"
        />
      </div>

      {/* Payout eligibility */}
      <Card>
        <CardBody>
          <div className="flex items-center gap-3">
            {payout.eligible ? (
              <>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-emerald-300">
                    Eligible for payout
                  </p>
                  <p className="text-xs text-slate-400">
                    You have ${payout.pendingAmount.toFixed(2)} pending, which exceeds the
                    ${payout.threshold} minimum threshold. Payouts are processed monthly.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800">
                  <Banknote className="h-5 w-5 text-slate-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-300">
                    ${(payout.threshold - payout.pendingAmount).toFixed(2)} more to reach payout threshold
                  </p>
                  <p className="text-xs text-slate-400">
                    Minimum payout is ${payout.threshold}. You have ${payout.pendingAmount.toFixed(2)} pending.
                    Keep referring to reach the threshold!
                  </p>
                </div>
              </>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Referrals table */}
      <Card>
        <CardHeader title="Your Referrals" />
        <CardBody>
          {referrals.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">
              No referrals yet. Share your referral link to start earning!
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-500">
                    <th className="pb-2 pr-4 font-medium">Organization</th>
                    <th className="pb-2 pr-4 font-medium">Plan</th>
                    <th className="pb-2 pr-4 font-medium text-right">Monthly</th>
                    <th className="pb-2 pr-4 font-medium text-right">Your rate</th>
                    <th className="pb-2 pr-4 font-medium text-right">Earned</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((r) => (
                    <tr key={r.orgId} className="border-b border-slate-800/50">
                      <td className="py-3 pr-4 text-slate-200">{r.orgName}</td>
                      <td className="py-3 pr-4 capitalize text-slate-400">{r.plan}</td>
                      <td className="py-3 pr-4 text-right text-slate-300">
                        ${r.monthlyAmount.toFixed(0)}
                      </td>
                      <td className="py-3 pr-4 text-right text-slate-400">
                        {(r.commissionRate * 100).toFixed(0)}%
                      </td>
                      <td className="py-3 pr-4 text-right text-emerald-400">
                        ${r.commissionEarned.toFixed(2)}
                      </td>
                      <td className="py-3">{subStatusBadge(r.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Commission history */}
      <Card>
        <CardHeader title="Commission History" />
        <CardBody>
          {commissions.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">
              No commissions yet. Commissions are created when referred organizations make payments.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-500">
                    <th className="pb-2 pr-4 font-medium">Period</th>
                    <th className="pb-2 pr-4 font-medium">Type</th>
                    <th className="pb-2 pr-4 font-medium text-right">Amount</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 font-medium">Paid date</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((c) => (
                    <tr key={c.id} className="border-b border-slate-800/50">
                      <td className="py-3 pr-4 text-slate-200">{c.period}</td>
                      <td className="py-3 pr-4">
                        <Badge variant={c.type === 'direct' ? 'info' : 'purple'}>
                          {c.type === 'direct' ? 'Direct' : 'Override'}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-right text-slate-200">
                        ${c.amount.toFixed(2)}
                      </td>
                      <td className="py-3 pr-4">{commissionStatusBadge(c.status)}</td>
                      <td className="py-3 text-slate-400">
                        {c.paidAt ? new Date(c.paidAt).toLocaleDateString() : '—'}
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
  );
}
