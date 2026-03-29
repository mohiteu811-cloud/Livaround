import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { IS_COMMERCIAL } from '../../../lib/config';
import { PLANS } from '../../../lib/commercial/plans';
import {
  createCheckoutSession,
  cancelSubscription,
  changePlan,
} from '../../../lib/commercial/subscriptions';

const router = Router();
router.use(authenticate);

/**
 * GET /api/billing/features
 * Returns the current org's plan name and full feature map.
 * When IS_COMMERCIAL is false, returns all features enabled with no plan requirement.
 */
router.get('/features', async (req: AuthRequest, res: Response) => {
  try {
    if (!IS_COMMERCIAL) {
      // Open-source mode: everything unlocked
      const allFeatures: Record<string, boolean> = {};
      for (const key of Object.keys(PLANS.agency.features)) {
        allFeatures[key] = true;
      }
      return res.json({ plan: null, features: allFeatures });
    }

    const host = await prisma.host.findUnique({
      where: { userId: req.user!.id },
      select: { organizationId: true },
    });

    if (!host?.organizationId) {
      // No org — community defaults
      return res.json({ plan: 'community', features: PLANS.community.features });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId: host.organizationId },
      include: { plan: true },
    });

    if (!subscription) {
      return res.json({ plan: 'community', features: PLANS.community.features });
    }

    return res.json({
      plan: subscription.plan.name,
      features: subscription.plan.features,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/billing/subscription
 * Returns the current org's subscription details, property count, and partner info.
 */
router.get('/subscription', async (req: AuthRequest, res: Response) => {
  try {
    if (!IS_COMMERCIAL) {
      return res.json({
        commercial: false,
        plan: null,
        status: null,
        propertyCount: 0,
        monthlyAmount: 0,
        subscription: null,
        partner: null,
      });
    }

    const host = await prisma.host.findUnique({
      where: { userId: req.user!.id },
      select: { organizationId: true, id: true },
    });

    if (!host?.organizationId) {
      return res.json({
        commercial: true,
        plan: 'community',
        status: null,
        propertyCount: 0,
        monthlyAmount: 0,
        subscription: null,
        partner: null,
      });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId: host.organizationId },
      include: { plan: true },
    });

    const propertyCount = await prisma.property.count({
      where: { hostId: host.id, isActive: true },
    });

    // Check if user is a partner
    const partner = await prisma.partner.findUnique({
      where: { userId: req.user!.id },
      select: { referralCode: true, tier: true, totalEarned: true, pendingPayout: true },
    });

    return res.json({
      commercial: true,
      plan: subscription?.plan.name ?? 'community',
      status: subscription?.status ?? null,
      propertyCount,
      monthlyAmount: subscription?.monthlyAmount ?? 0,
      currentPeriodStart: subscription?.currentPeriodStart ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      trialEndsAt: subscription?.trialEndsAt ?? null,
      cancelledAt: subscription?.cancelledAt ?? null,
      subscription: subscription
        ? {
            id: subscription.id,
            planName: subscription.plan.name,
            pricePerProperty: subscription.plan.pricePerProperty,
            flatPrice: subscription.plan.flatPrice,
          }
        : null,
      partner: partner
        ? {
            referralCode: partner.referralCode,
            tier: partner.tier,
            totalEarned: partner.totalEarned,
            pendingPayout: partner.pendingPayout,
          }
        : null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/billing/payments
 * Returns commission records as a proxy for payment history (payments the org made).
 */
router.get('/payments', async (req: AuthRequest, res: Response) => {
  try {
    if (!IS_COMMERCIAL) {
      return res.json({ payments: [] });
    }

    const host = await prisma.host.findUnique({
      where: { userId: req.user!.id },
      select: { organizationId: true },
    });

    if (!host?.organizationId) {
      return res.json({ payments: [] });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId: host.organizationId },
    });

    if (!subscription) {
      return res.json({ payments: [] });
    }

    // Use commissions as a record of payment periods
    const commissions = await prisma.commission.findMany({
      where: { subscriptionId: subscription.id },
      orderBy: { createdAt: 'desc' },
      take: 24,
    });

    // Build payment history from commissions — each period had a payment
    const periodsSeen = new Set<string>();
    const payments: { period: string; amount: number; date: string; status: string }[] = [];

    for (const c of commissions) {
      if (!periodsSeen.has(c.period)) {
        periodsSeen.add(c.period);
        payments.push({
          period: c.period,
          amount: subscription.monthlyAmount,
          date: c.createdAt.toISOString(),
          status: 'paid',
        });
      }
    }

    return res.json({ payments });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/billing/checkout
 * Creates a checkout session for a given plan.
 */
router.post('/checkout', async (req: AuthRequest, res: Response) => {
  try {
    const { planName } = req.body as { planName: string };
    if (!planName) return res.status(400).json({ error: 'planName is required' });

    const host = await prisma.host.findUnique({
      where: { userId: req.user!.id },
      select: { organizationId: true },
    });
    if (!host?.organizationId) {
      return res.status(400).json({ error: 'No organization linked to your account' });
    }

    const result = await createCheckoutSession(host.organizationId, planName, prisma);
    return res.json(result);
  } catch (err: unknown) {
    console.error(err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return res.status(400).json({ error: message });
  }
});

/**
 * POST /api/billing/cancel
 * Cancels the current subscription.
 */
router.post('/cancel', async (req: AuthRequest, res: Response) => {
  try {
    const host = await prisma.host.findUnique({
      where: { userId: req.user!.id },
      select: { organizationId: true },
    });
    if (!host?.organizationId) {
      return res.status(400).json({ error: 'No organization linked to your account' });
    }

    await cancelSubscription(host.organizationId, prisma);
    return res.json({ success: true });
  } catch (err: unknown) {
    console.error(err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return res.status(400).json({ error: message });
  }
});

/**
 * POST /api/billing/change-plan
 * Changes the subscription plan.
 */
router.post('/change-plan', async (req: AuthRequest, res: Response) => {
  try {
    const { planName } = req.body as { planName: string };
    if (!planName) return res.status(400).json({ error: 'planName is required' });

    const host = await prisma.host.findUnique({
      where: { userId: req.user!.id },
      select: { organizationId: true },
    });
    if (!host?.organizationId) {
      return res.status(400).json({ error: 'No organization linked to your account' });
    }

    const result = await changePlan(host.organizationId, planName, prisma);
    return res.json(result ?? { success: true });
  } catch (err: unknown) {
    console.error(err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return res.status(400).json({ error: message });
  }
});

export default router;
