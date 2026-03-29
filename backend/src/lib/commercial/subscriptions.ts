import { PrismaClient } from '@prisma/client';
import { IS_COMMERCIAL } from '../config';
import { PLANS, PLAN_HIERARCHY, PlanName } from './plans';
import { calculateMonthlyAmount, syncPropertyCount } from './metering';

// ── PayPal helpers ───────────────────────────────────────────────────────────

export const PAYPAL_BASE =
  process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

export async function paypalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) throw new Error('PayPal credentials not configured');

  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PayPal auth failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export async function paypalRequest<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const token = await paypalAccessToken();
  const res = await fetch(`${PAYPAL_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal ${method} ${path} failed (${res.status}): ${text}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Plan → PayPal plan ID mapping ────────────────────────────────────────────
// These are set via env vars so each deployment can point at its own PayPal
// catalog without code changes.

function paypalPlanId(planName: string): string {
  const envKey = `PAYPAL_PLAN_ID_${planName.toUpperCase()}`;
  const id = process.env[envKey];
  if (!id) throw new Error(`${envKey} is not configured`);
  return id;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Create a PayPal subscription and return the approval URL so the user
 * can complete payment.  No-op when IS_COMMERCIAL is false.
 */
export async function createCheckoutSession(
  orgId: string,
  planName: string,
  prisma: PrismaClient,
): Promise<{ approvalUrl: string; paypalSubId: string } | null> {
  if (!IS_COMMERCIAL) return null;

  const plan = PLANS[planName as PlanName];
  if (!plan) throw new Error(`Unknown plan: ${planName}`);
  if (planName === 'community') throw new Error('Community plan is free — no checkout needed');

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new Error(`Organization ${orgId} not found`);

  const ppPlanId = paypalPlanId(planName);

  // Use per-property quantity for Pro, fixed for Agency
  const quantity = plan.pricePerProperty != null
    ? String(await countActiveProperties(orgId, prisma))
    : '1';

  const returnUrl = `${process.env.APP_URL || 'http://localhost:3000'}/settings/billing/success`;
  const cancelUrl = `${process.env.APP_URL || 'http://localhost:3000'}/settings/billing`;

  interface PayPalSubscription {
    id: string;
    status: string;
    links: { rel: string; href: string }[];
  }

  const sub = await paypalRequest<PayPalSubscription>(
    'POST',
    '/v1/billing/subscriptions',
    {
      plan_id: ppPlanId,
      quantity,
      custom_id: orgId,
      application_context: {
        brand_name: 'LivAround',
        return_url: returnUrl,
        cancel_url: cancelUrl,
        user_action: 'SUBSCRIBE_NOW',
      },
    },
  );

  const approveLink = sub.links.find((l) => l.rel === 'approve');
  if (!approveLink) throw new Error('PayPal did not return an approval URL');

  return { approvalUrl: approveLink.href, paypalSubId: sub.id };
}

/**
 * Called when PayPal confirms the subscription is active (webhook
 * BILLING.SUBSCRIPTION.ACTIVATED).  Creates or updates the local
 * Subscription record.
 */
export async function handleSubscriptionActivated(
  paypalSubId: string,
  prisma: PrismaClient,
): Promise<void> {
  if (!IS_COMMERCIAL) return;

  // Fetch the full subscription from PayPal to get custom_id (orgId) + plan
  interface PayPalSubDetail {
    id: string;
    plan_id: string;
    custom_id: string;
    status: string;
    billing_info?: {
      next_billing_time?: string;
      last_payment?: { amount?: { value?: string } };
    };
    start_time: string;
  }
  const ppSub = await paypalRequest<PayPalSubDetail>(
    'GET',
    `/v1/billing/subscriptions/${paypalSubId}`,
  );

  const orgId = ppSub.custom_id;
  if (!orgId) throw new Error(`PayPal subscription ${paypalSubId} has no custom_id`);

  // Resolve the local plan from the PayPal plan ID
  const plan = await resolvePlanFromPayPal(ppSub.plan_id, prisma);

  const now = new Date();
  const periodEnd = ppSub.billing_info?.next_billing_time
    ? new Date(ppSub.billing_info.next_billing_time)
    : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const monthlyAmount = await calculateMonthlyAmount(orgId, prisma);

  const existing = await prisma.subscription.findUnique({
    where: { organizationId: orgId },
  });

  if (existing) {
    await prisma.subscription.update({
      where: { id: existing.id },
      data: {
        planId: plan.id,
        status: 'active',
        paypalSubId,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        monthlyAmount,
        cancelledAt: null,
      },
    });
  } else {
    await prisma.subscription.create({
      data: {
        organizationId: orgId,
        planId: plan.id,
        status: 'active',
        paypalSubId,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        monthlyAmount,
        propertyCount: 0,
      },
    });
  }

  // Sync property count so monthlyAmount is accurate
  await syncPropertyCount(orgId, prisma);
}

/**
 * Called on each successful recurring payment (webhook
 * PAYMENT.SALE.COMPLETED).  Updates period dates and creates
 * partner commissions if applicable.
 */
export async function handlePaymentCompleted(
  paypalSubId: string,
  amount: number,
  prisma: PrismaClient,
): Promise<void> {
  if (!IS_COMMERCIAL) return;

  const subscription = await prisma.subscription.findFirst({
    where: { paypalSubId },
    include: { organization: true },
  });
  if (!subscription) return;

  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      monthlyAmount: amount,
    },
  });

  // ── Partner commissions ──────────────────────────────────────────────────
  const org = subscription.organization;
  if (org.referredByPartnerId) {
    const partner = await prisma.partner.findUnique({
      where: { id: org.referredByPartnerId },
    });
    if (partner && partner.status === 'active') {
      const commission = amount * partner.commissionRate;

      await prisma.commission.create({
        data: {
          partnerId: partner.id,
          subscriptionId: subscription.id,
          type: 'direct',
          amount: commission,
          period,
          status: 'pending',
        },
      });

      await prisma.partner.update({
        where: { id: partner.id },
        data: { pendingPayout: { increment: commission } },
      });

      // Override commission for the partner who referred this partner
      if (partner.referredById) {
        const upline = await prisma.partner.findUnique({
          where: { id: partner.referredById },
        });
        if (upline && upline.status === 'active' && upline.overrideRate) {
          const override = amount * upline.overrideRate;

          await prisma.commission.create({
            data: {
              partnerId: upline.id,
              subscriptionId: subscription.id,
              type: 'override',
              amount: override,
              period,
              status: 'pending',
            },
          });

          await prisma.partner.update({
            where: { id: upline.id },
            data: { pendingPayout: { increment: override } },
          });
        }
      }
    }
  }
}

/**
 * Called when PayPal reports a subscription cancelled (webhook
 * BILLING.SUBSCRIPTION.CANCELLED).  Marks as cancelled and lets
 * the org keep access until the current period ends.
 */
export async function handleSubscriptionCancelled(
  paypalSubId: string,
  prisma: PrismaClient,
): Promise<void> {
  if (!IS_COMMERCIAL) return;

  const subscription = await prisma.subscription.findFirst({
    where: { paypalSubId },
  });
  if (!subscription) return;

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: 'cancelled',
      cancelledAt: new Date(),
    },
  });
}

/**
 * Initiate cancellation through the PayPal API.
 * The subscription stays active until the current period ends.
 */
export async function cancelSubscription(
  orgId: string,
  prisma: PrismaClient,
): Promise<void> {
  if (!IS_COMMERCIAL) return;

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: orgId },
  });
  if (!subscription?.paypalSubId) return;

  await paypalRequest(
    'POST',
    `/v1/billing/subscriptions/${subscription.paypalSubId}/cancel`,
    { reason: 'Customer requested cancellation' },
  );

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: 'cancelled',
      cancelledAt: new Date(),
    },
  });
}

/**
 * Change plan (upgrade Pro→Agency or downgrade Agency→Pro).
 *
 * - Upgrades take effect immediately: the old PayPal subscription is
 *   cancelled and a new checkout session is created for the new plan.
 * - Downgrades keep the current plan until the period ends, then switch.
 *   For now we cancel + re-subscribe so the user goes through checkout.
 */
export async function changePlan(
  orgId: string,
  newPlanName: string,
  prisma: PrismaClient,
): Promise<{ approvalUrl: string; paypalSubId: string } | null> {
  if (!IS_COMMERCIAL) return null;

  const newPlan = PLANS[newPlanName as PlanName];
  if (!newPlan) throw new Error(`Unknown plan: ${newPlanName}`);

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: orgId },
    include: { plan: true },
  });

  if (!subscription) {
    // No existing subscription — just create a checkout
    return createCheckoutSession(orgId, newPlanName, prisma);
  }

  const currentIdx = PLAN_HIERARCHY.indexOf(subscription.plan.name as PlanName);
  const newIdx = PLAN_HIERARCHY.indexOf(newPlanName as PlanName);

  if (currentIdx === newIdx) {
    throw new Error(`Already on the ${newPlanName} plan`);
  }

  if (newPlanName === 'community') {
    // Downgrade to free: cancel PayPal, mark as cancelled — access continues
    // until currentPeriodEnd, then a scheduled job downgrades the plan.
    await cancelSubscription(orgId, prisma);
    return null;
  }

  // Cancel the old PayPal subscription before creating the new one
  if (subscription.paypalSubId) {
    await paypalRequest(
      'POST',
      `/v1/billing/subscriptions/${subscription.paypalSubId}/cancel`,
      { reason: `Switching to ${newPlanName} plan` },
    );
  }

  // Create new checkout session for the target plan
  return createCheckoutSession(orgId, newPlanName, prisma);
}

// ── Internal helpers ─────────────────────────────────────────────────────────

async function countActiveProperties(
  orgId: string,
  prisma: PrismaClient,
): Promise<number> {
  const host = await prisma.host.findUnique({
    where: { organizationId: orgId },
    select: { id: true },
  });
  if (!host) return 1; // at least 1 so the subscription covers something
  const count = await prisma.property.count({
    where: { hostId: host.id, isActive: true },
  });
  return Math.max(count, 1);
}

async function resolvePlanFromPayPal(
  paypalPlanId: string,
  prisma: PrismaClient,
): Promise<{ id: string; name: string }> {
  // Check each configured PayPal plan ID env var to find the match
  for (const name of PLAN_HIERARCHY) {
    const envKey = `PAYPAL_PLAN_ID_${name.toUpperCase()}`;
    if (process.env[envKey] === paypalPlanId) {
      const plan = await prisma.plan.findFirst({ where: { name } });
      if (plan) return plan;
    }
  }
  throw new Error(`No local plan matches PayPal plan ID: ${paypalPlanId}`);
}
