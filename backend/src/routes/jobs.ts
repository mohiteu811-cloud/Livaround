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
});

const dispatchSchema = z.object({
  workerId: z.string(),
});

const issueSchema = z.object({
  description: z.string().min(5),
  photoUrl: z.string().optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('LOW'),
});

function isHost(req: AuthRequest) { return req.user!.role === 'HOST'; }
function isWorker(req: AuthRequest) { return req.user!.role === 'WORKER'; }

// GET /api/jobs — hosts see their property jobs, workers see their own
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { propertyId, status, type, workerId } = req.query;

    let baseWhere: Record<string, unknown>;
    if (isWorker(req)) {
      const worker = await prisma.worker.findUnique({ where: { userId: req.user!.id } });
      if (!worker) return res.json([]);
      baseWhere = { workerId: worker.id };
    } else {
      baseWhere = { property: { host: { userId: req.user!.id } } };
    }

    const jobs = await prisma.job.findMany({
      where: {
        ...baseWhere,
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
    const { checklist, ...rest } = req.body;
    const job = await prisma.job.create({
      data: {
        ...rest,
        ...(checklist ? { checklist: JSON.stringify(checklist) } : {}),
      },
    });
    return res.status(201).json(parseJob(job));
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

    const updated = await prisma.job.update({
      where: { id: req.params.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
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

router.post('/:id/issues', validate(issueSchema), async (req: AuthRequest, res: Response) => {
  try {
    let job;
    if (isWorker(req)) {
      const worker = await prisma.worker.findUnique({ where: { userId: req.user!.id } });
      if (!worker) return res.status(403).json({ error: 'Worker not found' });
      job = await prisma.job.findFirst({ where: { id: req.params.id, workerId: worker.id } });
    } else {
      job = await prisma.job.findFirst({
        where: { id: req.params.id, property: { host: { userId: req.user!.id } } },
      });
    }
    if (!job) return res.status(404).json({ error: 'Job not found' });
    const issue = await prisma.issue.create({ data: { jobId: req.params.id, ...req.body } });
    return res.status(201).json(issue);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/issues', async (req: AuthRequest, res: Response) => {
  try {
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

export default router;
