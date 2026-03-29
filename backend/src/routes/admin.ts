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

export default router;
