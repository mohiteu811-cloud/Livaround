import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

function parseJSON(s: string | null | undefined): string[] {
  try { return JSON.parse(s || '[]'); } catch { return []; }
}

// ── GET /api/stay/:code ───────────────────────────────────────────────────────
// Public — no authentication. Returns all guest-facing info for a booking.

router.get('/:code', async (req: Request, res: Response) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { guestCode: req.params.code },
      include: {
        property: {
          include: {
            host: { include: { user: { select: { name: true, phone: true } } } },
            areas: {
              orderBy: { order: 'asc' },
              include: { docs: { orderBy: { order: 'asc' } } },
            },
            docs: { where: { areaId: null }, orderBy: { order: 'asc' } },
            contacts: { orderBy: { order: 'asc' } },
          },
        },
      },
    });

    if (!booking) return res.status(404).json({ error: 'Stay not found' });

    const p = booking.property;

    return res.json({
      booking: {
        guestName: booking.guestName,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        guestCount: booking.guestCount,
        lockCode: booking.lockCode,
        status: booking.status,
      },
      property: {
        name: p.name,
        address: p.address,
        city: p.city,
        country: p.country,
        description: p.description,
        type: p.type,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        maxGuests: p.maxGuests,
        amenities: parseJSON(p.amenities),
        images: parseJSON(p.images),
        wifiName: p.wifiName,
        wifiPassword: p.wifiPassword,
        mapUrl: p.mapUrl,
        checkInInstructions: p.checkInInstructions,
        houseRules: parseJSON(p.houseRules),
        host: { name: p.host.user.name, phone: p.host.user.phone },
      },
      guide: {
        areas: p.areas.map((a) => ({
          id: a.id,
          name: a.name,
          floor: a.floor,
          description: a.description,
          docs: a.docs.map((d) => ({
            id: d.id,
            title: d.title,
            description: d.description,
            category: d.category,
            photos: parseJSON(d.photos),
            tags: parseJSON(d.tags),
          })),
        })),
        ungroupedDocs: p.docs.map((d) => ({
          id: d.id,
          title: d.title,
          description: d.description,
          category: d.category,
          photos: parseJSON(d.photos),
          tags: parseJSON(d.tags),
        })),
        contacts: p.contacts.map((c) => ({
          id: c.id,
          agency: c.agency,
          name: c.name,
          phones: parseJSON(c.phones),
          company: c.company,
          notes: c.notes,
        })),
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/stay/:code/issue ────────────────────────────────────────────────
// Guest submits a maintenance/issue report

router.post('/:code/issue', async (req: Request, res: Response) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { guestCode: req.params.code },
      select: { propertyId: true, status: true },
    });
    if (!booking) return res.status(404).json({ error: 'Stay not found' });

    const { description, photoUrl } = req.body;
    if (!description) return res.status(400).json({ error: 'description is required' });

    const issue = await prisma.issue.create({
      data: {
        propertyId: booking.propertyId,
        description,
        photoUrl: photoUrl || null,
        severity: 'LOW',
        status: 'OPEN',
      },
    });

    return res.status(201).json({ id: issue.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
