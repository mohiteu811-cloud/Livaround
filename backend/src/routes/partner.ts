import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { IS_COMMERCIAL } from '../lib/config';
import { sendPartnerWelcomeEmail } from '../lib/partner-email';

const router = Router();

// ─── Helper: generate referral code (FIRSTNAME + 4 random digits) ───────────
function generateReferralCode(name: string): string {
  const base = name.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 10);
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `${base}${digits}`;
}

// ─── Helper: optional auth (partner dashboard can work with token or partner-token) ─
function optionalAuth(req: AuthRequest, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next();
  try {
    if (!process.env.JWT_SECRET) return next();
    const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET) as any;
    req.user = payload;
  } catch { /* continue unauthenticated */ }
  next();
}

// ─── Helper: partner auth via partner-token header ──────────────────────────
async function authenticatePartner(req: AuthRequest, res: Response, next: Function) {
  // First try JWT auth (for existing LivAround users who are also partners)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      if (!process.env.JWT_SECRET) throw new Error('no secret');
      const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET) as any;
      req.user = payload;
      return next();
    } catch { /* fall through to partner token */ }
  }

  // Then try partner-token (for standalone partners)
  const partnerToken = req.headers['x-partner-token'] as string;
  if (partnerToken) {
    try {
      if (!process.env.JWT_SECRET) throw new Error('no secret');
      const payload = jwt.verify(partnerToken, process.env.JWT_SECRET) as any;
      if (payload.partnerId) {
        (req as any).partnerId = payload.partnerId;
        return next();
      }
    } catch { /* fall through */ }
  }

  return res.status(401).json({ error: 'Authentication required' });
}

// ═════════════════════════════════════════════════════════════════════════════
// PUBLIC ENDPOINTS (no auth)
// ═════════════════════════════════════════════════════════════════════════════

const publicRegisterSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  paypalEmail: z.string().email(),
  country: z.string().min(2),
  promotionMethod: z.enum(['social_media', 'blog_content', 'direct_outreach', 'property_management', 'real_estate', 'other']),
});

/**
 * POST /api/partner/join
 * Public registration — anyone can sign up as a referral partner.
 */
