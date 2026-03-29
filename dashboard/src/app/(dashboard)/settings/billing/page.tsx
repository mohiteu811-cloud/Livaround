'use client';

import { useEffect, useState } from 'react';
import {
  CreditCard,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  XCircle,
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
  Sparkles,
  Users,
  DollarSign,
} from 'lucide-react';
import { api, BillingSubscription, PaymentRecord } from '@/lib/api';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

const IS_COMMERCIAL = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === 'true';

// ── Status badge helper ──────────────────────────────────────────────────────

function subscriptionStatusBadge(status: string | null) {
  if (!status) return <Badge variant="default">No subscription</Badge>;
  const map: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
    active: { label: 'Active', variant: 'success' },
    trialing: { label: 'Trial', variant: 'info' },
    past_due: { label: 'Past due', variant: 'warning' },
    cancelled: { label: 'Cancelled', variant: 'danger' },
  };
  const entry = map[status] || { label: status, variant: 'default' as const };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}

// ── Confirm dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  loading,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
        <p className="mt-2 text-sm text-slate-400">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={loading}>
            Go back
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingSubscription | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!IS_COMMERCIAL) {
      setLoading(false);
      return;
    }
    Promise.all([
      api.billing.subscription(),
      api.billing.payments(),
    ])
      .then(([sub, pay]) => {
        setBilling(sub);
        setPayments(pay.payments);
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Open-source / self-hosted mode ──────────────────────────────────────
  if (!IS_COMMERCIAL) {
    return (
      <div className="p-4 md:p-8">
        <h1 className="text-2xl font-bold text-slate-100">Billing</h1>
        <Card className="mt-6 max-w-2xl">
          <CardBody>
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20">
                <Sparkles className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Community Edition</h2>
                <p className="mt-1 text-sm text-slate-400">
                  You&apos;re running the self-hosted Community edition &mdash; all features are
                  unlocked. No subscription or payment is required.
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-96">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!billing) {
    return (
      <div className="p-4 md:p-8 text-slate-400">Failed to load billing data.</div>
    );
  }

  // billing is guaranteed non-null past the loading/error guards above
  const b = billing!;

  const plan = b.plan ?? 'community';
  const isPro = plan === 'pro';
  const isAgency = plan === 'agency';
  const isCommunity = plan === 'community';
  const isActive = b.status === 'active' || b.status === 'trialing';

  // ── Action handlers ──────────────────────────────────────────────────────

  async function handleUpgrade(targetPlan: string) {
    setActionLoading(targetPlan);
    try {
      const result = isCommunity
        ? await api.billing.checkout(targetPlan)
        : await api.billing.changePlan(targetPlan);
      if (result?.approvalUrl) {
        window.location.href = result.approvalUrl;
      } else {
        // Reload billing state
        const sub = await api.billing.subscription();
        setBilling(sub);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancel() {
    setActionLoading('cancel');
    try {
      await api.billing.cancel();
      const sub = await api.billing.subscription();
      setBilling(sub);
      setShowCancelConfirm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  }

  function copyReferralLink() {
    if (!b?.partner) return;
    const link = `${window.location.origin}/signup?ref=${b.partner.referralCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Cost display ─────────────────────────────────────────────────────────

  function costDisplay() {
    if (isCommunity) return 'Free';
    if (isAgency) return '$100/mo flat (unlimited properties)';
    // Pro: count × $10
    const perProp = b.subscription?.pricePerProperty ?? 10;
    const total = b.propertyCount * perProp;
    return `${b.propertyCount} ${b.propertyCount === 1 ? 'property' : 'properties'} \u00d7 $${perProp} = $${total}/mo`;
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-8 space-y-6">
      <h1 className="text-2xl font-bold text-slate-100">Billing &amp; Subscription</h1>

      {/* Past due warning */}
      {b.status === 'past_due' && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
          <p className="text-sm text-amber-200">
            Your payment is past due. Please update your payment method to avoid service
            interruption.
          </p>
        </div>
      )}

      {/* Current plan card */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/20">
                <CreditCard className="h-5 w-5 text-brand-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Current Plan</p>
                <p className="text-lg font-bold capitalize text-slate-100">{plan}</p>
              </div>
            </div>
            <div className="mt-3">{subscriptionStatusBadge(b.status)}</div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20">
                <Building2 className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Properties</p>
                <p className="text-lg font-bold text-slate-100">{b.propertyCount}</p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/20">
                <DollarSign className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Monthly Cost</p>
                <p className="text-sm font-semibold text-slate-100">{costDisplay()}</p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Billing period */}
      {b.currentPeriodEnd && isActive && (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-slate-400">
              Current period:{' '}
              <span className="text-slate-200">
                {new Date(b.currentPeriodStart!).toLocaleDateString()} &mdash;{' '}
                {new Date(b.currentPeriodEnd).toLocaleDateString()}
              </span>
            </div>
            {b.cancelledAt && (
              <p className="text-sm text-amber-400">
                Access continues until {new Date(b.currentPeriodEnd).toLocaleDateString()}
              </p>
            )}
          </CardBody>
        </Card>
      )}

      {/* Plan actions */}
      <Card>
        <CardHeader title="Change Plan" />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Community */}
            <div
              className={`rounded-lg border p-4 ${
                isCommunity
                  ? 'border-brand-500 bg-brand-500/5'
                  : 'border-slate-700'
              }`}
            >
              <h4 className="font-semibold text-slate-100">Community</h4>
              <p className="mt-1 text-2xl font-bold text-slate-100">Free</p>
              <p className="mt-1 text-xs text-slate-500">Basic features, unlimited properties</p>
              {isCommunity ? (
                <p className="mt-4 text-xs font-medium text-brand-400">Current plan</p>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-4"
                  loading={actionLoading === 'community'}
                  onClick={() => handleUpgrade('community')}
                >
                  <ArrowDownRight className="h-3.5 w-3.5" /> Downgrade
                </Button>
              )}
            </div>

            {/* Pro */}
            <div
              className={`rounded-lg border p-4 ${
                isPro ? 'border-brand-500 bg-brand-500/5' : 'border-slate-700'
              }`}
            >
              <h4 className="font-semibold text-slate-100">Pro</h4>
              <p className="mt-1 text-2xl font-bold text-slate-100">
                $10<span className="text-sm font-normal text-slate-500">/property/mo</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">All features except white-label</p>
              {isPro ? (
                <p className="mt-4 text-xs font-medium text-brand-400">Current plan</p>
              ) : (
                <Button
                  variant={isCommunity ? 'primary' : 'secondary'}
                  size="sm"
                  className="mt-4"
                  loading={actionLoading === 'pro'}
                  onClick={() => handleUpgrade('pro')}
                >
                  {isCommunity || isAgency ? (
                    isAgency ? (
                      <><ArrowDownRight className="h-3.5 w-3.5" /> Downgrade</>
                    ) : (
                      <><ArrowUpRight className="h-3.5 w-3.5" /> Upgrade</>
                    )
                  ) : (
                    'Select'
                  )}
                </Button>
              )}
            </div>

            {/* Agency */}
            <div
              className={`rounded-lg border p-4 ${
                isAgency ? 'border-brand-500 bg-brand-500/5' : 'border-slate-700'
              }`}
            >
              <h4 className="font-semibold text-slate-100">Agency</h4>
              <p className="mt-1 text-2xl font-bold text-slate-100">
                $100<span className="text-sm font-normal text-slate-500">/mo</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">All features, unlimited, white-label</p>
              {isAgency ? (
                <p className="mt-4 text-xs font-medium text-brand-400">Current plan</p>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  className="mt-4"
                  loading={actionLoading === 'agency'}
                  onClick={() => handleUpgrade('agency')}
                >
                  <ArrowUpRight className="h-3.5 w-3.5" /> Upgrade
                </Button>
              )}
            </div>
          </div>

          {/* Cancel button */}
          {isActive && !isCommunity && !b.cancelledAt && (
            <div className="mt-6 border-t border-slate-800 pt-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-red-400 hover:text-red-300"
                onClick={() => setShowCancelConfirm(true)}
              >
                <XCircle className="h-4 w-4" /> Cancel subscription
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Payment history */}
      <Card>
        <CardHeader title="Payment History" />
        <CardBody>
          {payments.length === 0 ? (
            <p className="text-sm text-slate-500">No payments yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-500">
                    <th className="pb-2 pr-4 font-medium">Period</th>
                    <th className="pb-2 pr-4 font-medium">Date</th>
                    <th className="pb-2 pr-4 font-medium text-right">Amount</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.period} className="border-b border-slate-800/50">
                      <td className="py-3 pr-4 text-slate-200">{p.period}</td>
                      <td className="py-3 pr-4 text-slate-400">
                        {new Date(p.date).toLocaleDateString()}
                      </td>
                      <td className="py-3 pr-4 text-right text-slate-200">
                        ${p.amount.toFixed(2)}
                      </td>
                      <td className="py-3">
                        <Badge variant="success">Paid</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Partner / Referral section */}
      <Card>
        <CardHeader title="Partner Program" />
        <CardBody>
          {b.partner ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-xs text-slate-500">Tier</p>
                  <p className="mt-0.5 text-sm font-medium capitalize text-slate-200">
                    {b.partner.tier}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total earned</p>
                  <p className="mt-0.5 text-sm font-medium text-emerald-400">
                    ${b.partner.totalEarned.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Pending payout</p>
                  <p className="mt-0.5 text-sm font-medium text-amber-400">
                    ${b.partner.pendingPayout.toFixed(2)}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-1">Your referral link</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-300 truncate">
                    {typeof window !== 'undefined'
                      ? `${window.location.origin}/signup?ref=${b.partner.referralCode}`
                      : `https://app.livaround.com/signup?ref=${b.partner.referralCode}`}
                  </code>
                  <Button variant="secondary" size="sm" onClick={copyReferralLink}>
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-1">Referral code</p>
                <p className="text-sm font-mono text-slate-200">{b.partner.referralCode}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 shrink-0 text-slate-500 mt-0.5" />
              <div>
                <p className="text-sm text-slate-300">
                  Earn commissions by referring property managers to LivAround.
                </p>
                <a
                  href="/partners"
                  className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-400 hover:text-brand-300"
                >
                  Learn about the partner program <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Cancel confirmation dialog */}
      <ConfirmDialog
        open={showCancelConfirm}
        title="Cancel subscription?"
        message="Your subscription will remain active until the end of the current billing period, then downgrade to the free Community plan. You can re-subscribe at any time."
        confirmLabel="Cancel subscription"
        onConfirm={handleCancel}
        onCancel={() => setShowCancelConfirm(false)}
        loading={actionLoading === 'cancel'}
      />
    </div>
  );
}
