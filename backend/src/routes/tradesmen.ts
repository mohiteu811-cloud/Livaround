import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

async function getHostId(userId: string): Promise<string | null> {
  const host = await prisma.host.findUnique({ where: { userId } });
  return host?.id ?? null;
}

// ── List tradesmen (with filters) ─────────────────────────────────────────────

router.get('/', async (req: AuthRequest, res: Response) => {
  const hostId = await getHostId(req.user!.id);
  if (!hostId) return res.status(403).json({ error: 'Not a host' });

  const { trade, propertyId, area } = req.query;

  try {
    const tradesmen = await prisma.tradesman.findMany({
      where: {
        hostId,
        ...(trade ? { trade: { contains: trade as string, mode: 'insensitive' } } : {}),
        ...(area ? { area: { contains: area as string, mode: 'insensitive' } } : {}),
        ...(propertyId
          ? { properties: { some: { propertyId: propertyId as string } } }
          : {}),
      },
      include: {
        properties: {
          include: { property: { select: { id: true, name: true, city: true } } },
        },
      },
      orderBy: [{ trade: 'asc' }, { name: 'asc' }],
    });

    const parsed = tradesmen.map((t) => ({
      ...t,
      phones: (() => { try { return JSON.parse(t.phones); } catch { return []; } })(),
    }));

    return res.json(parsed);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Create tradesman ──────────────────────────────────────────────────────────

router.post('/', async (req: AuthRequest, res: Response) => {
  const hostId = await getHostId(req.user!.id);
  if (!hostId) return res.status(403).json({ error: 'Not a host' });

  const { name, trade, phones, company, notes, area, email, propertyIds } = req.body;
  if (!name || !trade) return res.status(400).json({ error: 'name and trade are required' });

  try {
    const tradesman = await prisma.tradesman.create({
      data: {
        hostId,
        name,
        trade,
        phones: JSON.stringify(phones || []),
        company: company || null,
        notes: notes || null,
        area: area || null,
        email: email || null,
        properties: propertyIds?.length
          ? { create: (propertyIds as string[]).map((pid) => ({ propertyId: pid })) }
          : undefined,
      },
      include: {
        properties: {
          include: { property: { select: { id: true, name: true, city: true } } },
        },
      },
    });

    return res.status(201).json({
      ...tradesman,
      phones: phones || [],
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create tradesman' });
  }
});

// ── Update tradesman ──────────────────────────────────────────────────────────

router.put('/:id', async (req: AuthRequest, res: Response) => {
  const hostId = await getHostId(req.user!.id);
  if (!hostId) return res.status(403).json({ error: 'Not a host' });

  const { id } = req.params;
  const { name, trade, phones, company, notes, area, email, propertyIds } = req.body;

  try {
    const existing = await prisma.tradesman.findFirst({ where: { id, hostId } });
    if (!existing) return res.status(404).json({ error: 'Tradesman not found' });

    const tradesman = await prisma.tradesman.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(trade !== undefined && { trade }),
        ...(phones !== undefined && { phones: JSON.stringify(phones) }),
        ...(company !== undefined && { company: company || null }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(area !== undefined && { area: area || null }),
        ...(email !== undefined && { email: email || null }),
        ...(propertyIds !== undefined && {
          properties: {
            deleteMany: {},
            create: (propertyIds as string[]).map((pid) => ({ propertyId: pid })),
          },
        }),
      },
      include: {
        properties: {
          include: { property: { select: { id: true, name: true, city: true } } },
        },
      },
    });

    return res.json({
      ...tradesman,
      phones: (() => { try { return JSON.parse(tradesman.phones); } catch { return []; } })(),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to update tradesman' });
  }
});

// ── Delete tradesman ──────────────────────────────────────────────────────────

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const hostId = await getHostId(req.user!.id);
  if (!hostId) return res.status(403).json({ error: 'Not a host' });

  try {
    const existing = await prisma.tradesman.findFirst({ where: { id: req.params.id, hostId } });
    if (!existing) return res.status(404).json({ error: 'Tradesman not found' });

    await prisma.tradesman.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to delete tradesman' });
  }
});

// ── Import from property contacts ─────────────────────────────────────────────
// POST /api/tradesmen/import { propertyId }
// Imports all PropertyContacts from that property as Tradesmen (skips duplicates by phone)

router.post('/import', async (req: AuthRequest, res: Response) => {
  const hostId = await getHostId(req.user!.id);
  if (!hostId) return res.status(403).json({ error: 'Not a host' });

  const { propertyId } = req.body;
  if (!propertyId) return res.status(400).json({ error: 'propertyId is required' });

  try {
    // Verify property belongs to host
    const property = await prisma.property.findFirst({
      where: { id: propertyId, hostId },
      include: { contacts: true },
    });
    if (!property) return res.status(404).json({ error: 'Property not found' });

    const existingTradesmen = await prisma.tradesman.findMany({
      where: { hostId },
      select: { id: true, phones: true, name: true, trade: true },
    });

    let created = 0;
    let skipped = 0;

    for (const contact of property.contacts) {
      const contactPhones: string[] = (() => { try { return JSON.parse(contact.phones); } catch { return []; } })();

      // Check for duplicate: same trade + same primary phone
      const isDuplicate = existingTradesmen.some((t) => {
        const tPhones: string[] = (() => { try { return JSON.parse(t.phones); } catch { return []; } })();
        return (
          t.trade.toLowerCase() === contact.agency.toLowerCase() &&
          contactPhones.length > 0 &&
          tPhones.some((p) => contactPhones.includes(p))
        );
      });

      if (isDuplicate) {
        skipped++;
        continue;
      }

      const tradesman = await prisma.tradesman.create({
        data: {
          hostId,
          name: contact.name || contact.agency,
          trade: contact.agency,
          phones: contact.phones,
          company: contact.company || null,
          notes: contact.notes || null,
          properties: { create: [{ propertyId }] },
        },
      });

      existingTradesmen.push({ id: tradesman.id, phones: tradesman.phones, name: tradesman.name, trade: tradesman.trade });
      created++;
    }

    return res.json({ created, skipped, total: property.contacts.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to import contacts' });
  }
});

export default router;
