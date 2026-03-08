import { Router, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();
router.use(authenticate);

const createOwnerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
});

const linkPropertySchema = z.object({
  propertyId: z.string(),
  involvementLevel: z.enum(['NONE', 'REPORTS_ONLY', 'FINANCIAL', 'FULL']).default('REPORTS_ONLY'),
  ownershipPercent: z.number().min(0).max(100).optional(),
});

const updateLinkSchema = z.object({
  involvementLevel: z.enum(['NONE', 'REPORTS_ONLY', 'FINANCIAL', 'FULL']).optional(),
  ownershipPercent: z.number().min(0).max(100).optional(),
});

async function getHostId(req: AuthRequest, res: Response): Promise<string | null> {
  const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
  if (!host) { res.status(403).json({ error: 'Not a host account' }); return null; }
  return host.id;
}

// List all owners created by this host (via their properties)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const hostId = await getHostId(req, res);
    if (!hostId) return;

    const properties = await prisma.property.findMany({ where: { hostId }, select: { id: true } });
    const propertyIds = properties.map((p) => p.id);

    const ownerships = await prisma.propertyOwnership.findMany({
      where: { propertyId: { in: propertyIds } },
      include: {
        owner: { include: { user: { select: { id: true, name: true, email: true, phone: true } } } },
        property: { select: { id: true, name: true, city: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by owner
    const ownerMap = new Map<string, {
      id: string; user: { id: string; name: string; email: string; phone?: string };
      properties: typeof ownerships;
    }>();
    for (const o of ownerships) {
      const key = o.owner.id;
      if (!ownerMap.has(key)) {
        ownerMap.set(key, { id: o.owner.id, user: o.owner.user as { id: string; name: string; email: string; phone?: string }, properties: [] });
      }
      ownerMap.get(key)!.properties.push(o);
    }
    return res.json(Array.from(ownerMap.values()));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create owner account
router.post('/', validate(createOwnerSchema), async (req: AuthRequest, res: Response) => {
  try {
    await getHostId(req, res); // verify caller is host
    const { name, email, phone } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const tempPassword = Math.random().toString(36).slice(-10);
    const hashed = await bcrypt.hash(tempPassword, 12);

    const user = await prisma.user.create({
      data: {
        name, email, password: hashed, phone, role: 'OWNER',
        owner: { create: {} },
      },
      include: { owner: true },
    });

    return res.status(201).json({
      id: user.owner!.id,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone },
      tempPassword,
      properties: [],
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Link owner to a property
router.post('/:ownerId/properties', validate(linkPropertySchema), async (req: AuthRequest, res: Response) => {
  try {
    const hostId = await getHostId(req, res);
    if (!hostId) return;

    const { propertyId, involvementLevel, ownershipPercent } = req.body;

    // Verify property belongs to this host
    const property = await prisma.property.findFirst({ where: { id: propertyId, hostId } });
    if (!property) return res.status(403).json({ error: 'Property not found' });

    const owner = await prisma.owner.findUnique({ where: { id: req.params.ownerId } });
    if (!owner) return res.status(404).json({ error: 'Owner not found' });

    const link = await prisma.propertyOwnership.upsert({
      where: { ownerId_propertyId: { ownerId: req.params.ownerId, propertyId } },
      create: { ownerId: req.params.ownerId, propertyId, involvementLevel, ownershipPercent },
      update: { involvementLevel, ownershipPercent },
      include: { property: { select: { id: true, name: true, city: true } } },
    });
    return res.status(201).json(link);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update ownership details
router.put('/:ownerId/properties/:propertyId', validate(updateLinkSchema), async (req: AuthRequest, res: Response) => {
  try {
    const hostId = await getHostId(req, res);
    if (!hostId) return;

    const property = await prisma.property.findFirst({ where: { id: req.params.propertyId, hostId } });
    if (!property) return res.status(403).json({ error: 'Property not found' });

    const link = await prisma.propertyOwnership.update({
      where: { ownerId_propertyId: { ownerId: req.params.ownerId, propertyId: req.params.propertyId } },
      data: req.body,
    });
    return res.json(link);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Unlink owner from a property
router.delete('/:ownerId/properties/:propertyId', async (req: AuthRequest, res: Response) => {
  try {
    const hostId = await getHostId(req, res);
    if (!hostId) return;

    const property = await prisma.property.findFirst({ where: { id: req.params.propertyId, hostId } });
    if (!property) return res.status(403).json({ error: 'Property not found' });

    await prisma.propertyOwnership.delete({
      where: { ownerId_propertyId: { ownerId: req.params.ownerId, propertyId: req.params.propertyId } },
    });
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete owner
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await getHostId(req, res);
    const owner = await prisma.owner.findUnique({ where: { id: req.params.id } });
    if (!owner) return res.status(404).json({ error: 'Owner not found' });
    await prisma.user.delete({ where: { id: owner.userId } });
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Owner self-service routes (called from owner portal) ────────────────────

// Owner dashboard — scoped to their involvement level
router.get('/dashboard', async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role !== 'OWNER') return res.status(403).json({ error: 'Owner access only' });

    const owner = await prisma.owner.findUnique({ where: { userId: req.user!.id } });
    if (!owner) return res.status(404).json({ error: 'Owner profile not found' });

    const ownerships = await prisma.propertyOwnership.findMany({
      where: { ownerId: owner.id },
      include: {
        property: {
          include: {
            bookings: {
              where: { status: { in: ['CONFIRMED', 'CHECKED_IN'] } },
              orderBy: { checkIn: 'asc' },
              take: 5,
            },
            jobs: {
              where: { status: { in: ['PENDING', 'DISPATCHED', 'IN_PROGRESS'] } },
              orderBy: { scheduledAt: 'asc' },
              take: 5,
            },
            maintenanceRequests: {
              where: { status: { in: ['PENDING', 'APPROVED', 'ASSIGNED', 'IN_PROGRESS'] } },
              include: { tradeRole: true },
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
        },
      },
    });

    const properties = ownerships.map((o) => ({
      propertyId: o.propertyId,
      involvementLevel: o.involvementLevel,
      ownershipPercent: o.ownershipPercent,
      property: {
        id: o.property.id,
        name: o.property.name,
        city: o.property.city,
        type: o.property.type,
        // Only include bookings if involvement >= REPORTS_ONLY
        activeBookings: ['REPORTS_ONLY', 'FINANCIAL', 'FULL'].includes(o.involvementLevel)
          ? o.property.bookings
          : undefined,
        // Only include financials if involvement >= FINANCIAL
        recentRevenue: ['FINANCIAL', 'FULL'].includes(o.involvementLevel)
          ? o.property.bookings.reduce((sum: number, b) => sum + b.totalAmount, 0)
          : undefined,
        // Only include jobs/maintenance if involvement === FULL
        activeJobs: o.involvementLevel === 'FULL' ? o.property.jobs : undefined,
        maintenanceRequests: o.involvementLevel === 'FULL' ? o.property.maintenanceRequests : undefined,
      },
    }));

    return res.json({ owner: { id: owner.id }, properties });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
