import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();
router.use(authenticate);

function isClient(req: AuthRequest) { return req.user!.role === 'CLIENT'; }

const updateSchema = z.object({
  businessName: z.string().min(2).optional(),
  businessType: z.enum(['RESTAURANT', 'HOTEL', 'VILLA', 'RETAIL', 'EVENT', 'OTHER']).optional(),
  city: z.string().min(2).optional(),
  phone: z.string().optional(),
  gstNumber: z.string().optional(),
});

// GET /api/clients/me
router.get('/me', async (req: AuthRequest, res: Response) => {
  try {
    if (!isClient(req)) return res.status(403).json({ error: 'Clients only' });

    const client = await prisma.client.findUnique({
      where: { userId: req.user!.id },
      include: {
        venues: { orderBy: { isDefault: 'desc' } },
        _count: { select: { shifts: true } },
      },
    });

    if (!client) return res.status(404).json({ error: 'Client not found' });
    return res.json(client);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/clients/me
router.put('/me', validate(updateSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!isClient(req)) return res.status(403).json({ error: 'Clients only' });

    const client = await prisma.client.update({
      where: { userId: req.user!.id },
      data: req.body,
    });

    return res.json(client);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
