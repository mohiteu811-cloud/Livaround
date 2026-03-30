'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Copy,
  Check,
  DollarSign,
  Clock,
  TrendingUp,
  Users,
  MousePointerClick,
  Banknote,
  CheckCircle2,
  QrCode,
  ExternalLink,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://livaroundbackend-production.up.railway.app';

interface PartnerDashboard {
  partner: {
    id: string;
    fullName: string;
    email: string;
    referralCode: string;
    tier: string;
    commissionRate: number;
    overrideRate: number | null;
    status: string;
  };
  kpis: {
    totalEarned: number;
    pendingPayout: number;
    pendingHold: number;
    approvedPayable: number;
    monthEarnings: number;
    referralCount: number;
    activeCustomers: number;
    churnedCustomers: number;
    churnRate: number;
    totalClicks: number;
    monthClicks: number;
    conversionRate: number;
  };
  referrals: Array<{
    orgId: string;
    orgName: string;
    plan: string;
    monthlyAmount: number;
    status: string;
    commissionRate: number;
    commissionEarned: number;
    commissionStatus: string;
    activeProperties: number;
    signupDate: string;
  }>;
  commissions: Array<{
    id: string;
    period: string;
    type: string;
    amount: number;
    currency: string;
    status: string;
    holdUntil: string | null;
    paidAt: string | null;
    orgName: string;
  }>;
  payouts: Array<{
    id: string;
    amount: number;
    currency: string;
    method: string;
    status: string;
    processedAt: string | null;
    createdAt: string;
  }>;
  payout: {
    threshold: number;
    eligible: boolean;
    pendingAmount: number;
  };
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Active' },
    trialing: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Trial' },
    past_due: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Past Due' },
    cancelled: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Cancelled' },
    no_subscription: { bg: 'bg-slate-700', text: 'text-slate-400', label: 'Free' },
    pending: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Pending' },
    approved: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Approved' },
    paid: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Paid' },
    voided: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Voided' },
    clawback: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Clawback' },
  };
  const entry = map[status] || { bg: 'bg-slate-700', text: 'text-slate-400', label: status };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${entry.bg} ${entry.text}`}>
      {entry.label}
    </span>
  );
}

function StatsCard({ title, value, subtitle, icon: Icon, color }: {
  title: string; value: string | number; subtitle: string; icon: React.ElementType; color: string;
}) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-500/20 text-emerald-400',
    amber: 'bg-amber-500/20 text-amber-400',
    blue: 'bg-blue-500/20 text-blue-400',
    purple: 'bg-purple-500/20 text-purple-400',
    cyan: 'bg-cyan-500/20 text-cyan-400',
  };
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${colors[color]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-xs text-slate-500">{title}</p>
      </div>
      <p className="text-2xl font-bold text-slate-100">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
    </div>
  );
}

export default function PartnerDashboardPageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <PartnerDashboardPage />
    </Suspense>
  );
}

function PartnerDashboardPage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<PartnerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);
  const [tab, setTab] = useState<'referrals' | 'commissions' | 'payouts'>('referrals');

  useEffect(() => {
    const token = searchParams.get('token') || localStorage.getItem('livaround_partner_token');
    if (!token) {
      setError('No partner token found. Please register or log in.');
      setLoading(false);
      return;
    }

    // Save token
    localStorage.setItem('livaround_partner_token', token);

    fetch(`${API_URL}/api/partner/dashboard`, {
      headers: {
        'x-partner-token': token,
        'Content-Type': 'application/json',
      },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to load');
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [searchParams]);

  function copyToClipboard(text: string, type: 'link' | 'code') {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-8 max-w-md text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <a
            href="/partners/join"
            className="inline-flex px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium"
          >
            Join Partner Program
          </a>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { partner, kpis, referrals, commissions, payouts, payout } = data;
  const referralLink = `https://livaround.com?ref=${partner.referralCode}`;

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-sm">
              L
            </div>
            <span className="font-bold text-lg text-slate-100">LivAround Partners</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">{partner.fullName || partner.email}</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
              partner.tier === 'channel' ? 'bg-purple-500/20 text-purple-400' :
              partner.tier === 'strategic' ? 'bg-amber-500/20 text-amber-400' :
              'bg-blue-500/20 text-blue-400'
            }`}>
              {partner.tier}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Referral link + code */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-500 mb-1.5">Your Referral Link</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-300 truncate">
                  {referralLink}
                </code>
                <button
                  onClick={() => copyToClipboard(referralLink, 'link')}
                  className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors"
                >
                  {copied === 'link' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1.5">Referral Code</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-slate-800 px-3 py-2 text-sm font-mono text-slate-200">
                  {partner.referralCode}
                </code>
                <button
                  onClick={() => copyToClipboard(partner.referralCode, 'code')}
                  className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors"
                >
                  {copied === 'code' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Commission rate: {(partner.commissionRate * 100).toFixed(0)}%
            {partner.overrideRate ? ` + ${(partner.overrideRate * 100).toFixed(0)}% network override` : ''}
          </p>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          <StatsCard title="Total Earned" value={`$${kpis.totalEarned.toFixed(2)}`} subtitle="All time" icon={DollarSign} color="emerald" />
          <StatsCard title="Pending (in hold)" value={`$${kpis.pendingHold.toFixed(2)}`} subtitle="30-day hold" icon={Clock} color="amber" />
          <StatsCard title="Approved" value={`$${kpis.approvedPayable.toFixed(2)}`} subtitle="Ready for payout" icon={CheckCircle2} color="blue" />
          <StatsCard title="This Month" value={`$${kpis.monthEarnings.toFixed(2)}`} subtitle="Current month" icon={TrendingUp} color="purple" />
          <StatsCard title="Total Clicks" value={kpis.totalClicks} subtitle={`${kpis.monthClicks} this month`} icon={MousePointerClick} color="cyan" />
          <StatsCard title="Referrals" value={kpis.referralCount} subtitle={`${kpis.activeCustomers} active`} icon={Users} color="emerald" />
        </div>

        {/* Payout eligibility */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <div className="flex items-center gap-3">
            {payout.eligible ? (
              <>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-emerald-300">Eligible for payout</p>
                  <p className="text-xs text-slate-400">
                    ${payout.pendingAmount.toFixed(2)} pending — exceeds ${payout.threshold} minimum. Payouts are processed monthly via PayPal.
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
                    Minimum payout is ${payout.threshold}. Keep referring to reach the threshold!
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-800 flex gap-1">
          {(['referrals', 'commissions', 'payouts'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
                tab === t
                  ? 'border-brand-500 text-brand-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Referrals table */}
        {tab === 'referrals' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            {referrals.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No referrals yet. Share your referral link to start earning!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-800/50 text-xs text-slate-500">
                      <th className="px-4 py-3 font-medium">Organization</th>
                      <th className="px-4 py-3 font-medium">Signup Date</th>
                      <th className="px-4 py-3 font-medium">Plan</th>
                      <th className="px-4 py-3 font-medium text-right">Monthly</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium text-right">Commission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referrals.map((r) => (
                      <tr key={r.orgId} className="border-b border-slate-800/50">
                        <td className="px-4 py-3 text-slate-200">{r.orgName}</td>
                        <td className="px-4 py-3 text-slate-400">{new Date(r.signupDate).toLocaleDateString()}</td>
                        <td className="px-4 py-3 capitalize text-slate-400">{r.plan}</td>
                        <td className="px-4 py-3 text-right text-slate-300">${r.monthlyAmount.toFixed(0)}</td>
                        <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                        <td className="px-4 py-3 text-right text-emerald-400 font-medium">${r.commissionEarned.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Commissions table */}
        {tab === 'commissions' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            {commissions.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No commissions yet. Commissions are created when referred organizations make payments.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-800/50 text-xs text-slate-500">
                      <th className="px-4 py-3 font-medium">Period</th>
                      <th className="px-4 py-3 font-medium">Organization</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium text-right">Amount</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Hold Until</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissions.map((c) => (
                      <tr key={c.id} className="border-b border-slate-800/50">
                        <td className="px-4 py-3 text-slate-200">{c.period}</td>
                        <td className="px-4 py-3 text-slate-400">{c.orgName}</td>
                        <td className="px-4 py-3"><StatusBadge status={c.type} /></td>
                        <td className="px-4 py-3 text-right text-slate-200">${c.amount.toFixed(2)}</td>
                        <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                        <td className="px-4 py-3 text-slate-400">
                          {c.holdUntil ? new Date(c.holdUntil).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Payouts table */}
        {tab === 'payouts' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            {payouts.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No payouts yet. Payouts are processed monthly once you reach the $25 threshold.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-800/50 text-xs text-slate-500">
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium text-right">Amount</th>
                      <th className="px-4 py-3 font-medium">Method</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.map((p) => (
                      <tr key={p.id} className="border-b border-slate-800/50">
                        <td className="px-4 py-3 text-slate-200">{new Date(p.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-right text-slate-200">${p.amount.toFixed(2)}</td>
                        <td className="px-4 py-3 text-slate-400 capitalize">{p.method.replace('_', ' ')}</td>
                        <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Marketing materials */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <h3 className="font-semibold text-slate-200 mb-3">Marketing Materials</h3>
          <p className="text-sm text-slate-400 mb-4">
            Use these materials to promote LivAround and earn more commissions.
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { title: 'One-Pager PDF', desc: 'Product overview for sharing', icon: ExternalLink },
              { title: 'Email Templates', desc: 'Ready-to-send outreach emails', icon: ExternalLink },
              { title: 'Social Media Kit', desc: 'Graphics and copy for posts', icon: ExternalLink },
            ].map((item) => (
              <div key={item.title} className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg">
                <item.icon className="h-4 w-4 text-slate-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-300">{item.title}</p>
                  <p className="text-xs text-slate-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
