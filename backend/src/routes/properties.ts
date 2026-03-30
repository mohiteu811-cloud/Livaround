import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { syncPropertyCount } from '../lib/commercial/metering';

const router = Router();
router.use(authenticate);

const propertySchema = z.object({
  name: z.string().min(2),
  address: z.string().min(5),
  city: z.string().min(1),
  country: z.string().min(1),
  description: z.string().nullish(),
  type: z.string().default('VILLA'),
  bedrooms: z.number().int().min(0).default(1),
  bathrooms: z.number().int().min(0).default(1),
  maxGuests: z.number().int().min(1).default(2),
  amenities: z.array(z.string()).default([]),
  images: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  airbnbUrl: z.string().nullish(),
  caretakerType: z.enum(['FULL_TIME', 'PART_TIME']).default('PART_TIME'),
  wifiName: z.string().nullish(),
  wifiPassword: z.string().nullish(),
  mapUrl: z.string().nullish(),
  checkInInstructions: z.string().nullish(),
  houseRules: z.array(z.string()).optional(),
});

function parseJSON(s: string | null | undefined): string[] {
  try { return JSON.parse(s || '[]'); } catch { return []; }
}
function serializeProp(p: Record<string, unknown>) {
  return {
    ...p,
    amenities: parseJSON(p.amenities as string),
    images: parseJSON(p.images as string),
    houseRules: parseJSON((p.houseRules as string) || '[]'),
  };
}

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const properties = await prisma.property.findMany({
      where: { host: { userId: req.user!.id } },
      include: { _count: { select: { bookings: true, jobs: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(properties.map(serializeProp));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', validate(propertySchema), async (req: AuthRequest, res: Response) => {
  try {
    const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
    if (!host) return res.status(403).json({ error: 'Host profile not found' });
    const { amenities, images, houseRules, ...rest } = req.body;
    const property = await prisma.property.create({
      data: {
        ...rest,
        amenities: JSON.stringify(amenities),
        images: JSON.stringify(images),
        houseRules: houseRules ? JSON.stringify(houseRules) : '[]',
        hostId: host.id,
      },
    });
    if (host.organizationId) {
      await syncPropertyCount(host.organizationId, prisma);
    }
    return res.status(201).json(serializeProp(property as Record<string, unknown>));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const property = await prisma.property.findFirst({
      where: { id: req.params.id, host: { userId: req.user!.id } },
      include: {
        bookings: { orderBy: { checkIn: 'desc' }, take: 10 },
        inventoryItems: { orderBy: { category: 'asc' } },
        supplyCabinets: true,
        _count: { select: { bookings: true, jobs: true } },
      },
    });
    if (!property) return res.status(404).json({ error: 'Property not found' });
    return res.json(serializeProp(property as Record<string, unknown>));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', validate(propertySchema.partial()), async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.property.findFirst({
      where: { id: req.params.id, host: { userId: req.user!.id } },
      include: { host: { select: { organizationId: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'Property not found' });
    const { amenities, images, houseRules, ...rest } = req.body;
    const property = await prisma.property.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(amenities && { amenities: JSON.stringify(amenities) }),
        ...(images && { images: JSON.stringify(images) }),
        ...(houseRules !== undefined && { houseRules: JSON.stringify(houseRules) }),
      },
    });
    if (req.body.isActive !== undefined && existing.host.organizationId) {
      await syncPropertyCount(existing.host.organizationId, prisma);
    }
    return res.json(serializeProp(property as Record<string, unknown>));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.property.findFirst({
      where: { id: req.params.id, host: { userId: req.user!.id } },
      include: { host: { select: { organizationId: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'Property not found' });
    await prisma.property.delete({ where: { id: req.params.id } });
    if (existing.host.organizationId) {
      await syncPropertyCount(existing.host.organizationId, prisma);
    }
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
