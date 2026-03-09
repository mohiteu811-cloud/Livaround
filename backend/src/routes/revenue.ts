import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();
router.use(authenticate);

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getHostId(req: AuthRequest, res: Response): Promise<string | null> {
  const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
  if (!host) { res.status(403).json({ error: 'Not a host account' }); return null; }
  return host.id;
}

async function getOwnerId(req: AuthRequest, res: Response): Promise<string | null> {
  const owner = await prisma.owner.findUnique({ where: { userId: req.user!.id } });
  if (!owner) { res.status(403).json({ error: 'Not an owner account' }); return null; }
  return owner.id;
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const createReportSchema = z.object({
  propertyId: z.string(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  grossRevenue: z.number().min(0),
  airbnbServiceFees: z.number().min(0).default(0),
  netRevenue: z.number().min(0),
  commissionPct: z.number().min(0).max(100),
  airbnbReportUrl: z.string().url().optional(),
  notes: z.string().optional(),
});

const updateReportSchema = z.object({
  grossRevenue: z.number().min(0).optional(),
  airbnbServiceFees: z.number().min(0).optional(),
  netRevenue: z.number().min(0).optional(),
  commissionPct: z.number().min(0).max(100).optional(),
  airbnbReportUrl: z.string().url().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
});

const createExpenseSchema = z.object({
  category: z.enum(['HOUSEKEEPING', 'CONSUMABLES', 'REPAIRS', 'UTILITIES', 'MISCELLANEOUS']),
  description: z.string().min(1),
  amount: z.number().min(0),
  expenseType: z.enum(['SHARED', 'OWNER_ONLY']).default('SHARED'),
  receiptUrl: z.string().url().optional().nullable(),
  requiresApproval: z.boolean().default(false),
});

const updateExpenseSchema = z.object({
  category: z.enum(['HOUSEKEEPING', 'CONSUMABLES', 'REPAIRS', 'UTILITIES', 'MISCELLANEOUS']).optional(),
  description: z.string().min(1).optional(),
  amount: z.number().min(0).optional(),
  expenseType: z.enum(['SHARED', 'OWNER_ONLY']).optional(),
  receiptUrl: z.string().url().optional().nullable(),
  requiresApproval: z.boolean().optional(),
});

const reviewExpenseSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  notes: z.string().optional(),
});

// ── HOST routes ───────────────────────────────────────────────────────────────

