import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const router = Router();

function parseJSON(s: string | null | undefined): string[] {
  try { return JSON.parse(s || '[]'); } catch { return []; }
}

// ── Emergency services by country (ISO country name) ─────────────────────────

const EMERGENCY: Record<string, { police: string; ambulance: string; fire: string; women?: string }> = {
  'India':          { police: '100',  ambulance: '108',  fire: '101', women: '1091' },
  'United States':  { police: '911',  ambulance: '911',  fire: '911' },
  'United Kingdom': { police: '999',  ambulance: '999',  fire: '999' },
  'UAE':            { police: '999',  ambulance: '998',  fire: '997' },
  'Singapore':      { police: '999',  ambulance: '995',  fire: '995' },
  'Australia':      { police: '000',  ambulance: '000',  fire: '000' },
  'France':         { police: '17',   ambulance: '15',   fire: '18'  },
  'Germany':        { police: '110',  ambulance: '112',  fire: '112' },
  'Italy':          { police: '113',  ambulance: '118',  fire: '115' },
  'Spain':          { police: '091',  ambulance: '112',  fire: '080' },
  'Portugal':       { police: '112',  ambulance: '112',  fire: '112' },
  'Greece':         { police: '100',  ambulance: '166',  fire: '199' },
  'Turkey':         { police: '155',  ambulance: '112',  fire: '110' },
  'Thailand':       { police: '191',  ambulance: '1669', fire: '199' },
  'Indonesia':      { police: '110',  ambulance: '118',  fire: '113' },
  'Sri Lanka':      { police: '119',  ambulance: '110',  fire: '111' },
  'Maldives':       { police: '119',  ambulance: '102',  fire: '118' },
  'Japan':          { police: '110',  ambulance: '119',  fire: '119' },
  'South Africa':   { police: '10111', ambulance: '10177', fire: '10177' },
  'Mexico':         { police: '911',  ambulance: '911',  fire: '911' },
  'Brazil':         { police: '190',  ambulance: '192',  fire: '193' },
  'Canada':         { police: '911',  ambulance: '911',  fire: '911' },
  'Netherlands':    { police: '112',  ambulance: '112',  fire: '112' },
  'Switzerland':    { police: '117',  ambulance: '144',  fire: '118' },
};

function getEmergencyServices(country: string) {
  const nums = EMERGENCY[country] ?? { police: '112', ambulance: '112', fire: '112' };
  const services = [
    { name: 'Police',    number: nums.police,    icon: '🚔' },
    { name: 'Ambulance', number: nums.ambulance, icon: '🚑' },
    { name: 'Fire',      number: nums.fire,      icon: '🚒' },
  ];
  if (nums.women) services.push({ name: 'Women Helpline', number: nums.women, icon: '🆘' });
  return services;
}

// ── GET /api/stay/:code ───────────────────────────────────────────────────────

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
          },
        },
        serviceRequests: { orderBy: { createdAt: 'desc' } },
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
        caretakerType: p.caretakerType,
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
        emergencyServices: getEmergencyServices(p.country),
      },
      serviceRequests: booking.serviceRequests.map((r) => ({
        id: r.id,
        type: r.type,
        requestedDate: r.requestedDate,
        requestedTime: r.requestedTime,
        notes: r.notes,
        status: r.status,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/stay/:code/issue ────────────────────────────────────────────────

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

// ── POST /api/stay/:code/service-request ─────────────────────────────────────

const serviceRequestSchema = z.object({
  type: z.enum(['HOUSEKEEPING', 'COOK', 'DRIVER', 'CAR_RENTAL', 'ARRIVAL_TIME', 'DEPARTURE_TIME', 'OTHER']),
  requestedDate: z.string().optional(),   // "YYYY-MM-DD"
  requestedTime: z.string().optional(),   // "HH:MM"
  notes: z.string().optional(),
});

router.post('/:code/service-request', async (req: Request, res: Response) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { guestCode: req.params.code },
      select: { id: true, propertyId: true, checkIn: true, checkOut: true },
    });
    if (!booking) return res.status(404).json({ error: 'Stay not found' });

    const parsed = serviceRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });

    const { type, requestedDate, requestedTime, notes } = parsed.data;

    // Enforce once-per-day for housekeeping
    if (type === 'HOUSEKEEPING' && requestedDate) {
      const existing = await prisma.guestServiceRequest.findFirst({
        where: { bookingId: booking.id, type: 'HOUSEKEEPING', requestedDate },
      });
      if (existing) {
        return res.status(409).json({ error: 'Housekeeping already requested for this date' });
      }
    }

    const request = await prisma.guestServiceRequest.create({
      data: {
        bookingId: booking.id,
        propertyId: booking.propertyId,
        type,
        requestedDate: requestedDate || null,
        requestedTime: requestedTime || null,
        notes: notes || null,
        status: 'PENDING',
      },
    });

    // Auto-create a Job for housekeeping so it appears in the host dashboard
    if (type === 'HOUSEKEEPING' && requestedDate) {
      const [year, month, day] = requestedDate.split('-').map(Number);
      const [hours, minutes] = (requestedTime || '10:00').split(':').map(Number);
      const scheduledAt = new Date(year, month - 1, day, hours, minutes, 0);

      const DEFAULT_CHECKLIST = [
        'Vacuum all rooms', 'Change bed linens', 'Clean bathrooms',
        'Restock toiletries', 'Clean kitchen', 'Empty bins',
      ];

      await prisma.job.create({
        data: {
          propertyId: booking.propertyId,
          bookingId: booking.id,
          type: 'CLEANING',
          status: 'PENDING',
          scheduledAt,
          notes: `Housekeeping requested by guest${notes ? ': ' + notes : ''}`,
          checklist: JSON.stringify(DEFAULT_CHECKLIST.map((item) => ({ item, done: false }))),
        },
      });
    }

    return res.status(201).json({ id: request.id, status: request.status });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
