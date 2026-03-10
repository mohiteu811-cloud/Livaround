import { Router, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma';
import { sendPushNotification } from '../lib/pushNotifications';

const router = Router();

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /image\/(jpeg|jpg|png|webp)|video\/(mp4|quicktime|webm|3gpp)/.test(file.mimetype);
    cb(null, ok);
  },
});

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

// ── GET /api/stay/:code/cleaner-slots?date=YYYY-MM-DD ────────────────────────
// Returns which time slots are available for housekeeping on a given date,
// taking into account the cleaner's workload across all assigned properties.

const HOUSEKEEPING_SLOTS = Array.from({ length: 9 }, (_, i) => {
  const h = 9 + i;
  return {
    value: `${String(h).padStart(2, '0')}:00`,
    label: `${h > 12 ? h - 12 : h}:00 ${h >= 12 ? 'pm' : 'am'}`,
  };
});

router.get('/:code/cleaner-slots', async (req: Request, res: Response) => {
  try {
    const date = req.query.date as string;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' });
    }

    const booking = await prisma.booking.findUnique({
      where: { guestCode: req.params.code },
      select: { propertyId: true },
    });
    if (!booking) return res.status(404).json({ error: 'Stay not found' });

    // Find cleaners assigned to this property
    const staffAssignments = await prisma.propertyStaff.findMany({
      where: { propertyId: booking.propertyId, role: 'CLEANER' },
    });

    if (staffAssignments.length === 0) {
      // No assigned cleaner — all slots open
      return res.json({
        hasAssignedCleaner: false,
        slots: HOUSEKEEPING_SLOTS.map((s) => ({ ...s, available: true })),
      });
    }

    const cleanerIds = staffAssignments.map((s) => s.workerId);

    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd   = new Date(`${date}T23:59:59`);

    // Jobs already assigned to these cleaners on this date
    const assignedJobs = await prisma.job.findMany({
      where: {
        workerId: { in: cleanerIds },
        scheduledAt: { gte: dayStart, lte: dayEnd },
        status: { notIn: ['CANCELLED'] },
      },
      select: { scheduledAt: true },
    });

    // Other properties these cleaners are assigned to
    const otherAssignments = await prisma.propertyStaff.findMany({
      where: {
        workerId: { in: cleanerIds },
        role: 'CLEANER',
        propertyId: { not: booking.propertyId },
      },
      select: { propertyId: true },
    });
    const otherPropertyIds = [...new Set(otherAssignments.map((a) => a.propertyId))];

    // Check-ins at those other properties on this date (cleaner must prepare the villa)
    const otherCheckIns = otherPropertyIds.length > 0
      ? await prisma.booking.findMany({
          where: {
            propertyId: { in: otherPropertyIds },
            checkIn: { gte: dayStart, lte: dayEnd },
            status: { notIn: ['CANCELLED', 'CHECKED_OUT'] },
          },
          include: {
            serviceRequests: { where: { type: 'ARRIVAL_TIME' }, take: 1 },
          },
        })
      : [];

    // Build blocked minute ranges (minutes since midnight)
    // Each cleaning job takes ~2 hours; add 1 hr travel buffer before
    const SLOT_DURATION_MIN = 120; // 2 hours per clean
    const TRAVEL_BUFFER_MIN = 60;  // 1 hour travel before job

    const blockedRanges: Array<{ start: number; end: number }> = [];

    for (const job of assignedJobs) {
      const h = job.scheduledAt.getHours();
      const m = job.scheduledAt.getMinutes();
      const mid = h * 60 + m;
      blockedRanges.push({ start: mid - TRAVEL_BUFFER_MIN, end: mid + SLOT_DURATION_MIN });
    }

    for (const checkIn of otherCheckIns) {
      // Cleaner needs to finish cleaning before the guests arrive
      const arrivalReq = checkIn.serviceRequests[0];
      const arrivalStr = arrivalReq?.requestedTime ?? '15:00'; // default 3 pm
      const [ah, am] = arrivalStr.split(':').map(Number);
      const arrivalMin = ah * 60 + am;

      // Assume checkout at 11 am → cleaner starts cleaning at 11 am
      const cleanStartMin = 11 * 60;
      blockedRanges.push({ start: cleanStartMin, end: arrivalMin });
    }

    const slots = HOUSEKEEPING_SLOTS.map((slot) => {
      const [h] = slot.value.split(':').map(Number);
      const slotMin = h * 60;
      const blocked = blockedRanges.some((r) => slotMin >= r.start && slotMin < r.end);
      return { ...slot, available: !blocked };
    });

    return res.json({ hasAssignedCleaner: true, slots });
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

      // Find the cleaner/caretaker assigned to the property for auto-claiming
      const staffAssignments = await prisma.propertyStaff.findMany({
        where: { propertyId: booking.propertyId, role: { in: ['CLEANER', 'CARETAKER'] } },
        include: { worker: { select: { id: true, pushToken: true } } },
      });
      const cleaner =
        staffAssignments.find((s) => s.role === 'CLEANER')?.worker ??
        staffAssignments.find((s) => s.role === 'CARETAKER')?.worker ??
        null;

      const job = await prisma.job.create({
        data: {
          propertyId: booking.propertyId,
          bookingId: booking.id,
          type: 'CLEANING',
          status: cleaner ? 'ACCEPTED' : 'PENDING',
          scheduledAt,
          notes: `Housekeeping requested by guest${notes ? ': ' + notes : ''}`,
          checklist: JSON.stringify(DEFAULT_CHECKLIST.map((item) => ({ item, done: false }))),
          ...(cleaner ? { workerId: cleaner.id } : {}),
        },
        include: { property: { select: { name: true } } },
      });

      if (cleaner?.pushToken) {
        await sendPushNotification(cleaner.pushToken, {
          title: 'Housekeeping Request 🧹',
          body: `Guest requested cleaning at ${job.property?.name} on ${scheduledAt.toLocaleDateString()}`,
          data: { jobId: job.id },
          sound: 'default',
          priority: 'high',
          channelId: 'jobs',
        });
      }
    }

    return res.status(201).json({ id: request.id, status: request.status });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/stay/:code/upload ───────────────────────────────────────────────
// Public file upload for guest issue reports (photo / video)

router.post('/:code/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { guestCode: req.params.code },
      select: { id: true },
    });
    if (!booking) return res.status(404).json({ error: 'Stay not found' });
    if (!req.file) return res.status(400).json({ error: 'No file or unsupported type' });

    const host = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
    const url = `${host}/uploads/${req.file.filename}`;
    const type = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
    return res.json({ url, type });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