// List all revenue reports for this host's properties
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const hostId = await getHostId(req, res);
    if (!hostId) return;

    const { propertyId, month, year } = req.query;
    const where: Record<string, unknown> = { hostId };
    if (propertyId) where.propertyId = propertyId as string;
    if (month) where.month = parseInt(month as string);
    if (year) where.year = parseInt(year as string);

    const reports = await prisma.revenueReport.findMany({
      where,
      include: {
        property: { select: { id: true, name: true, city: true } },
        expenses: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    return res.json(reports);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a revenue report
router.post('/', validate(createReportSchema), async (req: AuthRequest, res: Response) => {
  try {
    const hostId = await getHostId(req, res);
    if (!hostId) return;

    const { propertyId, month, year, grossRevenue, airbnbServiceFees, netRevenue, commissionPct, airbnbReportUrl, notes } = req.body;

    // Verify property belongs to this host
    const property = await prisma.property.findFirst({ where: { id: propertyId, hostId } });
    if (!property) return res.status(403).json({ error: 'Property not found' });

    const commissionAmount = (netRevenue * commissionPct) / 100;

    const report = await prisma.revenueReport.create({
      data: {
        propertyId, hostId, month, year,
        grossRevenue, airbnbServiceFees, netRevenue,
        commissionPct, commissionAmount,
        airbnbReportUrl, notes,
      },
      include: {
        property: { select: { id: true, name: true, city: true } },
        expenses: true,
      },
    });

    return res.status(201).json(report);
  } catch (err: unknown) {
    console.error(err);
    if ((err as { code?: string }).code === 'P2002') {
      return res.status(409).json({ error: 'A report already exists for this property and month' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single report
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const report = await prisma.revenueReport.findUnique({
      where: { id: req.params.id },
      include: {
        property: { select: { id: true, name: true, city: true } },
        expenses: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!report) return res.status(404).json({ error: 'Report not found' });

    // Allow host or owner linked to the property
    if (req.user!.role === 'HOST') {
      const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
      if (!host || report.hostId !== host.id) return res.status(403).json({ error: 'Forbidden' });
    } else if (req.user!.role === 'OWNER') {
      const owner = await prisma.owner.findUnique({ where: { userId: req.user!.id } });
      if (!owner) return res.status(403).json({ error: 'Forbidden' });
      const ownership = await prisma.propertyOwnership.findFirst({
        where: { ownerId: owner.id, propertyId: report.propertyId },
      });
      if (!ownership) return res.status(403).json({ error: 'Forbidden' });
    }

    return res.json(report);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update report (host only)
router.put('/:id', validate(updateReportSchema), async (req: AuthRequest, res: Response) => {
  try {
    const hostId = await getHostId(req, res);
    if (!hostId) return;

    const existing = await prisma.revenueReport.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.hostId !== hostId) return res.status(404).json({ error: 'Report not found' });

    const data: Record<string, unknown> = { ...req.body };
    // Recalculate commission if relevant fields change
    const netRevenue = data.netRevenue !== undefined ? (data.netRevenue as number) : existing.netRevenue;
    const commissionPct = data.commissionPct !== undefined ? (data.commissionPct as number) : existing.commissionPct;
    data.commissionAmount = (netRevenue * commissionPct) / 100;

    const report = await prisma.revenueReport.update({
      where: { id: req.params.id },
      data,
      include: {
        property: { select: { id: true, name: true, city: true } },
        expenses: { orderBy: { createdAt: 'asc' } },
      },
    });

    return res.json(report);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete report (host only)
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const hostId = await getHostId(req, res);
    if (!hostId) return;

    const existing = await prisma.revenueReport.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.hostId !== hostId) return res.status(404).json({ error: 'Report not found' });

    await prisma.revenueReport.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Expense routes (host CRUD) ────────────────────────────────────────────────

// Add expense to report
router.post('/:id/expenses', validate(createExpenseSchema), async (req: AuthRequest, res: Response) => {
  try {
    const hostId = await getHostId(req, res);
    if (!hostId) return;

    const report = await prisma.revenueReport.findUnique({ where: { id: req.params.id } });
    if (!report || report.hostId !== hostId) return res.status(404).json({ error: 'Report not found' });

    const expense = await prisma.expense.create({
      data: {
        reportId: req.params.id,
        propertyId: report.propertyId,
        ...req.body,
      },
    });

    return res.status(201).json(expense);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update expense (host only)
router.put('/:id/expenses/:expenseId', validate(updateExpenseSchema), async (req: AuthRequest, res: Response) => {
  try {
    const hostId = await getHostId(req, res);
    if (!hostId) return;

    const report = await prisma.revenueReport.findUnique({ where: { id: req.params.id } });
    if (!report || report.hostId !== hostId) return res.status(404).json({ error: 'Report not found' });

    const expense = await prisma.expense.update({
      where: { id: req.params.expenseId },
      data: req.body,
    });

    return res.json(expense);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete expense (host only)
router.delete('/:id/expenses/:expenseId', async (req: AuthRequest, res: Response) => {
  try {
    const hostId = await getHostId(req, res);
    if (!hostId) return;

    const report = await prisma.revenueReport.findUnique({ where: { id: req.params.id } });
    if (!report || report.hostId !== hostId) return res.status(404).json({ error: 'Report not found' });

    await prisma.expense.delete({ where: { id: req.params.expenseId } });
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Owner routes ──────────────────────────────────────────────────────────────

// Owner: list their revenue reports
router.get('/owner/reports', async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role !== 'OWNER') return res.status(403).json({ error: 'Owner access only' });
    const ownerId = await getOwnerId(req, res);
    if (!ownerId) return;

    const ownerships = await prisma.propertyOwnership.findMany({
      where: { ownerId },
      select: { propertyId: true },
    });
    const propertyIds = ownerships.map((o) => o.propertyId);

    const reports = await prisma.revenueReport.findMany({
      where: { propertyId: { in: propertyIds }, status: 'PUBLISHED' },
      include: {
        property: { select: { id: true, name: true, city: true } },
        expenses: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    return res.json(reports);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Owner: approve or reject an expense
router.post('/:id/expenses/:expenseId/review', validate(reviewExpenseSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role !== 'OWNER') return res.status(403).json({ error: 'Owner access only' });
    const ownerId = await getOwnerId(req, res);
    if (!ownerId) return;

    const report = await prisma.revenueReport.findUnique({ where: { id: req.params.id } });
    if (!report) return res.status(404).json({ error: 'Report not found' });

    // Verify this owner is linked to the property
    const ownership = await prisma.propertyOwnership.findFirst({
      where: { ownerId, propertyId: report.propertyId },
    });
    if (!ownership) return res.status(403).json({ error: 'Not linked to this property' });

    const expense = await prisma.expense.findFirst({
      where: { id: req.params.expenseId, reportId: req.params.id },
    });
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    if (!expense.requiresApproval) return res.status(400).json({ error: 'This expense does not require approval' });

    const { action, notes } = req.body;

    const updated = await prisma.expense.update({
      where: { id: req.params.expenseId },
      data: {
        approvalStatus: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        approvedByUserId: req.user!.id,
        approvedAt: new Date(),
        approverNotes: notes,
      },
    });

    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
