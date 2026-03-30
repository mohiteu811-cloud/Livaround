import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

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
 * GET /api/admin/stats
 * Returns platform-wide KPIs, MRR history, and recent subscription events.
 */
router.get('/stats', async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // ── KPI queries (run in parallel) ──────────────────────────────────────
    const [
      activeSubsAgg,
      activeSubsCount,
      cancelledThisMonth,
      trialsThisMonth,
      trialsConverted,
      totalProperties,
      pendingCommissions,
      allActiveSubs,
    ] = await Promise.all([
      // Total MRR from active subscriptions
      prisma.subscription.aggregate({
        where: { status: 'active' },
        _sum: { monthlyAmount: true },
      }),
      // Active subscription count
      prisma.subscription.count({ where: { status: 'active' } }),
      // Cancelled this month (for churn)
      prisma.subscription.count({
        where: {
          status: 'cancelled',
          cancelledAt: { gte: startOfMonth },
        },
      }),
      // Trials started this month
      prisma.subscription.count({
        where: {
          trialEndsAt: { not: null },
          createdAt: { gte: startOfMonth },
        },
      }),
      // Trials that converted to active this month
      prisma.subscription.count({
        where: {
          status: 'active',
          trialEndsAt: { not: null, lt: now },
          createdAt: { gte: startOfMonth },
        },
      }),
      // Total properties across all orgs
      prisma.property.count({ where: { isActive: true } }),
      // Pending partner commissions
      prisma.commission.aggregate({
        where: { status: 'pending' },
        _sum: { amount: true },
      }),
      // All active subs for ARPU calc
      prisma.subscription.findMany({
        where: { status: 'active' },
        select: { monthlyAmount: true },
      }),
    ]);

    const totalMRR = activeSubsAgg._sum.monthlyAmount ?? 0;
    const totalARR = totalMRR * 12;
    const activeCount = activeSubsCount;

    // Churn rate: cancelled this month / (active at start of month ≈ active now + cancelled)
    const startOfMonthBase = activeCount + cancelledThisMonth;
    const churnRate = startOfMonthBase > 0
      ? (cancelledThisMonth / startOfMonthBase) * 100
      : 0;

    // Trial conversion rate
    const trialConversionRate = trialsThisMonth > 0
      ? (trialsConverted / trialsThisMonth) * 100
      : 0;

    // Average revenue per org
    const arpu = activeCount > 0 ? totalMRR / activeCount : 0;

    const pendingPayouts = pendingCommissions._sum.amount ?? 0;

    // ── MRR history (last 12 months) ───────────────────────────────────────
    // We approximate by looking at subscription state per month.
    // For a proper implementation you'd track MRR snapshots — here we derive
    // from commissions + current subs.
    const mrrHistory: { month: string; pro: number; agency: number; total: number }[] = [];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

      // Subscriptions active during this month
      const activeDuring = await prisma.subscription.findMany({
        where: {
          currentPeriodStart: { lte: monthEnd },
          OR: [
            { status: 'active' },
            { status: 'cancelled', cancelledAt: { gte: d } },
          ],
          createdAt: { lte: monthEnd },
        },
        select: { monthlyAmount: true, plan: { select: { name: true } } },
      });

      let pro = 0;
      let agency = 0;
      for (const s of activeDuring) {
        if (s.plan.name === 'pro') pro += s.monthlyAmount;
        else if (s.plan.name === 'agency') agency += s.monthlyAmount;
      }

      mrrHistory.push({ month: monthStr, pro, agency, total: pro + agency });
    }

    // ── Recent subscription events ─────────────────────────────────────────
    // Combine recent creates, cancellations, and status changes
    const recentSubs = await prisma.subscription.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 10,
      include: {
        plan: { select: { name: true } },
        organization: { select: { name: true } },
      },
    });

    const events = recentSubs.map((s) => {
      let eventType: string;
      if (s.cancelledAt) {
        eventType = 'cancelled';
      } else if (s.status === 'past_due') {
        eventType = 'payment_failed';
      } else if (s.status === 'active' && s.updatedAt.getTime() - s.createdAt.getTime() < 60000) {
        eventType = 'new';
      } else {
        eventType = 'upgraded';
      }

      return {
        id: s.id,
        orgName: s.organization.name,
        planName: s.plan.name,
        eventType,
        monthlyAmount: s.monthlyAmount,
        date: s.updatedAt.toISOString(),
      };
    });

    return res.json({
      kpis: {
        totalMRR,
        totalARR,
        activeSubscriptions: activeCount,
        trialConversionRate,
        monthlyChurnRate: churnRate,
        arpu,
        totalProperties,
        pendingPayouts,
      },
      mrrHistory,
      recentEvents: events,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Organizations ───────────────────────────────────────────────────────────

/**
 * GET /api/admin/organizations
 * List all organizations with plan, subscription, property count, host info.
 * Query params: ?search=&plan=&status=&page=1&limit=25
 */
router.get('/organizations', async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const search = (req.query.search as string) || '';
    const planFilter = req.query.plan as string | undefined;
    const statusFilter = req.query.status as string | undefined;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { host: { user: { email: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    if (statusFilter) {
      where.subscription = statusFilter === 'none'
        ? null
        : { status: statusFilter };
    }

    if (planFilter) {
      if (planFilter === 'community') {
        // community = no subscription or subscription with community plan
        where.OR = [
          { subscription: null },
          { subscription: { plan: { name: 'community' } } },
          ...(where.OR ? (where.OR as unknown[]) : []),
        ];
      } else {
        where.subscription = {
          ...((where.subscription as Record<string, unknown>) || {}),
          plan: { name: planFilter },
        };
      }
    }

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          host: {
            include: {
              user: { select: { email: true, name: true } },
              properties: { where: { isActive: true }, select: { id: true } },
            },
          },
          subscription: {
            include: { plan: { select: { name: true } } },
          },
        },
      }),
      prisma.organization.count({ where }),
    ]);

    const rows = organizations.map((org) => ({
      id: org.id,
      name: org.name,
      ownerName: org.host?.user?.name ?? null,
      ownerEmail: org.host?.user?.email ?? null,
      plan: org.subscription?.plan?.name ?? 'community',
      status: org.subscription?.status ?? null,
      propertyCount: org.host?.properties?.length ?? 0,
      monthlyAmount: org.subscription?.monthlyAmount ?? 0,
      trialEndsAt: org.subscription?.trialEndsAt?.toISOString() ?? null,
      cancelledAt: org.subscription?.cancelledAt?.toISOString() ?? null,
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString(),
    }));

    return res.json({ organizations: rows, total, page, limit });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/organizations/:id
 * Full detail for one org including subscription history and payment log.
 */
router.get('/organizations/:id', async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.params.id },
      include: {
        host: {
          include: {
            user: { select: { email: true, name: true, phone: true } },
            properties: {
              select: { id: true, name: true, city: true, isActive: true, createdAt: true },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        subscription: {
          include: {
            plan: true,
            commissions: {
              orderBy: { createdAt: 'desc' },
              take: 50,
              include: { partner: { select: { referralCode: true, user: { select: { name: true } } } } },
            },
          },
        },
        referredByPartner: {
          select: { referralCode: true, user: { select: { name: true, email: true } } },
        },
      },
    });

    if (!org) return res.status(404).json({ error: 'Organization not found' });

    // Build payment history from commissions
    const paymentPeriods = new Set<string>();
    const payments: { period: string; amount: number; date: string }[] = [];
    if (org.subscription) {
      for (const c of org.subscription.commissions) {
        if (!paymentPeriods.has(c.period)) {
          paymentPeriods.add(c.period);
          payments.push({
            period: c.period,
            amount: org.subscription.monthlyAmount,
            date: c.createdAt.toISOString(),
          });
        }
      }
    }

    return res.json({
      id: org.id,
      name: org.name,
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString(),
      owner: org.host
        ? {
            name: org.host.user?.name,
            email: org.host.user?.email,
            phone: org.host.user?.phone,
          }
        : null,
      properties: org.host?.properties ?? [],
      subscription: org.subscription
        ? {
            id: org.subscription.id,
            plan: org.subscription.plan.name,
            status: org.subscription.status,
            monthlyAmount: org.subscription.monthlyAmount,
            propertyCount: org.subscription.propertyCount,
            currentPeriodStart: org.subscription.currentPeriodStart.toISOString(),
            currentPeriodEnd: org.subscription.currentPeriodEnd.toISOString(),
            trialEndsAt: org.subscription.trialEndsAt?.toISOString() ?? null,
            cancelledAt: org.subscription.cancelledAt?.toISOString() ?? null,
            createdAt: org.subscription.createdAt.toISOString(),
            paypalSubId: org.subscription.paypalSubId,
          }
        : null,
      payments,
      referredBy: org.referredByPartner
        ? {
            code: org.referredByPartner.referralCode,
            name: org.referredByPartner.user?.name,
            email: org.referredByPartner.user?.email,
          }
        : null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/organizations/:id/change-plan
 * Manually upgrade/downgrade an org's plan.
 */
router.post('/organizations/:id/change-plan', async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const { planName } = req.body as { planName: string };
    if (!planName) return res.status(400).json({ error: 'planName is required' });

    const plan = await prisma.plan.findFirst({ where: { name: planName } });
    if (!plan) return res.status(400).json({ error: `Plan '${planName}' not found` });

    const org = await prisma.organization.findUnique({
      where: { id: req.params.id },
      include: { subscription: true, host: { select: { id: true } } },
    });
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    // Count properties for amount calculation
    const propertyCount = org.host
      ? await prisma.property.count({ where: { hostId: org.host.id, isActive: true } })
      : 0;

    const monthlyAmount = plan.flatPrice ?? (plan.pricePerProperty ?? 0) * propertyCount;

    if (org.subscription) {
      await prisma.subscription.update({
        where: { id: org.subscription.id },
        data: {
          planId: plan.id,
          status: 'active',
          monthlyAmount,
          propertyCount,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelledAt: null,
        },
      });
    } else {
      await prisma.subscription.create({
        data: {
          organizationId: org.id,
          planId: plan.id,
          status: 'active',
          monthlyAmount,
          propertyCount,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });
    }

    console.log(`[admin] Plan changed for org ${org.id} to ${planName} by ${req.user!.email}`);
    return res.json({ success: true, plan: planName, monthlyAmount });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/organizations/:id/extend-trial
 * Extend or set trial end date for an org.
 */
router.post('/organizations/:id/extend-trial', async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const { days } = req.body as { days: number };
    if (!days || days < 1) return res.status(400).json({ error: 'days must be >= 1' });

    const org = await prisma.organization.findUnique({
      where: { id: req.params.id },
      include: { subscription: true },
    });
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    if (!org.subscription) return res.status(400).json({ error: 'No subscription to extend trial for' });

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + days);

    await prisma.subscription.update({
      where: { id: org.subscription.id },
      data: { status: 'trialing', trialEndsAt },
    });

    console.log(`[admin] Trial extended by ${days} days for org ${org.id} by ${req.user!.email}`);
    return res.json({ success: true, trialEndsAt: trialEndsAt.toISOString() });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Subscriptions ───────────────────────────────────────────────────────────

/**
 * GET /api/admin/subscriptions
 * List all subscriptions with filters.
 * Query params: ?status=&plan=&page=1&limit=25
 */
router.get('/subscriptions', async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const statusFilter = req.query.status as string | undefined;
    const planFilter = req.query.plan as string | undefined;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (statusFilter) where.status = statusFilter;
    if (planFilter) where.plan = { name: planFilter };

    const [subscriptions, total, pastDueCount] = await Promise.all([
      prisma.subscription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          plan: { select: { name: true } },
          organization: {
            select: {
              id: true,
              name: true,
              host: {
                select: { user: { select: { email: true, name: true } } },
              },
            },
          },
        },
      }),
      prisma.subscription.count({ where }),
      prisma.subscription.count({ where: { status: 'past_due' } }),
    ]);

    const rows = subscriptions.map((s) => ({
      id: s.id,
      organizationId: s.organization.id,
      orgName: s.organization.name,
      ownerName: s.organization.host?.user?.name ?? null,
      ownerEmail: s.organization.host?.user?.email ?? null,
      plan: s.plan.name,
      status: s.status,
      monthlyAmount: s.monthlyAmount,
      propertyCount: s.propertyCount,
      currentPeriodStart: s.currentPeriodStart.toISOString(),
      currentPeriodEnd: s.currentPeriodEnd.toISOString(),
      trialEndsAt: s.trialEndsAt?.toISOString() ?? null,
      cancelledAt: s.cancelledAt?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));

    // Past-due subscriptions for the alert section
    let pastDue: typeof rows = [];
    if (!statusFilter || statusFilter === 'past_due') {
      const pastDueSubs = await prisma.subscription.findMany({
        where: { status: 'past_due' },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        include: {
          plan: { select: { name: true } },
          organization: {
            select: {
              id: true,
              name: true,
              host: { select: { user: { select: { email: true, name: true } } } },
            },
          },
        },
      });

      pastDue = pastDueSubs.map((s) => ({
        id: s.id,
        organizationId: s.organization.id,
        orgName: s.organization.name,
        ownerName: s.organization.host?.user?.name ?? null,
        ownerEmail: s.organization.host?.user?.email ?? null,
        plan: s.plan.name,
        status: s.status,
        monthlyAmount: s.monthlyAmount,
        propertyCount: s.propertyCount,
        currentPeriodStart: s.currentPeriodStart.toISOString(),
        currentPeriodEnd: s.currentPeriodEnd.toISOString(),
        trialEndsAt: s.trialEndsAt?.toISOString() ?? null,
        cancelledAt: s.cancelledAt?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      }));
    }

    return res.json({ subscriptions: rows, total, page, limit, pastDueCount, pastDue });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
