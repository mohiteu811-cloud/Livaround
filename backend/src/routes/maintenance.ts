import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();
router.use(authenticate);

const createSchema = z.object({
  propertyId: z.string(),
  tradeRoleId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  photoUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
});

const approveSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  assignedWorkerId: z.string().optional(),
  scheduledAt: z.string().optional(),
  hostNotes: z.string().optional(),
});

// Helper: get worker profile if role is WORKER
async function getWorkerIfStaff(req: AuthRequest, res: Response): Promise<{ workerId: string } | null> {
  if (req.user!.role !== 'WORKER') {
    res.status(403).json({ error: 'Only assigned workers can create maintenance requests' });
    return null;
  }
  const worker = await prisma.worker.findUnique({ where: { userId: req.user!.id } });
  if (!worker) { res.status(404).json({ error: 'Worker profile not found' }); return null; }
  return { workerId: worker.id };
}

// Helper: get host
async function getHost(req: AuthRequest, res: Response): Promise<{ id: string } | null> {
  const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
  if (!host) { res.status(403).json({ error: 'Not a host account' }); return null; }
  return host;
}

// List maintenance requests
// HOST: sees all requests for their properties
// WORKER: sees requests they reported or are assigned to
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { status, propertyId, priority } = req.query as Record<string, string>;

    let where: Record<string, unknown> = {};

    if (req.user!.role === 'HOST') {
      const host = await getHost(req, res);
      if (!host) return;
      const properties = await prisma.property.findMany({ where: { hostId: host.id }, select: { id: true } });
      where.propertyId = { in: properties.map((p) => p.id) };
    } else if (req.user!.role === 'WORKER') {
      const worker = await prisma.worker.findUnique({ where: { userId: req.user!.id } });
      if (!worker) return res.status(404).json({ error: 'Worker not found' });
      where.OR = [{ reportedById: worker.id }, { assignedWorkerId: worker.id }];
    }

    if (status) where.status = status;
    if (propertyId) where.propertyId = propertyId;
    if (priority) where.priority = priority;

    const requests = await prisma.maintenanceRequest.findMany({
      where,
      include: {
        property: { select: { id: true, name: true, city: true } },
        tradeRole: true,
        reportedBy: { include: { user: { select: { id: true, name: true } } } },
        assignedWorker: { include: { user: { select: { id: true, name: true } } } },
        job: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(requests);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create maintenance request (workers only — must be assigned to the property)
router.post('/', validate(createSchema), async (req: AuthRequest, res: Response) => {
  try {
    const staffInfo = await getWorkerIfStaff(req, res);
    if (!staffInfo) return;
    const { workerId } = staffInfo;

    // Verify worker is assigned to this property
    const assignment = await prisma.propertyStaff.findFirst({
      where: { propertyId: req.body.propertyId, workerId },
    });
    if (!assignment) {
      return res.status(403).json({ error: 'You are not assigned to this property' });
    }

    // Check property maintenance settings for auto-assign logic
    const settings = await prisma.propertyMaintenanceSettings.findUnique({
      where: { propertyId: req.body.propertyId },
    });

    let initialStatus = 'PENDING';
    let assignedWorkerId: string | undefined;

    if (settings && !settings.requireApproval) {
      // Auto-assign if the trade role is in the auto-assign list
      const autoRoles: string[] = JSON.parse(settings.autoAssignTradeRoles || '[]');
      if (req.body.tradeRoleId && autoRoles.includes(req.body.tradeRoleId)) {
        initialStatus = 'AUTO_ASSIGNED';
        // Find an available worker with this trade role
        const tradeWorker = await prisma.worker.findFirst({
          where: { tradeRoleId: req.body.tradeRoleId, isAvailable: true },
        });
        if (tradeWorker) assignedWorkerId = tradeWorker.id;
      }
    }

    const request = await prisma.maintenanceRequest.create({
      data: {
        propertyId: req.body.propertyId,
        reportedById: workerId,
        tradeRoleId: req.body.tradeRoleId,
        title: req.body.title,
        description: req.body.description,
        photoUrl: req.body.photoUrl,
        videoUrl: req.body.videoUrl,
        priority: req.body.priority || 'MEDIUM',
        status: initialStatus,
        assignedWorkerId,
      },
      include: {
        property: { select: { id: true, name: true, city: true } },
        tradeRole: true,
        reportedBy: { include: { user: { select: { id: true, name: true } } } },
        assignedWorker: { include: { user: { select: { id: true, name: true } } } },
      },
    });
    return res.status(201).json(request);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single maintenance request
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const request = await prisma.maintenanceRequest.findUnique({
      where: { id: req.params.id },
      include: {
        property: { select: { id: true, name: true, city: true } },
        tradeRole: true,
        reportedBy: { include: { user: { select: { id: true, name: true, email: true } } } },
        assignedWorker: { include: { user: { select: { id: true, name: true, phone: true } } } },
        job: { select: { id: true, status: true, scheduledAt: true } },
      },
    });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    return res.json(request);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Approve or reject a maintenance request (host only)
router.post('/:id/review', validate(approveSchema), async (req: AuthRequest, res: Response) => {
  try {
    const host = await getHost(req, res);
    if (!host) return;

    const mr = await prisma.maintenanceRequest.findUnique({
      where: { id: req.params.id },
      include: { property: true },
    });
    if (!mr) return res.status(404).json({ error: 'Request not found' });
    if (mr.property.hostId !== host.id) return res.status(403).json({ error: 'Not your property' });
    if (!['PENDING', 'AUTO_ASSIGNED'].includes(mr.status)) {
      return res.status(400).json({ error: 'Request already reviewed' });
    }

    const { action, assignedWorkerId, scheduledAt, hostNotes } = req.body;

    if (action === 'REJECT') {
      const updated = await prisma.maintenanceRequest.update({
        where: { id: req.params.id },
        data: { status: 'REJECTED', hostNotes },
      });
      return res.json(updated);
    }

    // APPROVE — create a job and link it
    const scheduled = scheduledAt ? new Date(scheduledAt) : new Date(Date.now() + 24 * 60 * 60 * 1000);
    const job = await prisma.job.create({
      data: {
        propertyId: mr.propertyId,
        workerId: assignedWorkerId || null,
        type: 'MAINTENANCE',
        status: assignedWorkerId ? 'DISPATCHED' : 'PENDING',
        scheduledAt: scheduled,
        notes: `Maintenance Request: ${mr.title}\n${mr.description}`,
      },
    });

    const updated = await prisma.maintenanceRequest.update({
      where: { id: req.params.id },
      data: {
        status: assignedWorkerId ? 'ASSIGNED' : 'APPROVED',
        assignedWorkerId: assignedWorkerId || undefined,
        scheduledAt: scheduled,
        hostNotes,
        jobId: job.id,
      },
      include: {
        property: { select: { id: true, name: true, city: true } },
        tradeRole: true,
        assignedWorker: { include: { user: { select: { id: true, name: true } } } },
        job: { select: { id: true, status: true } },
      },
    });
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Caretaker assigns a tradesperson (when allowCaretakerAssign is enabled)
router.post('/:id/assign', async (req: AuthRequest, res: Response) => {
  try {
    const staffInfo = await getWorkerIfStaff(req, res);
    if (!staffInfo) return;

    const mr = await prisma.maintenanceRequest.findUnique({
      where: { id: req.params.id },
      include: { property: true },
    });
    if (!mr) return res.status(404).json({ error: 'Request not found' });

    // Check permission
    const settings = await prisma.propertyMaintenanceSettings.findUnique({
      where: { propertyId: mr.propertyId },
    });
    if (!settings?.allowCaretakerAssign) {
      return res.status(403).json({ error: 'Caretaker assignment not enabled for this property' });
    }

    const { assignedWorkerId, scheduledAt } = req.body;
    const updated = await prisma.maintenanceRequest.update({
      where: { id: req.params.id },
      data: {
        assignedWorkerId,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        status: 'ASSIGNED',
      },
    });
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
