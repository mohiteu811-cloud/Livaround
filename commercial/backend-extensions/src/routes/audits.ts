import { Router, Response } from 'express';
import { prisma } from '../../../../backend/src/lib/prisma';
import { authenticate, AuthRequest } from '../../../../backend/src/middleware/auth';
import { compareSnapshots } from '../lib/inventory-comparator';
import { createIssuesForFindings } from '../lib/audit-issue-generator';

const router = Router();
router.use(authenticate);

// ── Access control helper ───────────────────────────────────────────────────
// Builds a Prisma `where` clause that restricts a CheckoutAudit query to
// audits the calling user is allowed to see:
//   - Hosts: audits on any property they own
//   - Workers: audits on properties they're staffed on via PropertyStaff
// Returns null if the user has neither role.

async function buildAuditAccessWhere(userId: string, auditId: string) {
  const [host, worker] = await Promise.all([
    prisma.host.findUnique({ where: { userId }, select: { id: true } }),
    prisma.worker.findUnique({ where: { userId }, select: { id: true } }),
  ]);
  if (!host && !worker) return null;

  const propertyConditions: any[] = [];
  if (host) propertyConditions.push({ hostId: host.id });
  if (worker) {
    propertyConditions.push({
      staffAssignments: { some: { workerId: worker.id } },
    });
  }

  return {
    id: auditId,
    property: { OR: propertyConditions },
  };
}

// ── POST /api/audits ─────────────────────────────────────────────────────────
// Manual trigger — create an audit from a completed post-checkout walkthrough.
// Host-only (manual triggers require full ownership, not worker assignment).

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

    const existing = await prisma.checkoutAudit.findFirst({
      where: { walkthroughId: walkthrough.id },
    });
    if (existing) return res.status(409).json({ error: 'Audit already exists', auditId: existing.id });

    const baseline = await prisma.inventorySnapshot.findFirst({
      where: { propertyId: walkthrough.propertyId, status: 'CONFIRMED', type: 'BASELINE' },
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { room: { select: { id: true, label: true, floor: true } } } },
      },
    });
    if (!baseline) return res.status(400).json({ error: 'No confirmed baseline snapshot for this property' });

    const auditSnapshot = await prisma.inventorySnapshot.findUnique({
      where: { id: walkthrough.inventorySnapshotId },
      include: {
        items: { include: { room: { select: { id: true, label: true, floor: true } } } },
      },
    });
    if (!auditSnapshot) return res.status(400).json({ error: 'Audit snapshot not found' });

    const findings = compareSnapshots(baseline, auditSnapshot);

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
// Host or assigned worker can view.

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const where = await buildAuditAccessWhere(req.user!.id, req.params.id);
    if (!where) return res.status(403).json({ error: 'Not authorized' });

    const audit = await prisma.checkoutAudit.findFirst({
      where,
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

router.get('/:id/findings', async (req: AuthRequest, res: Response) => {
  try {
    const where = await buildAuditAccessWhere(req.user!.id, req.params.id);
    if (!where) return res.status(403).json({ error: 'Not authorized' });

    const audit = await prisma.checkoutAudit.findFirst({
      where,
      select: { id: true, findings: true, status: true },
    });
    if (!audit) return res.status(404).json({ error: 'Audit not found' });

    const findings = audit.findings as any;
    if (!findings) return res.json({ findings: [], unchanged: 0, summary: null });

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
// Host or assigned worker can dismiss or adjust severity on a finding.

router.patch('/:id/findings/:findingId', async (req: AuthRequest, res: Response) => {
  try {
    const where = await buildAuditAccessWhere(req.user!.id, req.params.id);
    if (!where) return res.status(403).json({ error: 'Not authorized' });

    const audit = await prisma.checkoutAudit.findFirst({ where });
    if (!audit) return res.status(404).json({ error: 'Audit not found' });
    if (audit.status === 'completed') {
      return res.status(400).json({ error: 'Audit is already completed' });
    }

    const findings = audit.findings as any;
    if (!findings) return res.status(404).json({ error: 'No findings data' });

    const { dismissed, severity } = req.body;
    const findingId = req.params.findingId;

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
// Host or assigned worker finalizes the audit. Creates Issue records for any
// non-dismissed findings above threshold. Idempotent via `issueCreated` flag
// on each finding — re-running never duplicates issues.

router.post('/:id/confirm', async (req: AuthRequest, res: Response) => {
  try {
    const where = await buildAuditAccessWhere(req.user!.id, req.params.id);
    if (!where) return res.status(403).json({ error: 'Not authorized' });

    const audit = await prisma.checkoutAudit.findFirst({ where });
    if (!audit) return res.status(404).json({ error: 'Audit not found' });

    if (audit.status === 'completed') {
      return res.status(400).json({ error: 'Audit is already completed' });
    }

    const findings = audit.findings as any;

    // Generate issues for non-dismissed, above-threshold findings that haven't
    // already been turned into issues. The generator mutates `findings` with
    // `issueCreated: true` on each processed entry, which we persist below.
    let issueResult = { issueIds: [] as string[], updatedFindings: findings };
    if (findings) {
      issueResult = await createIssuesForFindings(
        audit.id,
        audit.propertyId,
        audit.bookingId,
        findings
      );
    }

    await prisma.checkoutAudit.update({
      where: { id: audit.id },
      data: {
        status: 'completed',
        reviewedById: req.user!.id,
        reviewedAt: new Date(),
        findings: issueResult.updatedFindings as any,
      },
    });

    return res.json({
      ok: true,
      issuesCreated: issueResult.issueIds.length,
    });
  } catch (err) {
    console.error('Confirm audit error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/audits/property/:propertyId ─────────────────────────────────────
// Host-only list view for property dashboard.

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
