import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();
router.use(authenticate);

function isClient(req: AuthRequest) { return req.user!.role === 'CLIENT'; }

const createSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  isDefault: z.boolean().optional(),
});

const updateSchema = createSchema.partial();

async function getClientId(req: AuthRequest): Promise<string | null> {
  const client = await prisma.client.findUnique({ where: { userId: req.user!.id } });
  return client?.id ?? null;
}

// GET /api/venues
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    if (!isClient(req)) return res.status(403).json({ error: 'Clients only' });
    const clientId = await getClientId(req);
    if (!clientId) return res.status(404).json({ error: 'Client not found' });

    const venues = await prisma.venue.findMany({
      where: { clientId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return res.json(venues);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/venues
router.post('/', validate(createSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!isClient(req)) return res.status(403).json({ error: 'Clients only' });
    const clientId = await getClientId(req);
    if (!clientId) return res.status(404).json({ error: 'Client not found' });

    // If this is the first venue or isDefault=true, unset other defaults
    if (req.body.isDefault) {
      await prisma.venue.updateMany({ where: { clientId }, data: { isDefault: false } });
    }

    // Auto-set as default if it's the first venue
    const existingCount = await prisma.venue.count({ where: { clientId } });
    const venue = await prisma.venue.create({
      data: { ...req.body, clientId, isDefault: req.body.isDefault ?? existingCount === 0 },
    });

    return res.status(201).json(venue);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/venues/:id
router.put('/:id', validate(updateSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!isClient(req)) return res.status(403).json({ error: 'Clients only' });
    const clientId = await getClientId(req);
    if (!clientId) return res.status(404).json({ error: 'Client not found' });

    const venue = await prisma.venue.findFirst({ where: { id: req.params.id, clientId } });
    if (!venue) return res.status(404).json({ error: 'Venue not found' });

    if (req.body.isDefault) {
      await prisma.venue.updateMany({ where: { clientId }, data: { isDefault: false } });
    }

    const updated = await prisma.venue.update({ where: { id: req.params.id }, data: req.body });
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/venues/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!isClient(req)) return res.status(403).json({ error: 'Clients only' });
    const clientId = await getClientId(req);
    if (!clientId) return res.status(404).json({ error: 'Client not found' });

    const venue = await prisma.venue.findFirst({ where: { id: req.params.id, clientId } });
    if (!venue) return res.status(404).json({ error: 'Venue not found' });

    await prisma.venue.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
