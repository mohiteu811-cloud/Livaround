import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();
router.use(authenticate);

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
});

const updateSchema = createSchema.partial();

async function getHostId(req: AuthRequest, res: Response): Promise<string | null> {
  const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
  if (!host) { res.status(403).json({ error: 'Not a host account' }); return null; }
  return host.id;
}

// List trade roles for this host
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const hostId = await getHostId(req, res);
    if (!hostId) return;
    const roles = await prisma.tradeRole.findMany({
      where: { hostId },
      include: { _count: { select: { workers: true, maintenanceRequests: true } } },
      orderBy: { name: 'asc' },
    });
    return res.json(roles);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create trade role
router.post('/', validate(createSchema), async (req: AuthRequest, res: Response) => {
  try {
    const hostId = await getHostId(req, res);
    if (!hostId) return;
    const role = await prisma.tradeRole.create({
      data: { hostId, ...req.body },
    });
    return res.status(201).json(role);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update trade role
router.put('/:id', validate(updateSchema), async (req: AuthRequest, res: Response) => {
  try {
    const hostId = await getHostId(req, res);
    if (!hostId) return;
    const existing = await prisma.tradeRole.findFirst({ where: { id: req.params.id, hostId } });
    if (!existing) return res.status(404).json({ error: 'Trade role not found' });
    const role = await prisma.tradeRole.update({ where: { id: req.params.id }, data: req.body });
    return res.json(role);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete trade role
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const hostId = await getHostId(req, res);
    if (!hostId) return;
    const existing = await prisma.tradeRole.findFirst({ where: { id: req.params.id, hostId } });
    if (!existing) return res.status(404).json({ error: 'Trade role not found' });
    await prisma.tradeRole.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
