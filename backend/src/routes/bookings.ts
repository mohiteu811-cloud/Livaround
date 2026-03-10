import { Router, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';

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
    });
    if (!existing) return res.status(404).json({ error: 'Booking not found' });

    const booking = await prisma.booking.update({
      where: { id: req.params.id },
      data: { status: 'CHECKED_OUT' },
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
