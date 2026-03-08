import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();
router.use(authenticate);

const assignSchema = z.object({
  workerId: z.string(),
  role: z.enum(['CARETAKER', 'CLEANER']).default('CLEANER'),
});

const settingsSchema = z.object({
  requireApproval: z.boolean().optional(),
  autoAssignTradeRoles: z.array(z.string()).optional(),
  allowCaretakerAssign: z.boolean().optional(),
});

async function getHostId(req: AuthRequest, res: Response): Promise<string | null> {
  const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
  if (!host) { res.status(403).json({ error: 'Not a host account' }); return null; }
  return host.id;
}

async function assertPropertyOwner(propertyId: string, hostId: string, res: Response): Promise<boolean> {
  const property = await prisma.property.findFirst({ where: { id: propertyId, hostId } });
  if (!property) { res.status(403).json({ error: 'Property not found' }); return false; }
  return true;
}

// Get staff for a property
router.get('/:propertyId/staff', async (req: AuthRequest, res: Response) => {
  try {
    const hostId = await getHostId(req, res);
    if (!hostId) return;
    if (!await assertPropertyOwner(req.params.propertyId, hostId, res)) return;

    const staff = await prisma.propertyStaff.findMany({
      where: { propertyId: req.params.propertyId },
      include: {
        worker: {
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
            tradeRole: true,
          },
        },
      },
    });
    return res.json(staff);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Assign staff to a property
router.post('/:propertyId/staff', validate(assignSchema), async (req: AuthRequest, res: Response) => {
  try {
    const hostId = await getHostId(req, res);
    if (!hostId) return;
    if (!await assertPropertyOwner(req.params.propertyId, hostId, res)) return;

    const assignment = await prisma.propertyStaff.upsert({
      where: { propertyId_workerId: { propertyId: req.params.propertyId, workerId: req.body.workerId } },
      create: { propertyId: req.params.propertyId, workerId: req.body.workerId, role: req.body.role },
      update: { role: req.body.role },
      include: { worker: { include: { user: { select: { id: true, name: true, email: true } } } } },
    });
    return res.status(201).json(assignment);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove staff from a property
router.delete('/:propertyId/staff/:workerId', async (req: AuthRequest, res: Response) => {
  try {
    const hostId = await getHostId(req, res);
    if (!hostId) return;
    if (!await assertPropertyOwner(req.params.propertyId, hostId, res)) return;

    await prisma.propertyStaff.deleteMany({
      where: { propertyId: req.params.propertyId, workerId: req.params.workerId },
    });
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get maintenance settings for a property
router.get('/:propertyId/maintenance-settings', async (req: AuthRequest, res: Response) => {
  try {
    const hostId = await getHostId(req, res);
    if (!hostId) return;
    if (!await assertPropertyOwner(req.params.propertyId, hostId, res)) return;

    const settings = await prisma.propertyMaintenanceSettings.findUnique({
      where: { propertyId: req.params.propertyId },
    });
    // Return defaults if not configured yet
    return res.json(settings || {
      propertyId: req.params.propertyId,
      requireApproval: true,
      autoAssignTradeRoles: [],
      allowCaretakerAssign: false,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update maintenance settings for a property
router.put('/:propertyId/maintenance-settings', validate(settingsSchema), async (req: AuthRequest, res: Response) => {
  try {
    const hostId = await getHostId(req, res);
    if (!hostId) return;
    if (!await assertPropertyOwner(req.params.propertyId, hostId, res)) return;

    const { requireApproval, autoAssignTradeRoles, allowCaretakerAssign } = req.body;

    const settings = await prisma.propertyMaintenanceSettings.upsert({
      where: { propertyId: req.params.propertyId },
      create: {
        propertyId: req.params.propertyId,
        ...(requireApproval !== undefined && { requireApproval }),
        ...(autoAssignTradeRoles && { autoAssignTradeRoles: JSON.stringify(autoAssignTradeRoles) }),
        ...(allowCaretakerAssign !== undefined && { allowCaretakerAssign }),
      },
      update: {
        ...(requireApproval !== undefined && { requireApproval }),
        ...(autoAssignTradeRoles && { autoAssignTradeRoles: JSON.stringify(autoAssignTradeRoles) }),
        ...(allowCaretakerAssign !== undefined && { allowCaretakerAssign }),
      },
    });
    return res.json({
      ...settings,
      autoAssignTradeRoles: JSON.parse(settings.autoAssignTradeRoles),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
