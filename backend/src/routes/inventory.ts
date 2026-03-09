import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();
router.use(authenticate);

const inventorySchema = z.object({
  propertyId: z.string(),
  name: z.string().min(1),
  category: z
    .enum(['CLEANING_SUPPLIES', 'TOILETRIES', 'KITCHEN', 'LINENS', 'OTHER'])
    .default('OTHER'),
  currentStock: z.number().min(0).default(0),
  minStock: z.number().min(0).default(1),
  unit: z.string().default('units'),
  location: z.string().optional(),
  photos: z.array(z.string()).optional(),
});

const cabinetSchema = z.object({
  propertyId: z.string(),
  name: z.string().min(1),
  location: z.string().min(1),
  photoUrl: z.string().optional(),
  description: z.string().optional(),
});

function parseItem(item: Record<string, unknown>) {
  return {
    ...item,
    photos: (() => {
      try { return JSON.parse(item.photos as string); } catch { return []; }
    })(),
  };
}

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { propertyId, lowStock } = req.query;

    const items = await prisma.inventoryItem.findMany({
      where: {
        property: { host: { userId: req.user!.id } },
        ...(propertyId ? { propertyId: propertyId as string } : {}),
      },
      include: { property: { select: { id: true, name: true } } },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    const parsed = items.map(parseItem);
    const result = lowStock === 'true' ? parsed.filter((i) => (i.currentStock as number) <= (i.minStock as number)) : parsed;
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/low-stock', async (req: AuthRequest, res: Response) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      where: {
        property: { host: { userId: req.user!.id } },
      },
      include: { property: { select: { id: true, name: true, city: true } } },
    });

    const parsed = items.map(parseItem);
    const lowStock = parsed.filter((i) => (i.currentStock as number) <= (i.minStock as number));
    return res.json(lowStock);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', validate(inventorySchema), async (req: AuthRequest, res: Response) => {
  try {
    const prop = await prisma.property.findFirst({
      where: { id: req.body.propertyId, host: { userId: req.user!.id } },
    });
    if (!prop) return res.status(403).json({ error: 'Property not found or access denied' });

    const { photos, ...rest } = req.body;
    const item = await prisma.inventoryItem.create({
      data: { ...rest, photos: JSON.stringify(photos ?? []) },
    });
    return res.status(201).json(parseItem(item as unknown as Record<string, unknown>));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', validate(inventorySchema.partial()), async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.inventoryItem.findFirst({
      where: { id: req.params.id, property: { host: { userId: req.user!.id } } },
    });
    if (!existing) return res.status(404).json({ error: 'Item not found' });

    const { photos, ...rest } = req.body;
    const data: Record<string, unknown> = { ...rest };
    if (photos !== undefined) data.photos = JSON.stringify(photos);
    if (req.body.currentStock !== undefined && req.body.currentStock > existing.currentStock) {
      data.lastRestocked = new Date();
    }

    const item = await prisma.inventoryItem.update({ where: { id: req.params.id }, data });
    return res.json(parseItem(item as unknown as Record<string, unknown>));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.inventoryItem.findFirst({
      where: { id: req.params.id, property: { host: { userId: req.user!.id } } },
    });
    if (!existing) return res.status(404).json({ error: 'Item not found' });

    await prisma.inventoryItem.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Supply Cabinets
router.get('/cabinets', async (req: AuthRequest, res: Response) => {
  try {
    const { propertyId } = req.query;
    const cabinets = await prisma.supplyCabinet.findMany({
      where: {
        property: { host: { userId: req.user!.id } },
        ...(propertyId ? { propertyId: propertyId as string } : {}),
      },
      include: { property: { select: { id: true, name: true } } },
    });
    return res.json(cabinets);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/cabinets', validate(cabinetSchema), async (req: AuthRequest, res: Response) => {
  try {
    const prop = await prisma.property.findFirst({
      where: { id: req.body.propertyId, host: { userId: req.user!.id } },
    });
    if (!prop) return res.status(403).json({ error: 'Property not found or access denied' });

    const cabinet = await prisma.supplyCabinet.create({ data: req.body });
    return res.status(201).json(cabinet);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/cabinets/:qrCode', async (req: AuthRequest, res: Response) => {
  try {
    const cabinet = await prisma.supplyCabinet.findUnique({
      where: { qrCode: req.params.qrCode },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            inventoryItems: { where: { location: { not: null } } },
          },
        },
      },
    });
    if (!cabinet) return res.status(404).json({ error: 'Cabinet not found' });
    return res.json(cabinet);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
