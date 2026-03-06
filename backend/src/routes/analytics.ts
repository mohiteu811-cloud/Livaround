import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/dashboard', async (req: AuthRequest, res: Response) => {
  try {
    const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
    if (!host) return res.status(404).json({ error: 'Host not found' });

    const propertyIds = (
      await prisma.property.findMany({ where: { hostId: host.id }, select: { id: true } })
    ).map((p) => p.id);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      totalProperties,
      activeBookings,
      thisMonthBookings,
      lastMonthBookings,
      pendingJobs,
      completedJobsThisMonth,
      totalWorkers,
      recentBookings,
      upcomingJobs,
      jobsByStatus,
      bookingsBySource,
      allBookings,
    ] = await Promise.all([
      prisma.property.count({ where: { hostId: host.id, isActive: true } }),
      prisma.booking.count({
        where: { propertyId: { in: propertyIds }, status: { in: ['CONFIRMED', 'CHECKED_IN'] }, checkOut: { gte: now } },
      }),
      prisma.booking.aggregate({
        where: { propertyId: { in: propertyIds }, createdAt: { gte: startOfMonth }, status: { not: 'CANCELLED' } },
        _sum: { totalAmount: true }, _count: true,
      }),
      prisma.booking.aggregate({
        where: { propertyId: { in: propertyIds }, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth }, status: { not: 'CANCELLED' } },
        _sum: { totalAmount: true }, _count: true,
      }),
      prisma.job.count({ where: { propertyId: { in: propertyIds }, status: { in: ['PENDING', 'DISPATCHED'] } } }),
      prisma.job.count({ where: { propertyId: { in: propertyIds }, status: 'COMPLETED', completedAt: { gte: startOfMonth } } }),
      prisma.worker.count(),
      prisma.booking.findMany({
        where: { propertyId: { in: propertyIds } },
        orderBy: { createdAt: 'desc' }, take: 5,
        include: { property: { select: { name: true } } },
      }),
      prisma.job.findMany({
        where: { propertyId: { in: propertyIds }, status: { in: ['PENDING', 'DISPATCHED', 'ACCEPTED'] }, scheduledAt: { gte: now } },
        orderBy: { scheduledAt: 'asc' }, take: 5,
        include: {
          property: { select: { name: true } },
          worker: { include: { user: { select: { name: true } } } },
        },
      }),
      prisma.job.groupBy({ by: ['status'], where: { propertyId: { in: propertyIds } }, _count: true }),
      prisma.booking.groupBy({
        by: ['source'],
        where: { propertyId: { in: propertyIds }, status: { not: 'CANCELLED' } },
        _count: true, _sum: { totalAmount: true },
      }),
      // For revenue by month — fetch all non-cancelled bookings and group in JS
      prisma.booking.findMany({
        where: { propertyId: { in: propertyIds }, status: { not: 'CANCELLED' } },
        select: { checkIn: true, totalAmount: true },
      }),
    ]);

    // Low stock
    const allInventory = await prisma.inventoryItem.findMany({
      where: { propertyId: { in: propertyIds } },
      include: { property: { select: { name: true } } },
    });
    const lowStockAlerts = allInventory.filter((i) => i.currentStock <= i.minStock);

    // Revenue by month (last 6 months) — grouped in JS
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const revenueMap: Record<string, { revenue: number; bookings: number }> = {};
    for (const b of allBookings) {
      const d = new Date(b.checkIn);
      if (d < sixMonthsAgo) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en', { month: 'short', year: '2-digit' });
      if (!revenueMap[key]) revenueMap[key] = { revenue: 0, bookings: 0 };
      revenueMap[key].revenue += b.totalAmount;
      revenueMap[key].bookings += 1;
    }
    const revenueByMonth = Object.entries(revenueMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);

    // Manually build month labels
    const revenueByMonthLabeled = Object.entries(revenueMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => {
        const [y, m] = key.split('-');
        const d = new Date(parseInt(y), parseInt(m) - 1, 1);
        return { month: d.toLocaleString('en', { month: 'short', year: '2-digit' }), ...v };
      });

    const revenueGrowth =
      lastMonthBookings._sum.totalAmount && lastMonthBookings._sum.totalAmount > 0
        ? (((thisMonthBookings._sum.totalAmount || 0) - lastMonthBookings._sum.totalAmount) /
            lastMonthBookings._sum.totalAmount) * 100
        : null;

    return res.json({
      stats: {
        totalProperties,
        activeBookings,
        pendingJobs,
        totalWorkers,
        monthlyRevenue: thisMonthBookings._sum.totalAmount || 0,
        monthlyBookings: thisMonthBookings._count,
        completedJobsThisMonth,
        lowStockAlerts: lowStockAlerts.length,
        revenueGrowth,
      },
      recentBookings,
      upcomingJobs,
      jobsByStatus,
      bookingsBySource,
      revenueByMonth: revenueByMonthLabeled,
      lowStockAlerts,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
