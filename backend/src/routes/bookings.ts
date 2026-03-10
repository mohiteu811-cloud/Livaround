import { Router, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { sendPushNotification } from '../lib/pushNotifications';

const router = Router();
router.use(authenticate);

const bookingSchema = z.object({
  propertyId: z.string(),
  guestName: z.string().min(2),
  guestEmail: z.preprocess((v) => (v === '' ? null : v), z.string().email().nullish()),
  guestPhone: z.preprocess((v) => (v === '' ? null : v), z.string().nullish()),
  checkIn: z.string().datetime(),
  checkOut: z.string().datetime(),
  guestCount: z.number().int().min(1).default(1),
  totalAmount: z.number().min(0),
  currency: z.string().default('INR'),
  status: z.enum(['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED']).default('CONFIRMED'),
  source: z.enum(['DIRECT', 'AIRBNB', 'BOOKING_COM', 'VRBO', 'LIVAROUND']).default('DIRECT'),
  externalId: z.string().nullish(),
  notes: z.string().nullish(),
  lockCode: z.string().nullish(),
});

function generateGuestCode(): string {
  return crypto.randomBytes(4).toString('hex');
}

async function assertPropertyAccess(userId: string, propertyId: string) {
  const prop = await prisma.property.findFirst({
    where: { id: propertyId, host: { userId } },
  });
  return !!prop;
}

const PRE_CHECKIN_NOTES = 'Pre-checkin cleaning';
const POST_CHECKOUT_NOTES = 'Post-checkout cleaning';

const CLEANING_CHECKLIST = JSON.stringify([
  { item: 'Vacuum all rooms', done: false },
  { item: 'Change bed linens', done: false },
  { item: 'Clean bathrooms', done: false },
  { item: 'Restock toiletries', done: false },
  { item: 'Clean kitchen', done: false },
  { item: 'Empty bins', done: false },
]);

/** Find the first CLEANER (preferred) or CARETAKER assigned to a property. */
async function findPropertyCleaner(propertyId: string) {
  const staff = await prisma.propertyStaff.findMany({
    where: { propertyId, role: { in: ['CLEANER', 'CARETAKER'] } },
    include: { worker: { select: { id: true, pushToken: true, user: { select: { name: true } } } } },
    orderBy: { role: 'asc' }, // CARETAKER < CLEANER alphabetically; we'll sort below
  });
  // Prefer CLEANER over CARETAKER
  const cleaner = staff.find((s) => s.role === 'CLEANER') ?? staff.find((s) => s.role === 'CARETAKER');
  return cleaner?.worker ?? null;
}

/** Create a CLEANING job and auto-assign it to the property cleaner/caretaker if one is set. */
async function autoCreateCleaningJob({
  propertyId,
  propertyName,
  bookingId,
  scheduledAt,
  notes,
}: {
  propertyId: string;
  propertyName: string;
  bookingId: string;
  scheduledAt: Date;
  notes: string;
}) {
  const worker = await findPropertyCleaner(propertyId);

  const job = await prisma.job.create({
    data: {
      propertyId,
      bookingId,
      type: 'CLEANING',
      status: worker ? 'ACCEPTED' : 'PENDING',
      scheduledAt,
      notes,
      checklist: CLEANING_CHECKLIST,
      ...(worker ? { workerId: worker.id } : {}),
    },
  });

  if (worker?.pushToken) {
    await sendPushNotification(worker.pushToken, {
      title: 'New Cleaning Job 🧹',
      body: `You have a cleaning job at ${propertyName} on ${scheduledAt.toLocaleDateString()}`,
      data: { jobId: job.id },
      sound: 'default',
      priority: 'high',
      channelId: 'jobs',
    });
  }

  return job;
}

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { propertyId, status, source } = req.query;

    const bookings = await prisma.booking.findMany({
      where: {
        property: { host: { userId: req.user!.id } },
        ...(propertyId ? { propertyId: propertyId as string } : {}),
        ...(status ? { status: status as 'CONFIRMED' } : {}),
        ...(source ? { source: source as 'DIRECT' } : {}),
      },
      include: {
        property: { select: { id: true, name: true, city: true } },
        _count: { select: { jobs: true } },
      },
      orderBy: { checkIn: 'desc' },
    });
    return res.json(bookings);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', validate(bookingSchema), async (req: AuthRequest, res: Response) => {
  try {
    const canAccess = await assertPropertyAccess(req.user!.id, req.body.propertyId);
    if (!canAccess) return res.status(403).json({ error: 'Property not found or access denied' });

    // Generate unique guest code
    let guestCode = generateGuestCode();
    while (await prisma.booking.findUnique({ where: { guestCode } })) {
      guestCode = generateGuestCode();
    }

    const booking = await prisma.booking.create({ data: { ...req.body, guestCode } });

    const property = await prisma.property.findUnique({
      where: { id: booking.propertyId },
      select: { name: true },
    });

    // Skip pre-checkin cleaning job if the previous booking's post-checkout
    // cleaning was already completed (the place is already clean).
    const prevBooking = await prisma.booking.findFirst({
      where: {
        propertyId: booking.propertyId,
        checkOut: { lte: new Date(booking.checkIn) },
        id: { not: booking.id },
        status: { not: 'CANCELLED' },
      },
      orderBy: { checkOut: 'desc' },
      include: {
        jobs: {
          where: { type: 'CLEANING', notes: POST_CHECKOUT_NOTES, status: 'COMPLETED' },
        },
      },
    });

    const prevCheckoutCleanDone = (prevBooking?.jobs?.length ?? 0) > 0;

    if (!prevCheckoutCleanDone) {
      await autoCreateCleaningJob({
        propertyId: booking.propertyId,
        propertyName: property?.name ?? 'the property',
        bookingId: booking.id,
        scheduledAt: new Date(booking.checkIn),
        notes: PRE_CHECKIN_NOTES,
      });
    }

    return res.status(201).json(booking);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const booking = await prisma.booking.findFirst({
      where: { id: req.params.id, property: { host: { userId: req.user!.id } } },
      include: {
        property: { select: { id: true, name: true, city: true, country: true } },
        jobs: { include: { worker: { include: { user: { select: { name: true, email: true } } } } } },
      },
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    return res.json(booking);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', validate(bookingSchema.partial()), async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.booking.findFirst({
      where: { id: req.params.id, property: { host: { userId: req.user!.id } } },
      include: { property: { select: { name: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'Booking not found' });

    // Auto-generate guestCode if this booking doesn't have one yet
    let extraData: Record<string, string> = {};
    if (!existing.guestCode) {
      let guestCode = generateGuestCode();
      while (await prisma.booking.findUnique({ where: { guestCode } })) {
        guestCode = generateGuestCode();
      }
      extraData = { guestCode };
    }

    const booking = await prisma.booking.update({ where: { id: req.params.id }, data: { ...req.body, ...extraData } });

    // If checkIn changed, update the pre-checkin cleaning job and notify the worker
    if (req.body.checkIn && req.body.checkIn !== existing.checkIn.toISOString()) {
      const newCheckIn = new Date(req.body.checkIn);
      const preCheckinJob = await prisma.job.findFirst({
        where: {
          bookingId: existing.id,
          type: 'CLEANING',
          notes: PRE_CHECKIN_NOTES,
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
        include: { worker: { select: { pushToken: true } } },
      });

      if (preCheckinJob) {
        await prisma.job.update({
          where: { id: preCheckinJob.id },
          data: { scheduledAt: newCheckIn },
        });

        if (preCheckinJob.worker?.pushToken) {
          await sendPushNotification(preCheckinJob.worker.pushToken, {
            title: 'Cleaning Schedule Changed 🕐',
            body: `Check-in time at ${existing.property.name} updated to ${newCheckIn.toLocaleString()}`,
            data: { jobId: preCheckinJob.id },
            sound: 'default',
            priority: 'high',
            channelId: 'jobs',
          });
        }
      }
    }

    return res.json(booking);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/checkin', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.booking.findFirst({
      where: { id: req.params.id, property: { host: { userId: req.user!.id } } },
    });
    if (!existing) return res.status(404).json({ error: 'Booking not found' });

    const booking = await prisma.booking.update({
      where: { id: req.params.id },
      data: { status: 'CHECKED_IN' },
    });
    return res.json(booking);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/checkout', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.booking.findFirst({
      where: { id: req.params.id, property: { host: { userId: req.user!.id } } },
      include: { property: { select: { name: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'Booking not found' });

    const booking = await prisma.booking.update({
      where: { id: req.params.id },
      data: { status: 'CHECKED_OUT' },
    });

    // Auto-create and claim post-checkout cleaning job
    await autoCreateCleaningJob({
      propertyId: existing.propertyId,
      propertyName: existing.property.name,
      bookingId: existing.id,
      scheduledAt: new Date(),
      notes: POST_CHECKOUT_NOTES,
    });

    return res.json(booking);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.booking.findFirst({
      where: { id: req.params.id, property: { host: { userId: req.user!.id } } },
    });
    if (!existing) return res.status(404).json({ error: 'Booking not found' });

    await prisma.booking.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
