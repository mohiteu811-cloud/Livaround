import { Router, Response } from 'express';
import { prisma } from '../../../../backend/src/lib/prisma';
import { authenticate, AuthRequest } from '../../../../backend/src/middleware/auth';

const router = Router();
router.use(authenticate);

// ── GET /api/host-app/dashboard ───────────────────────────────────────────────
// Aggregated summary for the host mobile app home screen

router.get('/dashboard', async (req: AuthRequest, res: Response) => {
  try {
    const host = await prisma.host.findUnique({
      where: { userId: req.user!.id },
      select: { id: true, organizationId: true },
    });
    if (!host) return res.status(403).json({ error: 'Host not found' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const hostProperties = await prisma.property.findMany({
      where: { hostId: host.id },
      select: { id: true },
    });
    const propertyIds = hostProperties.map((p) => p.id);

    const [
      todayCheckIns,
      todayCheckOuts,
      pendingJobs,
      activeBookings,
      unreadMessages,
      openIssues,
      propertyCount,
    ] = await Promise.all([
      prisma.booking.count({
        where: { propertyId: { in: propertyIds }, checkIn: { gte: today, lt: tomorrow }, status: 'CONFIRMED' },
      }),
      prisma.booking.count({
        where: { propertyId: { in: propertyIds }, checkOut: { gte: today, lt: tomorrow }, status: 'CHECKED_IN' },
      }),
      prisma.job.count({
        where: { propertyId: { in: propertyIds }, status: { in: ['PENDING', 'ACCEPTED'] } },
      }),
      prisma.booking.count({
        where: { propertyId: { in: propertyIds }, status: { in: ['CONFIRMED', 'CHECKED_IN'] }, checkOut: { gte: today } },
      }),
      prisma.conversation.aggregate({
        where: { hostId: host.id },
        _sum: { unreadByHost: true },
      }),
      prisma.issue.count({
        where: { propertyId: { in: propertyIds }, status: 'OPEN' },
      }),
      hostProperties.length,
    ]);

    // Get subscription status
    let subscription = null;
    if (host.organizationId) {
      subscription = await prisma.subscription.findUnique({
        where: { organizationId: host.organizationId },
        include: { plan: { select: { name: true, features: true } } },
      });
    }

    return res.json({
      todayCheckIns,
      todayCheckOuts,
      pendingJobs,
      activeBookings,
      unreadMessages: unreadMessages._sum.unreadByHost || 0,
      openIssues,
      propertyCount,
      subscription: subscription
        ? {
            plan: subscription.plan.name,
            status: subscription.status,
            features: subscription.plan.features,
          }
        : { plan: 'community', status: 'active', features: {} },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/host-app/bookings-calendar?month=YYYY-MM ─────────────────────────
// Bookings grouped by date for calendar view

router.get('/bookings-calendar', async (req: AuthRequest, res: Response) => {
  try {
    const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
    if (!host) return res.status(403).json({ error: 'Host not found' });

    const month = req.query.month as string;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'month query param required (YYYY-MM)' });
    }

    const [year, mon] = month.split('-').map(Number);
    const startDate = new Date(year, mon - 1, 1);
    const endDate = new Date(year, mon, 0, 23, 59, 59);

    const hostProperties = await prisma.property.findMany({
      where: { hostId: host.id },
      select: { id: true },
    });
    const propertyIds = hostProperties.map((p) => p.id);

    const bookings = await prisma.booking.findMany({
      where: {
        propertyId: { in: propertyIds },
        OR: [
          { checkIn: { gte: startDate, lte: endDate } },
          { checkOut: { gte: startDate, lte: endDate } },
          { checkIn: { lte: startDate }, checkOut: { gte: endDate } },
        ],
      },
      include: {
        property: { select: { id: true, name: true } },
      },
      orderBy: { checkIn: 'asc' },
    });

    return res.json(bookings);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/host-app/register-push-token ────────────────────────────────────
// Store Expo push token on Host model

router.post('/register-push-token', async (req: AuthRequest, res: Response) => {
  try {
    const { pushToken } = req.body;
    if (!pushToken || typeof pushToken !== 'string') {
      return res.status(400).json({ error: 'pushToken is required' });
    }

    const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
    if (!host) return res.status(403).json({ error: 'Host not found' });

    await prisma.host.update({
      where: { id: host.id },
      data: { pushToken },
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/host-app/settings ─────────────────────────────────────────────────

router.get('/settings', async (req: AuthRequest, res: Response) => {
  try {
    const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
    if (!host) return res.status(403).json({ error: 'Host not found' });
    return res.json({ autoDispatch: host.autoDispatch });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /api/host-app/settings ──────────────────────────────────────────────

router.patch('/settings', async (req: AuthRequest, res: Response) => {
  try {
    const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
    if (!host) return res.status(403).json({ error: 'Host not found' });

    const updateData: any = {};
    if (typeof req.body.autoDispatch === 'boolean') {
      updateData.autoDispatch = req.body.autoDispatch;
    }

    await prisma.host.update({ where: { id: host.id }, data: updateData });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
