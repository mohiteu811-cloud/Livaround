// Public routes — no authentication required.
// Used by QR code label scans.

import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

// GET /api/guide/doc/:id — public, for QR label scans
router.get('/doc/:id', async (req: Request, res: Response) => {
  try {
    const doc = await prisma.propertyDoc.findUnique({
      where: { id: req.params.id },
      include: {
        area: { select: { name: true, floor: true } },
        property: { select: { name: true, city: true } },
      },
    });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({
      ...doc,
      photos: (() => { try { return JSON.parse(doc.photos); } catch { return []; } })(),
      tags: (() => { try { return JSON.parse(doc.tags); } catch { return []; } })(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
