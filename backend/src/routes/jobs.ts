import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { sendPushNotification } from '../lib/pushNotifications';

const router = Router();
router.use(authenticate);

const JOB_INCLUDE = {
  property: { select: { id: true, name: true, city: true } },
  worker: { include: { user: { select: { name: true, email: true, phone: true } } } },
  booking: { select: { id: true, guestName: true, checkIn: true, checkOut: true } },
  _count: { select: { issues: true } },
} as const;

function parseJob(job: any) {
  return {
    ...job,
    checklist: typeof job.checklist === 'string'
      ? (() => { try { return JSON.parse(job.checklist); } catch { return []; } })()
      : (job.checklist ?? []),
  };
}

const createJobSchema = z.object({
  propertyId: z.string(),
  bookingId: z.string().optional(),
  type: z.enum(['CLEANING', 'COOKING', 'DRIVING', 'MAINTENANCE']),
  scheduledAt: z.string().datetime(),
  notes: z.string().optional(),
  checklist: z.array(z.object({ item: z.string(), done: z.boolean().default(false) })).optional(),
  workerId: z.string().optional(), // if provided, job is created and immediately dispatched
});

const dispatchSchema = z.object({
  workerId: z.string(),
});

const issueSchema = z.object({
  description: z.string().min(5),
  photoUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  mediaUrls: z.array(z.object({ url: z.string(), type: z.enum(['image', 'video']) })).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('LOW'),
});

function isHost(req: AuthRequest) { return req.user!.role === 'HOST'; }
function isWorker(req: AuthRequest) { return req.user!.role === 'WORKER'; }

