import { Router, Response } from 'express';
import { prisma } from '../../../../backend/src/lib/prisma';
import { authenticate, AuthRequest } from '../../../../backend/src/middleware/auth';
import { compareSnapshots } from '../lib/inventory-comparator';
import { generateAuditIssues } from '../lib/audit-issue-generator';

const router = Router();
router.use(authenticate);

// ── POST /api/audits ─────────────────────────────────────────────────────────
// Create audit from a post-checkout walkthrough (manual trigger)

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
    if (!host) return res.status(403).json({ error: 'Host not found' });

    const { walkthroughId } = req.body;
    if (!walkthroughId) return res.status(400).json({ error: 'walkthroughId is required' });

    const walkthrough = await prisma.videoWalkthrough.findFirst({
      where: { id: walkthroughId, property: { hostId: host.id } },
      select: {
        id: true, propertyId: true, bookingId: true, walkthroughType: true,
        inventorySnapshotId: true, status: true,
      },
    });
    if (!walkthrough) return res.status(404).json({ error: 'Walkthrough not found' });
    if (walkthrough.status !== 'completed') {
      return res.status(400).json({ error: 'Walkthrough processing is not complete' });
    }
    if (!walkthrough.bookingId) {
      return res.status(400).json({ error: 'Walkthrough has no associated booking' });
    }
    if (!walkthrough.inventorySnapshotId) {
      return res.status(400).json({ error: 'Walkthrough has no inventory snapshot' });
    }

    // Check if audit already exists for this walkthrough
    const existing = await prisma.checkoutAudit.findFirst({
      where: { walkthroughId: walkthrough.id },
    });
    if (existing) return res.status(409).json({ error: 'Audit already exists', auditId: existing.id });

    // Find baseline snapshot
    const baseline = await prisma.inventorySnapshot.findFirst({
      where: { propertyId: walkthrough.propertyId, status: 'CONFIRMED', type: 'BASELINE' },
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { room: { select: { id: true, label: true, floor: true } } } },
      },
    });
    if (!baseline) return res.status(400).json({ error: 'No confirmed baseline snapshot for this property' });

    // Load the audit snapshot
    const auditSnapshot = await prisma.inventorySnapshot.findUnique({
      where: { id: walkthrough.inventorySnapshotId },
      include: {
        items: { include: { room: { select: { id: true, label: true, floor: true } } } },
      },
    });
    if (!auditSnapshot) return res.status(400).json({ error: 'Audit snapshot not found' });

    // Compare
    const findings = compareSnapshots(baseline, auditSnapshot);

    // Create audit record
    const audit = await prisma.checkoutAudit.create({
      data: {
        bookingId: walkthrough.bookingId,
        propertyId: walkthrough.propertyId,
        walkthroughId: walkthrough.id,
        baselineSnapshotId: baseline.id,
        auditSnapshotId: auditSnapshot.id,
        status: 'review',
        itemsMissing: findings.summary.itemsMissing,
        itemsDamaged: findings.summary.itemsDamaged,
        itemsOk: findings.summary.itemsOk,
        overallScore: findings.summary.overallScore,
        findings: findings as any,
      },
    });

    return res.status(201).json(audit);
  } catch (err) {
    console.error('Create audit error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/audits/:id ──────────────────────────────────────────────────────
// Get audit with full details

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
    if (!host) return res.status(403).json({ error: 'Host not found' });

    const audit = await prisma.checkoutAudit.findFirst({
      where: { id: req.params.id, property: { hostId: host.id } },
      include: {
        booking: { select: { id: true, guestName: true, checkIn: true, checkOut: true } },
        property: { select: { id: true, name: true, address: true } },
        walkthrough: { select: { id: true, createdAt: true, walkthroughType: true } },
      },
    });
    if (!audit) return res.status(404).json({ error: 'Audit not found' });

    return res.json(audit);
  } catch (err) {
    console.error('Get audit error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/audits/:id/findings ─────────────────────────────────────────────
// List findings from stored JSON

router.get('/:id/findings', async (req: AuthRequest, res: Response) => {
  try {
    const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
    if (!host) return res.status(403).json({ error: 'Host not found' });

    const audit = await prisma.checkoutAudit.findFirst({
      where: { id: req.params.id, property: { hostId: host.id } },
      select: { id: true, findings: true, status: true },
    });
    if (!audit) return res.status(404).json({ error: 'Audit not found' });

    const findings = audit.findings as any;
    if (!findings) return res.json({ findings: [], summary: null });

    // Flatten all findings into a single list with type labels
    const allFindings = [
      ...(findings.missing || []),
      ...(findings.damaged || []),
      ...(findings.lowStock || []),
      ...(findings.newItems || []),
    ];

    return res.json({
      findings: allFindings,
      unchanged: findings.unchanged?.length || 0,
      summary: findings.summary,
    });
  } catch (err) {
    console.error('Get findings error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /api/audits/:id/findings/:findingId ────────────────────────────────
// Update a finding (dismiss or adjust severity)

router.patch('/:id/findings/:findingId', async (req: AuthRequest, res: Response) => {
  try {
    const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
    if (!host) return res.status(403).json({ error: 'Host not found' });

    const audit = await prisma.checkoutAudit.findFirst({
      where: { id: req.params.id, property: { hostId: host.id } },
    });
    if (!audit) return res.status(404).json({ error: 'Audit not found' });
    if (audit.status === 'completed') {
      return res.status(400).json({ error: 'Audit is already completed' });
    }

    const findings = audit.findings as any;
    if (!findings) return res.status(404).json({ error: 'No findings data' });

    const { dismissed, severity } = req.body;
    const findingId = req.params.findingId;

    // Search and update across all finding arrays
    let found = false;
    for (const key of ['missing', 'damaged', 'lowStock', 'newItems']) {
      const arr = findings[key];
      if (!Array.isArray(arr)) continue;
      for (const f of arr) {
        if (f.id === findingId) {
          if (dismissed !== undefined) f.dismissed = dismissed;
          if (severity) f.severity = severity;
          found = true;
          break;
        }
      }
      if (found) break;
    }

    if (!found) return res.status(404).json({ error: 'Finding not found' });

    // Recalculate summary counts (excluding dismissed)
    const activeMissing = (findings.missing || []).filter((f: any) => !f.dismissed);
    const activeDamaged = (findings.damaged || []).filter((f: any) => !f.dismissed);

    await prisma.checkoutAudit.update({
      where: { id: audit.id },
      data: {
        findings: findings,
        itemsMissing: activeMissing.length,
        itemsDamaged: activeDamaged.length,
      },
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('Update finding error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/audits/:id/confirm ─────────────────────────────────────────────
// Worker/host confirms audit → triggers escalation for non-dismissed findings

router.post('/:id/confirm', async (req: AuthRequest, res: Response) => {
  try {
    const audit = await prisma.checkoutAudit.findUnique({
      where: { id: req.params.id },
      include: { property: { select: { hostId: true } } },
    });
    if (!audit) return res.status(404).json({ error: 'Audit not found' });

    // Allow both host and worker to confirm
    const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
    const worker = await prisma.worker.findUnique({ where: { userId: req.user!.id } });
    if (!host && !worker) return res.status(403).json({ error: 'Not authorized' });

    if (audit.status === 'completed') {
      return res.status(400).json({ error: 'Audit is already completed' });
    }

    const findings = audit.findings as any;

    // Generate issues for confirmed (non-dismissed) findings
    let issueResult = { issueIds: [] as string[], escalatedCount: 0 };
    if (findings) {
      issueResult = await generateAuditIssues(
        audit.id,
        audit.propertyId,
        audit.bookingId,
        findings
      );
    }

    // Mark as completed
    await prisma.checkoutAudit.update({
      where: { id: audit.id },
      data: {
        status: 'completed',
        reviewedById: req.user!.id,
        reviewedAt: new Date(),
      },
    });

    return res.json({
      ok: true,
      issuesCreated: issueResult.issueIds.length,
      escalatedCount: issueResult.escalatedCount,
    });
  } catch (err) {
    console.error('Confirm audit error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/audits/property/:propertyId ─────────────────────────────────────
// List audits for a property (used by property detail screen)

router.get('/property/:propertyId', async (req: AuthRequest, res: Response) => {
  try {
    const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
    if (!host) return res.status(403).json({ error: 'Host not found' });

    const property = await prisma.property.findFirst({
      where: { id: req.params.propertyId, hostId: host.id },
    });
    if (!property) return res.status(404).json({ error: 'Property not found' });

    const audits = await prisma.checkoutAudit.findMany({
      where: { propertyId: req.params.propertyId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        booking: { select: { id: true, guestName: true, checkOut: true } },
      },
    });

    return res.json(audits);
  } catch (err) {
    console.error('List audits error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
