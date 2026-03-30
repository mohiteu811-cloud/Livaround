import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { processCommissionHolds, checkPartnerChurnRate } from '../lib/anti-gaming';

const router = Router();
router.use(authenticate);

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'mohit@livaround.com';

function requireAdmin(req: AuthRequest, res: Response): boolean {
  if (req.user?.email !== ADMIN_EMAIL) {
    res.status(403).json({ error: 'Admin access required' });
    return false;
  }
  return true;
}

/**
 * GET /api/admin/partners
 * List all partners with stats.
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const { status, tier, search, page = '1', limit = '50' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (status) where.status = status;
    if (tier) where.tier = tier;
    if (search) {
      where.OR = [
        { fullName: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { referralCode: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [partners, total] = await Promise.all([
      prisma.partner.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit as string),
        include: {
          _count: {
            select: {
              referredOrganizations: true,
              commissions: true,
              flags: true,
            },
          },
        },
      }),
      prisma.partner.count({ where }),
    ]);

    // Enrich each partner with computed stats
    const enriched = await Promise.all(partners.map(async (p) => {
      const referredOrgs = await prisma.organization.findMany({
        where: { referredByPartnerId: p.id },
        include: { subscription: { select: { status: true } } },
      });
      const activeCustomers = referredOrgs.filter(o => o.subscription?.status === 'active').length;
      const churned = referredOrgs.filter(o => o.subscription?.status === 'cancelled').length;
      const churnRate = referredOrgs.length > 0 ? churned / referredOrgs.length : 0;

      const pendingFlags = await prisma.partnerFlag.count({
        where: { partnerId: p.id, status: 'pending' },
      });

      return {
        id: p.id,
        fullName: p.fullName,
        email: p.email,
        paypalEmail: p.paypalEmail,
        country: p.country,
        promotionMethod: p.promotionMethod,
        tier: p.tier,
        referralCode: p.referralCode,
        commissionRate: p.commissionRate,
        status: p.status,
        suspendReason: p.suspendReason,
        totalEarned: p.totalEarned,
        pendingPayout: p.pendingPayout,
        referralCount: referredOrgs.length,
        activeCustomers,
        churned,
        churnRate,
        pendingFlags,
        createdAt: p.createdAt.toISOString(),
      };
    }));

    return res.json({
      partners: enriched,
      total,
      page: parseInt(page as string),
      totalPages: Math.ceil(total / parseInt(limit as string)),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/partners/flagged
 * Get all partners with pending flags.
 */
router.get('/flagged', async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const flags = await prisma.partnerFlag.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'desc' },
      include: {
        partner: {
          select: {
            id: true,
            fullName: true,
            email: true,
            referralCode: true,
            tier: true,
            status: true,
            totalEarned: true,
          },
        },
      },
    });

    return res.json({ flags });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/partners/health
 * Commission health panel — aggregate stats.
 */