// GET /api/jobs/available — workers see unassigned PENDING jobs they can claim
router.get('/available', async (req: AuthRequest, res: Response) => {
  try {
    if (!isWorker(req)) return res.status(403).json({ error: 'Workers only' });
    const jobs = await prisma.job.findMany({
      where: { workerId: null, status: 'PENDING', property: { isActive: true } },
      include: {
        property: { select: { id: true, name: true, city: true } },
        booking: { select: { id: true, guestName: true, checkIn: true, checkOut: true } },
        _count: { select: { issues: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
    return res.json(jobs.map(parseJob));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/jobs — hosts see their property jobs, workers see their own
// Query params: propertyId, status, type, workerId, archived ('true'|'only'), weekStart (ISO date)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { propertyId, status, type, workerId, archived, weekStart } = req.query;

    let baseWhere: Record<string, unknown>;
    if (isWorker(req)) {
      const worker = await prisma.worker.findUnique({ where: { userId: req.user!.id } });
      if (!worker) return res.json([]);
      baseWhere = { workerId: worker.id, property: { isActive: true } };
    } else {
      baseWhere = { property: { host: { userId: req.user!.id } } };
    }

    // Archive filtering: default excludes archived, 'true' includes all, 'only' shows archived only
    let archiveWhere: Record<string, unknown> = {};
    if (archived === 'only') {
      archiveWhere = { archivedAt: { not: null } };
    } else if (archived !== 'true') {
      archiveWhere = { archivedAt: null };
    }

    // Weekly view: filter by scheduledAt within the week starting at weekStart
    let weekWhere: Record<string, unknown> = {};
    if (weekStart) {
      const start = new Date(weekStart as string);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      weekWhere = { scheduledAt: { gte: start, lt: end } };
    }

    const jobs = await prisma.job.findMany({
      where: {
        ...baseWhere,
        ...archiveWhere,
        ...weekWhere,
        ...(propertyId ? { propertyId: propertyId as string } : {}),
        ...(status ? { status: status as string } : {}),
        ...(type ? { type: type as string } : {}),
        ...(isHost(req) && workerId ? { workerId: workerId as string } : {}),
      },
      include: {
        property: { select: { id: true, name: true, city: true } },
        worker: { include: { user: { select: { name: true, phone: true } } } },
        booking: { select: { id: true, guestName: true, checkIn: true, checkOut: true } },
        _count: { select: { issues: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
    return res.json(jobs.map(parseJob));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', validate(createJobSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!isHost(req)) return res.status(403).json({ error: 'Hosts only' });
    const prop = await prisma.property.findFirst({
      where: { id: req.body.propertyId, host: { userId: req.user!.id } },
    });
    if (!prop) return res.status(403).json({ error: 'Property not found or access denied' });

    const { checklist, workerId, ...rest } = req.body;

    // If dispatching immediately, verify the worker is assigned to this property
    if (workerId) {
      const staffAssignment = await prisma.propertyStaff.findFirst({
        where: { propertyId: req.body.propertyId, workerId },
      });
      if (!staffAssignment) {
        return res.status(400).json({ error: 'Worker is not assigned to this property' });
      }
    }

    const job = await prisma.job.create({
      data: {
        ...rest,
        ...(checklist ? { checklist: JSON.stringify(checklist) } : {}),
        ...(workerId ? { workerId, status: 'DISPATCHED' } : {}),
      },
      include: JOB_INCLUDE,
    });

    // Send push notification if dispatching immediately
    if (workerId) {
      const worker = await prisma.worker.findUnique({ where: { id: workerId } });
      if (worker?.pushToken) {
        await sendPushNotification(worker.pushToken, {
          title: `New ${job.type} Job 🔔`,
          body: `You've been assigned a job at ${prop.name}`,
          data: { jobId: job.id },
          sound: 'default',
          priority: 'high',
          channelId: 'jobs',
        });
      }
    }

    return res.status(201).json(parseJob(job));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/jobs/self-start — worker creates and immediately starts a job at an assigned property
router.post('/self-start', async (req: AuthRequest, res: Response) => {
  try {
    if (!isWorker(req)) return res.status(403).json({ error: 'Workers only' });
    const { propertyId, type, notes } = req.body;
    if (!propertyId || !type) return res.status(400).json({ error: 'propertyId and type are required' });
    if (!['CLEANING', 'COOKING', 'DRIVING', 'MAINTENANCE'].includes(type)) {
      return res.status(400).json({ error: 'Invalid job type' });
    }
    const worker = await prisma.worker.findUnique({ where: { userId: req.user!.id } });
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    const staffAssignment = await prisma.propertyStaff.findFirst({
      where: { propertyId, workerId: worker.id },
    });
    if (!staffAssignment) return res.status(403).json({ error: 'You are not assigned to this property' });
    const job = await prisma.job.create({
      data: { propertyId, type, notes: notes || null, workerId: worker.id, status: 'IN_PROGRESS', scheduledAt: new Date() },
      include: JOB_INCLUDE,
    });
    return res.status(201).json(parseJob(job));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/jobs/issues — all issues across the host's jobs (or worker's jobs)
router.get('/issues', async (req: AuthRequest, res: Response) => {
  try {
    const { severity, status } = req.query;

    let jobWhere: Record<string, unknown>;
    if (isWorker(req)) {
      const worker = await prisma.worker.findUnique({ where: { userId: req.user!.id } });
      if (!worker) return res.json([]);
      jobWhere = { workerId: worker.id };
    } else {
      jobWhere = { property: { host: { userId: req.user!.id } } };
    }

    const issues = await prisma.issue.findMany({
      where: {
        job: jobWhere,
        ...(severity ? { severity: severity as string } : {}),
        ...(status ? { status: status as string } : {}),
      },
      include: {
        job: {
          select: {
            id: true,
            type: true,
            scheduledAt: true,
            property: { select: { id: true, name: true } },
            worker: { include: { user: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(issues);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/jobs/issues/:issueId — update issue status (host only)
router.patch('/issues/:issueId', async (req: AuthRequest, res: Response) => {
  try {
    if (!isHost(req)) return res.status(403).json({ error: 'Hosts only' });
    const { status } = req.body;
    if (!['OPEN', 'IN_REVIEW', 'RESOLVED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const issue = await prisma.issue.update({
      where: { id: req.params.issueId },
      data: { status },
    });
    return res.json(issue);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/jobs/:id/claim — worker self-assigns an available job
router.post('/:id/claim', async (req: AuthRequest, res: Response) => {
  try {
    if (!isWorker(req)) return res.status(403).json({ error: 'Workers only' });
    const worker = await prisma.worker.findUnique({ where: { userId: req.user!.id } });
    if (!worker) return res.status(403).json({ error: 'Worker not found' });
    const job = await prisma.job.findFirst({ where: { id: req.params.id, workerId: null, status: 'PENDING' } });
    if (!job) return res.status(404).json({ error: 'Job not available' });
    const updated = await prisma.job.update({
      where: { id: req.params.id },
      data: { workerId: worker.id, status: 'ACCEPTED' },
      include: JOB_INCLUDE,
    });
    return res.json(parseJob(updated));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/jobs/dispatch-workers?propertyId=xxx
// Returns cleaners/caretakers assigned to a property so the frontend can determine:
//   - 0 workers → only "Create job" available
//   - 1 worker  → "Create and dispatch" auto-selects them (no picker needed)
//   - 2+ workers → "Create and dispatch" shows a worker selector
router.get('/dispatch-workers', async (req: AuthRequest, res: Response) => {
  try {
    if (!isHost(req)) return res.status(403).json({ error: 'Hosts only' });
    const { propertyId } = req.query;
    if (!propertyId) return res.status(400).json({ error: 'propertyId is required' });

    const prop = await prisma.property.findFirst({
      where: { id: propertyId as string, host: { userId: req.user!.id } },
    });
    if (!prop) return res.status(403).json({ error: 'Property not found or access denied' });

    const staff = await prisma.propertyStaff.findMany({
      where: { propertyId: propertyId as string, role: { in: ['CLEANER', 'CARETAKER'] } },
      include: {
        worker: {
          include: { user: { select: { id: true, name: true, email: true, phone: true } } },
        },
      },
      orderBy: { role: 'asc' }, // CLEANERs first
    });

    return res.json(staff.map((s) => ({ workerId: s.workerId, role: s.role, worker: s.worker })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const where = isWorker(req)
      ? { id: req.params.id, worker: { userId: req.user!.id } }
      : { id: req.params.id, property: { host: { userId: req.user!.id } } };

    const job = await prisma.job.findFirst({
      where,
      include: {
        property: true,
        worker: { include: { user: { select: { name: true, email: true, phone: true } } } },
        booking: true,
        issues: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    return res.json(parseJob(job));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/dispatch', validate(dispatchSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!isHost(req)) return res.status(403).json({ error: 'Hosts only' });
    const job = await prisma.job.findFirst({
      where: { id: req.params.id, property: { host: { userId: req.user!.id } } },
      include: { property: { select: { name: true } } },
    });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const worker = await prisma.worker.findUnique({ where: { id: req.body.workerId } });
    if (!worker) return res.status(404).json({ error: 'Worker not found' });

    const staffAssignment = await prisma.propertyStaff.findFirst({
      where: { propertyId: job.propertyId, workerId: req.body.workerId },
    });
    if (!staffAssignment) return res.status(400).json({ error: 'Worker is not assigned to this property' });

    const updated = await prisma.job.update({
      where: { id: req.params.id },
      data: { workerId: req.body.workerId, status: 'DISPATCHED' },
      include: { worker: { include: { user: { select: { name: true } } } } },
    });

    // Send push notification to worker
    const workerWithToken = worker as typeof worker & { pushToken?: string | null };
    if (workerWithToken.pushToken) {
      await sendPushNotification(workerWithToken.pushToken, {
        title: `New ${job.type} Job 🔔`,
        body: `You've been assigned a job at ${job.property?.name}`,
        data: { jobId: job.id },
        sound: 'default',
        priority: 'high',
        channelId: 'jobs',
      });
    }

    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/accept', async (req: AuthRequest, res: Response) => {
  try {
    if (isWorker(req)) {
      const worker = await prisma.worker.findUnique({ where: { userId: req.user!.id } });
      if (!worker) return res.status(403).json({ error: 'Worker not found' });
      const job = await prisma.job.findFirst({ where: { id: req.params.id, workerId: worker.id } });
      if (!job) return res.status(403).json({ error: 'Not your job' });
    }
    const job = await prisma.job.update({ where: { id: req.params.id }, data: { status: 'ACCEPTED' }, include: JOB_INCLUDE });
    return res.json(parseJob(job));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/start', async (req: AuthRequest, res: Response) => {
  try {
    if (isWorker(req)) {
      const worker = await prisma.worker.findUnique({ where: { userId: req.user!.id } });
      if (!worker) return res.status(403).json({ error: 'Worker not found' });
      const job = await prisma.job.findFirst({ where: { id: req.params.id, workerId: worker.id } });
      if (!job) return res.status(403).json({ error: 'Not your job' });
    }
    const job = await prisma.job.update({ where: { id: req.params.id }, data: { status: 'IN_PROGRESS' }, include: JOB_INCLUDE });
    return res.json(parseJob(job));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/complete', async (req: AuthRequest, res: Response) => {
  try {
    let workerId: string | null = null;

    if (isWorker(req)) {
      const worker = await prisma.worker.findUnique({ where: { userId: req.user!.id } });
      if (!worker) return res.status(403).json({ error: 'Worker not found' });
      const job = await prisma.job.findFirst({ where: { id: req.params.id, workerId: worker.id } });
      if (!job) return res.status(403).json({ error: 'Not your job' });
      workerId = worker.id;
    } else {
      const job = await prisma.job.findFirst({
        where: { id: req.params.id, property: { host: { userId: req.user!.id } } },
      });
      if (!job) return res.status(404).json({ error: 'Job not found' });
      workerId = job.workerId ?? null;
    }

    const { completionPhotoUrl, completionVideoUrl } = req.body ?? {};
    const updated = await prisma.job.update({
      where: { id: req.params.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        ...(req.body?.completionPhotoUrl ? { completionPhotoUrl: req.body.completionPhotoUrl } : {}),
        ...(req.body?.completionVideoUrl ? { completionVideoUrl: req.body.completionVideoUrl } : {}),
      },
      include: JOB_INCLUDE,
    });

    if (workerId) {
      await prisma.worker.update({
        where: { id: workerId },
        data: { jobsCompleted: { increment: 1 } },
      });
    }

    return res.json(parseJob(updated));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/cancel', async (req: AuthRequest, res: Response) => {
  try {
    if (!isHost(req)) return res.status(403).json({ error: 'Hosts only' });
    const job = await prisma.job.findFirst({
      where: { id: req.params.id, property: { host: { userId: req.user!.id } } },
    });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    const updated = await prisma.job.update({ where: { id: req.params.id }, data: { status: 'CANCELLED' } });
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/archive', async (req: AuthRequest, res: Response) => {
  try {
    if (!isHost(req)) return res.status(403).json({ error: 'Hosts only' });
    const job = await prisma.job.findFirst({
      where: { id: req.params.id, property: { host: { userId: req.user!.id } } },
    });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    const updated = await prisma.job.update({
      where: { id: req.params.id },
      data: { archivedAt: new Date() },
      include: JOB_INCLUDE,
    });
    return res.json(parseJob(updated));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/unarchive', async (req: AuthRequest, res: Response) => {
  try {
    if (!isHost(req)) return res.status(403).json({ error: 'Hosts only' });
    const job = await prisma.job.findFirst({
      where: { id: req.params.id, property: { host: { userId: req.user!.id } } },
    });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    const updated = await prisma.job.update({
      where: { id: req.params.id },
      data: { archivedAt: null },
      include: JOB_INCLUDE,
    });
    return res.json(parseJob(updated));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/issues', validate(issueSchema), async (req: AuthRequest, res: Response) => {
  try {
    let job: { id: string; propertyId: string } | null = null;
    let reportedById: string | null = null;

    if (isWorker(req)) {
      const worker = await prisma.worker.findUnique({ where: { userId: req.user!.id } });
      if (!worker) return res.status(403).json({ error: 'Worker not found' });
      job = await prisma.job.findFirst({ where: { id: req.params.id, workerId: worker.id } });
      if (job) reportedById = worker.id;
    } else {
      job = await prisma.job.findFirst({
        where: { id: req.params.id, property: { host: { userId: req.user!.id } } },
      });
    }
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const mediaUrls: { url: string; type: string }[] = req.body.mediaUrls || [];
    const photoUrl = req.body.photoUrl ?? mediaUrls.find((m: any) => m.type === 'image')?.url ?? null;
    const videoUrl = req.body.videoUrl ?? mediaUrls.find((m: any) => m.type === 'video')?.url ?? null;

    const issue = await prisma.issue.create({
      data: {
        jobId: req.params.id,
        propertyId: job.propertyId,
        reportedById: reportedById ?? undefined,
        description: req.body.description,
        severity: req.body.severity,
        photoUrl,
        videoUrl,
        mediaUrls: mediaUrls.length > 0 ? JSON.stringify(mediaUrls) : null,
      },
    });

    // Trigger AI analysis if commercial extension is available
    if (req.app.locals.analyzeIssue) {
      const property = await prisma.property.findUnique({
        where: { id: job.propertyId },
        select: { hostId: true },
      });
      if (property?.hostId) {
        req.app.locals.analyzeIssue(
          { ...issue, propertyId: job.propertyId },
          property.hostId
        ).catch((err: any) => console.error('AI issue analysis failed:', err));
      }
    }

    return res.status(201).json(issue);
  } catch (err: any) {
    console.error('Issue create error:', err);
    return res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

router.get('/:id/issues', async (req: AuthRequest, res: Response) => {
  try {
    const where = isWorker(req)
      ? { id: req.params.id, worker: { userId: req.user!.id } }
      : { id: req.params.id, property: { host: { userId: req.user!.id } } };
    const job = await prisma.job.findFirst({ where, select: { id: true } });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const issues = await prisma.issue.findMany({
      where: { jobId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(issues);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Supervisor audit ──────────────────────────────────────────────────────────

const auditSchema = z.object({
  rating: z.number().int().min(1).max(5),
  notes: z.string().min(1),
});

// POST /api/jobs/:id/audit — supervisor submits or updates an audit
router.post('/:id/audit', validate(auditSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!isWorker(req)) return res.status(403).json({ error: 'Workers only' });
    const supervisor = await prisma.worker.findUnique({ where: { userId: req.user!.id } });
    if (!supervisor) return res.status(403).json({ error: 'Worker not found' });

    // Verify the job exists and the supervisor is assigned to the property as SUPERVISOR
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: { property: true },
    });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const assignment = await prisma.propertyStaff.findFirst({
      where: { propertyId: job.propertyId, workerId: supervisor.id, role: 'SUPERVISOR' },
    });
    if (!assignment) return res.status(403).json({ error: 'Only supervisors assigned to this property can audit jobs' });

    const audit = await prisma.jobAudit.upsert({
      where: { jobId: req.params.id },
      create: { jobId: req.params.id, supervisorId: supervisor.id, rating: req.body.rating, notes: req.body.notes },
      update: { supervisorId: supervisor.id, rating: req.body.rating, notes: req.body.notes },
      include: { supervisor: { include: { user: { select: { name: true } } } } },
    });
    return res.json(audit);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/jobs/:id/audit — get audit for a job
router.get('/:id/audit', async (req: AuthRequest, res: Response) => {
  try {
    const audit = await prisma.jobAudit.findUnique({
      where: { jobId: req.params.id },
      include: { supervisor: { include: { user: { select: { name: true } } } } },
    });
    if (!audit) return res.status(404).json({ error: 'No audit found' });
    return res.json(audit);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
