import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router({ mergeParams: true });

// All guide routes require authentication
router.use(authenticate);

// Helper: verify host owns this property
async function verifyHostProperty(propertyId: string, userId: string): Promise<boolean> {
  const host = await prisma.host.findUnique({ where: { userId } });
  if (!host) return false;
  const prop = await prisma.property.findFirst({ where: { id: propertyId, hostId: host.id } });
  return !!prop;
}

// ── GET /api/properties/:id/guide ─────────────────────────────────────────────
// Returns full guide: areas (with nested docs) + contacts
router.get('/', async (req: Request, res: Response) => {
  const { id: propertyId } = req.params;
  try {
    const [areas, ungroupedDocs, contacts] = await Promise.all([
      prisma.propertyArea.findMany({
        where: { propertyId },
        orderBy: { order: 'asc' },
        include: {
          docs: { orderBy: { order: 'asc' } },
        },
      }),
      prisma.propertyDoc.findMany({
        where: { propertyId, areaId: null },
        orderBy: { order: 'asc' },
      }),
      prisma.propertyContact.findMany({
        where: { propertyId },
        orderBy: { order: 'asc' },
      }),
    ]);

    const parsedAreas = areas.map((a: any) => ({
      ...a,
      docs: a.docs.map((d: any) => ({
        ...d,
        photos: JSON.parse(d.photos),
        tags: JSON.parse(d.tags),
      })),
    }));

    const parsedContacts = contacts.map((c: any) => ({
      ...c,
      phones: JSON.parse(c.phones),
    }));

    const parsedUngrouped = ungroupedDocs.map((d: any) => ({
      ...d,
      photos: JSON.parse(d.photos),
      tags: JSON.parse(d.tags),
    }));

    res.json({ areas: parsedAreas, ungroupedDocs: parsedUngrouped, contacts: parsedContacts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch guide' });
  }
});

// ── Areas ────────────────────────────────────────────────────────────────────

router.post('/areas', async (req: Request, res: Response) => {
  const { id: propertyId } = req.params;
  const userId = (req as any).user.id;
  if (!await verifyHostProperty(propertyId, userId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { name, floor, description, order } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const area = await prisma.propertyArea.create({
      data: { propertyId, name, floor, description, order: order ?? 0 },
    });
    res.status(201).json(area);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create area' });
  }
});

router.put('/areas/:areaId', async (req: Request, res: Response) => {
  const { id: propertyId, areaId } = req.params;
  const userId = (req as any).user.id;
  if (!await verifyHostProperty(propertyId, userId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { name, floor, description, order } = req.body;
  try {
    const area = await prisma.propertyArea.update({
      where: { id: areaId },
      data: { name, floor, description, order },
    });
    res.json(area);
  } catch {
    res.status(404).json({ error: 'Area not found' });
  }
});

router.delete('/areas/:areaId', async (req: Request, res: Response) => {
  const { id: propertyId, areaId } = req.params;
  const userId = (req as any).user.id;
  if (!await verifyHostProperty(propertyId, userId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    await prisma.propertyArea.delete({ where: { id: areaId } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: 'Area not found' });
  }
});

// ── Docs ─────────────────────────────────────────────────────────────────────

router.post('/docs', async (req: Request, res: Response) => {
  const { id: propertyId } = req.params;
  const userId = (req as any).user.id;
  if (!await verifyHostProperty(propertyId, userId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { areaId, title, description, category, photos, tags, order } = req.body;
  if (!title || !description) return res.status(400).json({ error: 'title and description are required' });
  try {
    const doc = await prisma.propertyDoc.create({
      data: {
        propertyId,
        areaId: areaId || null,
        title,
        description,
        category: category || 'OTHER',
        photos: JSON.stringify(photos || []),
        tags: JSON.stringify(tags || []),
        order: order ?? 0,
      },
    });
    res.status(201).json({ ...doc, photos: photos || [], tags: tags || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create doc' });
  }
});

router.put('/docs/:docId', async (req: Request, res: Response) => {
  const { id: propertyId, docId } = req.params;
  const userId = (req as any).user.id;
  if (!await verifyHostProperty(propertyId, userId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { areaId, title, description, category, photos, tags, order } = req.body;
  try {
    const doc = await prisma.propertyDoc.update({
      where: { id: docId },
      data: {
        areaId: areaId !== undefined ? (areaId || null) : undefined,
        title,
        description,
        category,
        photos: photos !== undefined ? JSON.stringify(photos) : undefined,
        tags: tags !== undefined ? JSON.stringify(tags) : undefined,
        order,
      },
    });
    res.json({ ...doc, photos: JSON.parse(doc.photos), tags: JSON.parse(doc.tags) });
  } catch {
    res.status(404).json({ error: 'Doc not found' });
  }
});

router.delete('/docs/:docId', async (req: Request, res: Response) => {
  const { id: propertyId, docId } = req.params;
  const userId = (req as any).user.id;
  if (!await verifyHostProperty(propertyId, userId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    await prisma.propertyDoc.delete({ where: { id: docId } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: 'Doc not found' });
  }
});

// ── Contacts ─────────────────────────────────────────────────────────────────

router.post('/contacts', async (req: Request, res: Response) => {
  const { id: propertyId } = req.params;
  const userId = (req as any).user.id;
  if (!await verifyHostProperty(propertyId, userId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { agency, name, phones, company, notes, order } = req.body;
  if (!agency) return res.status(400).json({ error: 'agency is required' });
  try {
    const contact = await prisma.propertyContact.create({
      data: {
        propertyId,
        agency,
        name: name || null,
        phones: JSON.stringify(phones || []),
        company: company || null,
        notes: notes || null,
        order: order ?? 0,
      },
    });
    res.status(201).json({ ...contact, phones: phones || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

router.put('/contacts/:contactId', async (req: Request, res: Response) => {
  const { id: propertyId, contactId } = req.params;
  const userId = (req as any).user.id;
  if (!await verifyHostProperty(propertyId, userId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { agency, name, phones, company, notes, order } = req.body;
  try {
    const contact = await prisma.propertyContact.update({
      where: { id: contactId },
      data: {
        agency,
        name,
        phones: phones !== undefined ? JSON.stringify(phones) : undefined,
        company,
        notes,
        order,
      },
    });
    res.json({ ...contact, phones: JSON.parse(contact.phones) });
  } catch {
    res.status(404).json({ error: 'Contact not found' });
  }
});

router.delete('/contacts/:contactId', async (req: Request, res: Response) => {
  const { id: propertyId, contactId } = req.params;
  const userId = (req as any).user.id;
  if (!await verifyHostProperty(propertyId, userId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    await prisma.propertyContact.delete({ where: { id: contactId } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: 'Contact not found' });
  }
});

export default router;