router.get('/health', async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const [
      totalPartners,
      activePartners,
      suspendedPartners,
      totalCommissions,
      pendingCommissions,
      allPartners,
    ] = await Promise.all([
      prisma.partner.count(),
      prisma.partner.count({ where: { status: 'active' } }),
      prisma.partner.count({ where: { status: 'suspended' } }),
      prisma.commission.aggregate({ _sum: { amount: true } }),
      prisma.commission.aggregate({
        where: { status: 'pending' },
        _sum: { amount: true },
      }),
      prisma.partner.findMany({
        where: { status: 'active' },
        select: { id: true, fullName: true, email: true, referralCode: true },
      }),
    ]);

    // Compute per-partner churn rates and avg time-to-first-job
    const partnerHealth = await Promise.all(allPartners.map(async (p) => {
      const orgs = await prisma.organization.findMany({
        where: { referredByPartnerId: p.id },
        include: {
          subscription: { select: { status: true } },
          host: {
            select: {
              properties: {
                select: {
                  jobs: {
                    where: { status: 'COMPLETED' },
                    orderBy: { completedAt: 'asc' },
                    take: 1,
                    select: { completedAt: true },
                  },
                },
              },
            },
          },
        },
      });

      if (orgs.length === 0) return null;

      const churned = orgs.filter(o => o.subscription?.status === 'cancelled').length;
      const churnRate = orgs.length > 0 ? churned / orgs.length : 0;

      // Average days from org creation to first completed job
      const timesToFirstJob: number[] = [];
      for (const org of orgs) {
        const firstJob = org.host?.properties
          ?.flatMap(p => p.jobs)
          ?.find(j => j.completedAt);
        if (firstJob?.completedAt) {
          const days = (firstJob.completedAt.getTime() - org.createdAt.getTime()) / (1000 * 60 * 60 * 24);
          timesToFirstJob.push(days);
        }
      }
      const avgTimeToFirstJob = timesToFirstJob.length > 0
        ? timesToFirstJob.reduce((a, b) => a + b, 0) / timesToFirstJob.length
        : null;

      return {
        partnerId: p.id,
        partnerName: p.fullName,
        partnerEmail: p.email,
        referralCode: p.referralCode,
        referralCount: orgs.length,
        churnRate,
        avgTimeToFirstJob,
      };
    }));

    // High-volume partners (>5 referrals)
    const highVolume = partnerHealth
      .filter((p): p is NonNullable<typeof p> => p !== null && p.referralCount > 5)
      .sort((a, b) => b.referralCount - a.referralCount);

    // Average churn rate across all partners
    const partnerChurnRates = partnerHealth
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .map(p => p.churnRate);
    const avgChurnRate = partnerChurnRates.length > 0
      ? partnerChurnRates.reduce((a, b) => a + b, 0) / partnerChurnRates.length
      : 0;

    return res.json({
      summary: {
        totalPartners,
        activePartners,
        suspendedPartners,
        totalCommissionsAmount: totalCommissions._sum.amount ?? 0,
        pendingCommissionsAmount: pendingCommissions._sum.amount ?? 0,
        avgChurnRate,
      },
      highVolumePartners: highVolume.slice(0, 20),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/partners/flags/:flagId/review
 * Admin reviews a flag — approve, reject, or dismiss.
 */
router.post('/flags/:flagId/review', async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const { action } = req.body; // 'approve' | 'reject' | 'dismiss'
    if (!['approve', 'reject', 'dismiss'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be approve, reject, or dismiss.' });
    }

    const flag = await prisma.partnerFlag.findUnique({
      where: { id: req.params.flagId },
    });
    if (!flag) return res.status(404).json({ error: 'Flag not found' });

    await prisma.partnerFlag.update({
      where: { id: flag.id },
      data: {
        status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'dismissed',
        reviewedAt: new Date(),
        reviewedBy: req.user!.email,
      },
    });

    // If rejecting (confirming suspicion), suspend the partner
    if (action === 'reject') {
      await prisma.partner.update({
        where: { id: flag.partnerId },
        data: {
          status: 'suspended',
          suspendReason: `Suspended by admin review: ${flag.reason}`,
        },
      });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/partners/:id/suspend
 * Suspend a partner.
 */
router.post('/:id/suspend', async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const { reason } = req.body;
    await prisma.partner.update({
      where: { id: req.params.id },
      data: { status: 'suspended', suspendReason: reason || 'Suspended by admin' },
    });
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/partners/:id/activate
 * Reactivate a suspended partner.
 */
router.post('/:id/activate', async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    await prisma.partner.update({
      where: { id: req.params.id },
      data: { status: 'active', suspendReason: null },
    });
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/partners/:id/upgrade-tier
 * Manually upgrade a partner's tier.
 */
router.post('/:id/upgrade-tier', async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const { tier, commissionRate, overrideRate } = req.body;
    if (!['referral', 'channel', 'strategic'].includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier' });
    }

    const data: any = { tier };
    if (commissionRate !== undefined) data.commissionRate = commissionRate;
    if (overrideRate !== undefined) data.overrideRate = overrideRate;

    await prisma.partner.update({
      where: { id: req.params.id },
      data,
    });
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/partners/process-holds
 * Process pending commission holds (approve those past 30 days).
 */
router.post('/process-holds', async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const approved = await processCommissionHolds();
    return res.json({ success: true, approved });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