router.post('/join', validate(publicRegisterSchema), async (req: Request, res: Response) => {
  try {
    if (!IS_COMMERCIAL) {
      return res.status(400).json({ error: 'Partner program is not available in community edition' });
    }

    const { fullName, email, paypalEmail, country, promotionMethod } = req.body;
    const normalizedEmail = email.trim().toLowerCase();

    // Check if already registered
    const existing = await prisma.partner.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(409).json({ error: 'This email is already registered as a partner' });
    }

    // Generate unique referral code
    let referralCode = generateReferralCode(fullName);
    let attempts = 0;
    while (attempts < 10) {
      const exists = await prisma.partner.findUnique({ where: { referralCode } });
      if (!exists) break;
      referralCode = generateReferralCode(fullName);
      attempts++;
    }

    // Check if there's an existing user with this email — link them
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    const partner = await prisma.partner.create({
      data: {
        userId: existingUser?.id ?? undefined,
        fullName,
        email: normalizedEmail,
        paypalEmail: paypalEmail.trim().toLowerCase(),
        country,
        promotionMethod,
        tier: 'referral',
        referralCode,
        commissionRate: 0.15, // 15% for referral tier
        totalEarned: 0,
        pendingPayout: 0,
        status: 'active',
      },
    });

    // Generate a partner token (for standalone partner dashboard access)
    const partnerToken = jwt.sign(
      { partnerId: partner.id, email: normalizedEmail },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '90d' }
    );

    // Send welcome email (fire-and-forget, don't block response)
    const referralLink = `https://livaround.com?ref=${referralCode}`;
    sendPartnerWelcomeEmail({
      name: fullName,
      email: normalizedEmail,
      referralCode,
      referralLink,
      dashboardUrl: `${process.env.DASHBOARD_URL || 'https://livarounddashboard-production.up.railway.app'}/partners/dashboard?token=${partnerToken}`,
    }).catch((emailErr) => {
      console.error('Failed to send partner welcome email:', emailErr);
    });

    return res.status(201).json({
      success: true,
      referralCode,
      referralLink,
      partnerToken,
      tier: 'referral',
      commissionRate: 0.15,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/partner/track-click
 * Track a referral link click (for analytics).
 */
router.post('/track-click', async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Missing referral code' });

    const partner = await prisma.partner.findUnique({ where: { referralCode: code } });
    if (!partner) return res.status(404).json({ error: 'Invalid referral code' });

    await prisma.referralClick.create({
      data: {
        partnerId: partner.id,
        ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || null,
        userAgent: req.headers['user-agent'] || null,
      },
    });

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/partner/validate-code/:code
 * Validate a referral code exists.
 */
router.get('/validate-code/:code', async (req: Request, res: Response) => {
  try {
    const partner = await prisma.partner.findUnique({
      where: { referralCode: req.params.code },
      select: { id: true, fullName: true, status: true },
    });
    if (!partner || partner.status !== 'active') {
      return res.json({ valid: false });
    }
    return res.json({ valid: true, partnerName: partner.fullName });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// AUTHENTICATED PARTNER ENDPOINTS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/partner/dashboard
 * Returns partner KPIs, referrals, and commission history.
 */
router.get('/dashboard', authenticatePartner, async (req: AuthRequest, res: Response) => {
  try {
    let partner: any;

    if ((req as any).partnerId) {
      partner = await prisma.partner.findUnique({ where: { id: (req as any).partnerId } });
    } else if (req.user) {
      partner = await prisma.partner.findUnique({ where: { userId: req.user.id } });
      if (!partner) {
        // Try by email
        partner = await prisma.partner.findUnique({ where: { email: req.user.email } });
      }
    }

    if (!partner) {
      return res.status(404).json({ error: 'not_a_partner' });
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      referredOrgs,
      commissions,
      monthEarnings,
      totalClicks,
      monthClicks,
      payouts,
    ] = await Promise.all([
      prisma.organization.findMany({
        where: { referredByPartnerId: partner.id },
        orderBy: { createdAt: 'desc' },
        include: {
          subscription: {
            include: { plan: { select: { name: true } } },
          },
          host: {
            select: {
              properties: { select: { id: true, isActive: true } },
            },
          },
        },
      }),
      prisma.commission.findMany({
        where: { partnerId: partner.id },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          subscription: {
            select: { organization: { select: { name: true } } },
          },
        },
      }),
      prisma.commission.aggregate({
        where: { partnerId: partner.id, createdAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      prisma.referralClick.count({ where: { partnerId: partner.id } }),
      prisma.referralClick.count({
        where: { partnerId: partner.id, createdAt: { gte: startOfMonth } },
      }),
      prisma.payout.findMany({
        where: { partnerId: partner.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    // Count active customers (active subscription)
    const activeCustomers = referredOrgs.filter(
      (org) => org.subscription?.status === 'active'
    ).length;

    // Count churned customers
    const churnedCustomers = referredOrgs.filter(
      (org) => org.subscription?.status === 'cancelled'
    ).length;

    // Build referrals table
    const referrals = referredOrgs.map((org) => {
      const orgCommissions = commissions.filter(
        (c) => c.subscription.organization.name === org.name
      );
      const totalCommission = orgCommissions.reduce((sum, c) => sum + c.amount, 0);
      const activeProperties = org.host?.properties?.filter(p => p.isActive).length ?? 0;

      return {
        orgId: org.id,
        orgName: org.name,
        plan: org.subscription?.plan?.name ?? 'community',
        monthlyAmount: org.subscription?.monthlyAmount ?? 0,
        status: org.subscription?.status ?? 'no_subscription',
        commissionRate: partner.commissionRate,
        commissionEarned: totalCommission,
        commissionStatus: orgCommissions[0]?.status ?? 'n/a',
        activeProperties,
        signupDate: org.createdAt.toISOString(),
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
      holdUntil: c.holdUntil?.toISOString() ?? null,
      paidAt: c.paidAt?.toISOString() ?? null,
      orgName: c.subscription.organization.name,
      createdAt: c.createdAt.toISOString(),
    }));

    // Pending earnings (in 30-day hold)
    const pendingHold = commissions
      .filter((c) => c.status === 'pending')
      .reduce((sum, c) => sum + c.amount, 0);

    // Approved (payable)
    const approvedPayable = commissions
      .filter((c) => c.status === 'approved')
      .reduce((sum, c) => sum + c.amount, 0);

    // Churn rate
    const totalReferred = referredOrgs.length;
    const churnRate = totalReferred > 0 ? churnedCustomers / totalReferred : 0;

    const PAYOUT_THRESHOLD = 25;

    return res.json({
      partner: {
        id: partner.id,
        fullName: partner.fullName,
        email: partner.email,
        referralCode: partner.referralCode,
        tier: partner.tier,
        commissionRate: partner.commissionRate,
        overrideRate: partner.overrideRate,
        status: partner.status,
      },
      kpis: {
        totalEarned: partner.totalEarned,
        pendingPayout: partner.pendingPayout,
        pendingHold,
        approvedPayable,
        monthEarnings: monthEarnings._sum.amount ?? 0,
        referralCount: referredOrgs.length,
        activeCustomers,
        churnedCustomers,
        churnRate,
        totalClicks,
        monthClicks,
        conversionRate: totalClicks > 0 ? referredOrgs.length / totalClicks : 0,
      },
      referrals,
      commissions: commissionHistory,
      payouts: payouts.map((p) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        method: p.method,
        status: p.status,
        processedAt: p.processedAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
      })),
      payout: {
        threshold: PAYOUT_THRESHOLD,
        eligible: partner.pendingPayout >= PAYOUT_THRESHOLD,
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
 * Register as a partner (for existing LivAround users).
 */
router.post('/register', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!IS_COMMERCIAL) {
      return res.status(400).json({ error: 'Partner program is not available in community edition' });
    }

    // Check if already a partner by userId or email
    const existing = await prisma.partner.findFirst({
      where: {
        OR: [
          { userId: req.user!.id },
          { email: req.user!.email },
        ],
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'You are already registered as a partner' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    let referralCode = generateReferralCode(user.name);
    let attempts = 0;
    while (attempts < 10) {
      const exists = await prisma.partner.findUnique({ where: { referralCode } });
      if (!exists) break;
      referralCode = generateReferralCode(user.name);
      attempts++;
    }

    const partner = await prisma.partner.create({
      data: {
        userId: req.user!.id,
        fullName: user.name,
        email: user.email,
        tier: 'referral',
        referralCode,
        commissionRate: 0.15,
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

/**
 * POST /api/partner/login
 * Login for standalone partners (no LivAround account).
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const normalizedEmail = email.trim().toLowerCase();
    const partner = await prisma.partner.findUnique({ where: { email: normalizedEmail } });
    if (!partner) {
      return res.status(404).json({ error: 'No partner account found with this email' });
    }

    // Send a magic link or return token directly (simplified: return token)
    const partnerToken = jwt.sign(
      { partnerId: partner.id, email: normalizedEmail },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '90d' }
    );

    return res.json({ success: true, partnerToken });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
