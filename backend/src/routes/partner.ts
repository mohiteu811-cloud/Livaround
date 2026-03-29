import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { IS_COMMERCIAL } from '../lib/config';

const router = Router();
router.use(authenticate);

/**
 * GET /api/partner/dashboard
 * Returns partner KPIs, referrals, and commission history.
 */
router.get('/dashboard', async (req: AuthRequest, res: Response) => {
  try {
    const partner = await prisma.partner.findUnique({
      where: { userId: req.user!.id },
    });

    if (!partner) {
      return res.status(404).json({ error: 'not_a_partner' });
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Run all queries in parallel
    const [
      referredOrgs,
      commissions,
      monthEarnings,
    ] = await Promise.all([
      // All referred organizations with their subscriptions
      prisma.organization.findMany({
        where: { referredByPartnerId: partner.id },
        orderBy: { createdAt: 'desc' },
        include: {
          subscription: {
            include: { plan: { select: { name: true } } },
          },
        },
      }),
      // All commissions for this partner
      prisma.commission.findMany({
        where: { partnerId: partner.id },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          subscription: {
            select: {
              organization: { select: { name: true } },
            },
          },
        },
      }),
      // This month's earnings
      prisma.commission.aggregate({
        where: {
          partnerId: partner.id,
          createdAt: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),
    ]);

    // Build referrals table
    const referrals = referredOrgs.map((org) => {
      // Sum commissions earned from this org
      const orgCommissions = commissions.filter(
        (c) => c.subscription.organization.name === org.name
      );
      const totalCommission = orgCommissions.reduce((sum, c) => sum + c.amount, 0);

      return {
        orgId: org.id,
        orgName: org.name,
        plan: org.subscription?.plan?.name ?? 'community',
        monthlyAmount: org.subscription?.monthlyAmount ?? 0,
        status: org.subscription?.status ?? 'no_subscription',
        commissionRate: partner.commissionRate,
        commissionEarned: totalCommission,
        createdAt: org.createdAt.toISOString(),
      };
    });

    // Build commission history
    const commissionHistory = commissions.map((c) => ({
      id: c.id,
      period: c.period,
      type: c.type,
      amount: c.amount,
      currency: c.currency,
      status: c.status,
      paidAt: c.paidAt?.toISOString() ?? null,
      orgName: c.subscription.organization.name,
      createdAt: c.createdAt.toISOString(),
    }));

    // Payout eligibility
    const PAYOUT_THRESHOLD = 25;
    const eligible = partner.pendingPayout >= PAYOUT_THRESHOLD;

    return res.json({
      partner: {
        referralCode: partner.referralCode,
        tier: partner.tier,
        commissionRate: partner.commissionRate,
        overrideRate: partner.overrideRate,
        status: partner.status,
      },
      kpis: {
        totalEarned: partner.totalEarned,
        pendingPayout: partner.pendingPayout,
        monthEarnings: monthEarnings._sum.amount ?? 0,
        referralCount: referredOrgs.length,
      },
      referrals,
      commissions: commissionHistory,
      payout: {
        threshold: PAYOUT_THRESHOLD,
        eligible,
        pendingAmount: partner.pendingPayout,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/partner/register
 * Register as a partner (self-service).
 */
router.post('/register', async (req: AuthRequest, res: Response) => {
  try {
    if (!IS_COMMERCIAL) {
      return res.status(400).json({ error: 'Partner program is not available in community edition' });
    }

    const existing = await prisma.partner.findUnique({
      where: { userId: req.user!.id },
    });

    if (existing) {
      return res.status(400).json({ error: 'You are already registered as a partner' });
    }

    // Generate referral code from user name + random suffix
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const baseCode = user.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 8);
    const suffix = Math.random().toString(36).slice(2, 6);
    const referralCode = `${baseCode}-${suffix}`;

    const partner = await prisma.partner.create({
      data: {
        userId: req.user!.id,
        tier: 'referral',
        referralCode,
        commissionRate: 0.2, // 20% default
        totalEarned: 0,
        pendingPayout: 0,
        status: 'active',
      },
    });

    return res.json({
      success: true,
      referralCode: partner.referralCode,
      tier: partner.tier,
      commissionRate: partner.commissionRate,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
