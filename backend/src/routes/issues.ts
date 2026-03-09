import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();
router.use(authenticate);

const createIssueSchema = z.object({
  propertyId: z.string(),
  jobId: z.string().optional(),
  description: z.string().min(5),
  photoUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
});

// POST /api/issues — supervisor creates an issue (job optional)
router.post('/', validate(createIssueSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role !== 'WORKER') return res.status(403).json({ error: 'Workers only' });

    const worker = await prisma.worker.findUnique({ where: { userId: req.user!.id } });
    if (!worker) return res.status(403).json({ error: 'Worker not found' });

    // Must be a supervisor on this property
    const assignment = await prisma.propertyStaff.findFirst({
      where: { propertyId: req.body.propertyId, workerId: worker.id, role: 'SUPERVISOR' },
    });
    if (!assignment) {
      return res.status(403).json({ error: 'Only supervisors assigned to this property can report issues without a job' });
    }

    // If jobId provided, verify it belongs to this property
    if (req.body.jobId) {
      const job = await prisma.job.findFirst({
        where: { id: req.body.jobId, propertyId: req.body.propertyId },
      });
      if (!job) return res.status(404).json({ error: 'Job not found for this property' });
    }

    const issue = await prisma.issue.create({
      data: {
        propertyId: req.body.propertyId,
        jobId: req.body.jobId ?? null,
        reportedById: worker.id,
        description: req.body.description,
        photoUrl: req.body.photoUrl ?? null,
        videoUrl: req.body.videoUrl ?? null,
        severity: req.body.severity,
      },
      include: {
        job: { select: { id: true, type: true, scheduledAt: true } },
        property: { select: { id: true, name: true } },
        reportedBy: { include: { user: { select: { name: true } } } },
      },
    });
    return res.status(201).json(issue);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/issues?propertyId= — list issues for a property (host or supervisor)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { propertyId, severity, status } = req.query;
    if (!propertyId) return res.status(400).json({ error: 'propertyId required' });

    if (req.user!.role === 'WORKER') {
      // Supervisor must be assigned to the property
      const worker = await prisma.worker.findUnique({ where: { userId: req.user!.id } });
      if (!worker) return res.json([]);
      const assignment = await prisma.propertyStaff.findFirst({
        where: { propertyId: propertyId as string, workerId: worker.id, role: 'SUPERVISOR' },
      });
      if (!assignment) return res.status(403).json({ error: 'Not a supervisor for this property' });
    } else {
      // Host must own the property
      const prop = await prisma.property.findFirst({
        where: { id: propertyId as string, host: { userId: req.user!.id } },
      });
      if (!prop) return res.status(403).json({ error: 'Property not found or access denied' });
    }

    const issues = await prisma.issue.findMany({
      where: {
        propertyId: propertyId as string,
        ...(severity ? { severity: severity as string } : {}),
        ...(status ? { status: status as string } : {}),
      },
      include: {
        job: { select: { id: true, type: true, scheduledAt: true } },
        reportedBy: { include: { user: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(issues);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/issues/my-properties — supervisor's supervised properties with issue counts
router.get('/my-properties', async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role !== 'WORKER') return res.status(403).json({ error: 'Workers only' });
    const worker = await prisma.worker.findUnique({ where: { userId: req.user!.id } });
    if (!worker) return res.json([]);

    const assignments = await prisma.propertyStaff.findMany({
      where: { workerId: worker.id, role: 'SUPERVISOR' },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            city: true,
            _count: { select: { issues: true } },
          },
        },
      },
    });

    return res.json(assignments.map(a => a.property));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
