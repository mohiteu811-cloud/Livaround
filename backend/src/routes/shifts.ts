import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { sendPushNotification } from '../lib/pushNotifications';

const router = Router();
router.use(authenticate);

function isClient(req: AuthRequest) { return req.user!.role === 'CLIENT'; }
function isWorker(req: AuthRequest) { return req.user!.role === 'WORKER'; }

const SHIFT_INCLUDE = {
  venue: { select: { id: true, name: true, address: true, city: true } },
  client: { select: { id: true, businessName: true, businessType: true } },
  _count: { select: { applications: true } },
} as const;

const createShiftSchema = z.object({
  venueId: z.string(),
  role: z.enum(['WAITER', 'BARTENDER', 'COOK', 'HOUSEKEEPER', 'SECURITY', 'DRIVER', 'CLEANER', 'OTHER']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  hourlyRate: z.number().positive(),
  currency: z.string().default('INR'),
  workersNeeded: z.number().int().min(1).max(50).default(1),
  notes: z.string().optional(),
  requirements: z.array(z.string()).optional(),
  urgency: z.enum(['ASAP', 'SCHEDULED']).default('SCHEDULED'),
});

const rateSchema = z.object({
  rating: z.number().int().min(1).max(5),
  note: z.string().optional(),
});

// GET /api/shifts — client sees their shifts; worker sees their applied shifts
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { status, upcoming } = req.query;

    if (isClient(req)) {
      const client = await prisma.client.findUnique({ where: { userId: req.user!.id } });
      if (!client) return res.json([]);

      const where: Record<string, unknown> = { clientId: client.id };
      if (status) where.status = status;
      if (upcoming === 'true') {
        const today = new Date().toISOString().slice(0, 10);
        where.date = { gte: today };
        where.status = { in: ['OPEN', 'PARTIALLY_FILLED', 'FILLED', 'IN_PROGRESS'] };
      }

      const shifts = await prisma.shift.findMany({
        where,
        include: {
          ...SHIFT_INCLUDE,
          applications: {
            where: { status: { in: ['CONFIRMED', 'COMPLETED'] } },
            include: { worker: { include: { user: { select: { name: true, phone: true } } } } },
          },
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      });

      return res.json(shifts.map(parseShift));
    }

    if (isWorker(req)) {
      const worker = await prisma.worker.findUnique({ where: { userId: req.user!.id } });
      if (!worker) return res.json([]);

      const applications = await prisma.shiftApplication.findMany({
        where: { workerId: worker.id, ...(status ? { status: status as string } : {}) },
        include: {
          shift: {
            include: {
              ...SHIFT_INCLUDE,
              applications: { where: { status: 'CONFIRMED' }, select: { id: true } },
            },
          },
          checkIn: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return res.json(applications.map((a) => ({ ...a, shift: parseShift(a.shift) })));
    }

    return res.status(403).json({ error: 'Access denied' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/shifts/available — workers see open shifts in their city matching their skills
router.get('/available', async (req: AuthRequest, res: Response) => {
  try {
    if (!isWorker(req)) return res.status(403).json({ error: 'Workers only' });

    const worker = await prisma.worker.findUnique({ where: { userId: req.user!.id } });
    if (!worker) return res.json([]);

    const today = new Date().toISOString().slice(0, 10);

    const where: Record<string, unknown> = {
      status: { in: ['OPEN', 'PARTIALLY_FILLED'] },
      date: { gte: today },
    };

    // City-based filtering when worker has city set
    if (worker.city) {
      where.venue = { city: { equals: worker.city, mode: 'insensitive' } };
    }

    // Exclude shifts the worker has already applied to
    const alreadyApplied = await prisma.shiftApplication.findMany({
      where: { workerId: worker.id, status: { not: 'WITHDRAWN' } },
      select: { shiftId: true },
    });
    const excludeIds = alreadyApplied.map((a) => a.shiftId);
    if (excludeIds.length > 0) {
      where.id = { notIn: excludeIds };
    }

    const shifts = await prisma.shift.findMany({
      where,
      include: SHIFT_INCLUDE,
      orderBy: [{ urgency: 'asc' }, { date: 'asc' }, { startTime: 'asc' }],
    });

    return res.json(shifts.map(parseShift));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/shifts — client posts a shift
router.post('/', validate(createShiftSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!isClient(req)) return res.status(403).json({ error: 'Clients only' });

    const client = await prisma.client.findUnique({ where: { userId: req.user!.id } });
    if (!client) return res.status(404).json({ error: 'Client not found' });

    // Verify venue belongs to this client
    const venue = await prisma.venue.findFirst({ where: { id: req.body.venueId, clientId: client.id } });
    if (!venue) return res.status(403).json({ error: 'Venue not found or access denied' });

    const { requirements, ...rest } = req.body;
    const shift = await prisma.shift.create({
      data: {
        ...rest,
        clientId: client.id,
        requirements: requirements ? JSON.stringify(requirements) : '[]',
      },
      include: SHIFT_INCLUDE,
    });

    // Dispatch push notifications to available workers in the same city
    const workers = await prisma.worker.findMany({
      where: {
        isAvailable: true,
        pushToken: { not: null },
        city: { equals: venue.city, mode: 'insensitive' },
      },
      select: { pushToken: true },
    });

    const roleLabel = shift.role.charAt(0) + shift.role.slice(1).toLowerCase();
    const rateLabel = `${shift.currency === 'INR' ? '₹' : shift.currency}${shift.hourlyRate}/hr`;
    const body = `${roleLabel} at ${venue.name} · ${rateLabel} · ${shift.date} ${shift.startTime}–${shift.endTime}`;

    await Promise.allSettled(
      workers
        .filter((w) => w.pushToken)
        .map((w) =>
          sendPushNotification(w.pushToken!, {
            title: `New Shift Available`,
            body,
            data: { shiftId: shift.id },
            sound: 'default',
            priority: 'high',
            channelId: 'shifts',
          })
        )
    );

    return res.status(201).json(parseShift(shift));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/shifts/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    let where: Record<string, unknown> = { id: req.params.id };

    if (isClient(req)) {
      const client = await prisma.client.findUnique({ where: { userId: req.user!.id } });
      if (client) where.clientId = client.id;
    }

    const shift = await prisma.shift.findFirst({
      where,
      include: {
        venue: true,
        client: { select: { id: true, businessName: true, businessType: true } },
        applications: {
          include: {
            worker: { include: { user: { select: { name: true, phone: true, email: true } } } },
            checkIn: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    return res.json(parseShift(shift));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/shifts/:id/cancel — client cancels a shift
router.post('/:id/cancel', async (req: AuthRequest, res: Response) => {
  try {
    if (!isClient(req)) return res.status(403).json({ error: 'Clients only' });

    const client = await prisma.client.findUnique({ where: { userId: req.user!.id } });
    if (!client) return res.status(403).json({ error: 'Client not found' });

    const shift = await prisma.shift.findFirst({
      where: { id: req.params.id, clientId: client.id, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
    });
    if (!shift) return res.status(404).json({ error: 'Shift not found or cannot be cancelled' });

    const updated = await prisma.shift.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/shifts/:id/apply — worker applies for a shift (auto-confirms if slots available)
router.post('/:id/apply', async (req: AuthRequest, res: Response) => {
  try {
    if (!isWorker(req)) return res.status(403).json({ error: 'Workers only' });

    const worker = await prisma.worker.findUnique({ where: { userId: req.user!.id } });
    if (!worker) return res.status(403).json({ error: 'Worker not found' });

    const shift = await prisma.shift.findFirst({
      where: { id: req.params.id, status: { in: ['OPEN', 'PARTIALLY_FILLED'] } },
      include: { venue: { select: { name: true } } },
    });
    if (!shift) return res.status(404).json({ error: 'Shift not available' });

    // Check for duplicate application
    const existing = await prisma.shiftApplication.findUnique({
      where: { shiftId_workerId: { shiftId: shift.id, workerId: worker.id } },
    });
    if (existing && existing.status !== 'WITHDRAWN') {
      return res.status(409).json({ error: 'Already applied to this shift' });
    }

    // Count current confirmed applications
    const confirmedCount = await prisma.shiftApplication.count({
      where: { shiftId: shift.id, status: 'CONFIRMED' },
    });

    const autoConfirm = confirmedCount < shift.workersNeeded;
    const newStatus = autoConfirm ? 'CONFIRMED' : 'PENDING';
    const newConfirmedCount = autoConfirm ? confirmedCount + 1 : confirmedCount;

    // Determine new shift status
    let shiftStatus = shift.status;
    if (autoConfirm) {
      if (newConfirmedCount >= shift.workersNeeded) {
        shiftStatus = 'FILLED';
      } else {
        shiftStatus = 'PARTIALLY_FILLED';
      }
    }

    const [application] = await prisma.$transaction([
      existing
        ? prisma.shiftApplication.update({
            where: { id: existing.id },
            data: { status: newStatus, confirmedAt: autoConfirm ? new Date() : null },
            include: { shift: { include: SHIFT_INCLUDE }, checkIn: true },
          })
        : prisma.shiftApplication.create({
            data: {
              shiftId: shift.id,
              workerId: worker.id,
              status: newStatus,
              confirmedAt: autoConfirm ? new Date() : null,
            },
            include: { shift: { include: SHIFT_INCLUDE }, checkIn: true },
          }),
      prisma.shift.update({ where: { id: shift.id }, data: { status: shiftStatus } }),
    ]);

    return res.status(201).json(application);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/shifts/:id/applications/:appId/withdraw — worker withdraws
router.post('/:id/applications/:appId/withdraw', async (req: AuthRequest, res: Response) => {
  try {
    if (!isWorker(req)) return res.status(403).json({ error: 'Workers only' });

    const worker = await prisma.worker.findUnique({ where: { userId: req.user!.id } });
    if (!worker) return res.status(403).json({ error: 'Worker not found' });

    const application = await prisma.shiftApplication.findFirst({
      where: { id: req.params.appId, workerId: worker.id, shiftId: req.params.id },
    });
    if (!application) return res.status(404).json({ error: 'Application not found' });
    if (['WITHDRAWN', 'COMPLETED', 'NO_SHOW'].includes(application.status)) {
      return res.status(400).json({ error: 'Cannot withdraw at this stage' });
    }

    const wasConfirmed = application.status === 'CONFIRMED';

    const updated = await prisma.shiftApplication.update({
      where: { id: req.params.appId },
      data: { status: 'WITHDRAWN' },
    });

    // Re-open shift slot if this was a confirmed application
    if (wasConfirmed) {
      const confirmedCount = await prisma.shiftApplication.count({
        where: { shiftId: req.params.id, status: 'CONFIRMED' },
      });
      const shift = await prisma.shift.findUnique({ where: { id: req.params.id } });
      if (shift && shift.status !== 'CANCELLED') {
        const newStatus = confirmedCount === 0 ? 'OPEN' : 'PARTIALLY_FILLED';
        await prisma.shift.update({ where: { id: req.params.id }, data: { status: newStatus } });
      }
    }

    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/shifts/:id/applications/:appId/checkin — worker checks in
router.post('/:id/applications/:appId/checkin', async (req: AuthRequest, res: Response) => {
  try {
    if (!isWorker(req)) return res.status(403).json({ error: 'Workers only' });

    const worker = await prisma.worker.findUnique({ where: { userId: req.user!.id } });
    if (!worker) return res.status(403).json({ error: 'Worker not found' });

    const application = await prisma.shiftApplication.findFirst({
      where: { id: req.params.appId, workerId: worker.id, shiftId: req.params.id, status: 'CONFIRMED' },
    });
    if (!application) return res.status(404).json({ error: 'Confirmed application not found' });

    const checkIn = await prisma.shiftCheckIn.upsert({
      where: { applicationId: req.params.appId },
      create: { applicationId: req.params.appId, checkInAt: new Date() },
      update: { checkInAt: new Date() },
    });

    // Move shift to IN_PROGRESS if not already
    await prisma.shift.update({
      where: { id: req.params.id },
      data: { status: 'IN_PROGRESS' },
    });

    return res.json(checkIn);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/shifts/:id/applications/:appId/checkout — worker checks out
router.post('/:id/applications/:appId/checkout', async (req: AuthRequest, res: Response) => {
  try {
    if (!isWorker(req)) return res.status(403).json({ error: 'Workers only' });

    const worker = await prisma.worker.findUnique({ where: { userId: req.user!.id } });
    if (!worker) return res.status(403).json({ error: 'Worker not found' });

    const application = await prisma.shiftApplication.findFirst({
      where: { id: req.params.appId, workerId: worker.id, shiftId: req.params.id, status: 'CONFIRMED' },
      include: { checkIn: true },
    });
    if (!application) return res.status(404).json({ error: 'Application not found' });
    if (!application.checkIn?.checkInAt) return res.status(400).json({ error: 'Must check in first' });

    const checkOutAt = new Date();
    const hoursWorked =
      (checkOutAt.getTime() - application.checkIn.checkInAt.getTime()) / (1000 * 60 * 60);

    const checkIn = await prisma.shiftCheckIn.update({
      where: { applicationId: req.params.appId },
      data: { checkOutAt, hoursWorked: Math.round(hoursWorked * 100) / 100 },
    });

    // Mark application as completed and increment worker counter
    await prisma.$transaction([
      prisma.shiftApplication.update({
        where: { id: req.params.appId },
        data: { status: 'COMPLETED' },
      }),
      prisma.worker.update({
        where: { id: worker.id },
        data: { shiftsCompleted: { increment: 1 } },
      }),
    ]);

    // Check if all confirmed workers have checked out → mark shift COMPLETED
    const pendingCheckouts = await prisma.shiftApplication.count({
      where: { shiftId: req.params.id, status: 'CONFIRMED' },
    });
    if (pendingCheckouts === 0) {
      await prisma.shift.update({ where: { id: req.params.id }, data: { status: 'COMPLETED' } });
    }

    return res.json(checkIn);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/shifts/:id/applications/:appId/rate — client rates a worker after shift
router.post('/:id/applications/:appId/rate', validate(rateSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!isClient(req)) return res.status(403).json({ error: 'Clients only' });

    const client = await prisma.client.findUnique({ where: { userId: req.user!.id } });
    if (!client) return res.status(403).json({ error: 'Client not found' });

    // Verify shift belongs to this client
    const shift = await prisma.shift.findFirst({ where: { id: req.params.id, clientId: client.id } });
    if (!shift) return res.status(404).json({ error: 'Shift not found' });

    const application = await prisma.shiftApplication.findFirst({
      where: { id: req.params.appId, shiftId: req.params.id, status: 'COMPLETED' },
    });
    if (!application) return res.status(404).json({ error: 'Completed application not found' });

    const updated = await prisma.shiftApplication.update({
      where: { id: req.params.appId },
      data: { clientRating: req.body.rating, clientNote: req.body.note },
    });

    // Recalculate worker's average rating across all rated shift applications
    const ratedApps = await prisma.shiftApplication.findMany({
      where: { workerId: application.workerId, clientRating: { not: null } },
      select: { clientRating: true },
    });
    if (ratedApps.length > 0) {
      const avg = ratedApps.reduce((sum, a) => sum + (a.clientRating ?? 0), 0) / ratedApps.length;
      await prisma.worker.update({
        where: { id: application.workerId },
        data: { rating: Math.round(avg * 100) / 100 },
      });
    }

    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

function parseShift(shift: Record<string, unknown>) {
  return {
    ...shift,
    requirements:
      typeof shift.requirements === 'string'
        ? (() => { try { return JSON.parse(shift.requirements as string); } catch { return []; } })()
        : (shift.requirements ?? []),
  };
}

export default router;
