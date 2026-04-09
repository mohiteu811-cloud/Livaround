import { prisma } from '../../../../backend/src/lib/prisma';
import { analyzeIssue } from './ai-analyzer';
import { getIO } from './socket';
import type { AuditFinding, AuditFindings } from './inventory-comparator';

// Extended finding shape with tracking for already-created issues
interface TrackedFinding extends AuditFinding {
  issueCreated?: boolean;
  generatedIssueId?: string;
}

// ── Escalation thresholds ────────────────────────────────────────────────────

// Findings that should generate an Issue record on confirm
function shouldCreateIssue(finding: AuditFinding): boolean {
  if (finding.dismissed) return false;

  switch (finding.type) {
    case 'MISSING':
      if (finding.severity === 'CRITICAL' || finding.severity === 'HIGH') return true;
      if (finding.category !== 'CONSUMABLE' && finding.category !== 'LINEN') return true;
      return false;

    case 'DAMAGED':
      if (finding.severity === 'CRITICAL' || finding.severity === 'HIGH') return true;
      if (finding.baselineItem?.condition === 'GOOD' &&
          finding.auditItem?.condition === 'DAMAGED') return true;
      return false;

    case 'LOW_STOCK':
    case 'NEW_ITEM':
    default:
      return false;
  }
}

// Findings that warrant an immediate push to the host on detection
function isCriticalFinding(finding: AuditFinding): boolean {
  return finding.severity === 'CRITICAL' ||
    (finding.type === 'MISSING' && finding.severity === 'HIGH') ||
    (finding.type === 'DAMAGED' && finding.severity === 'HIGH');
}

function countCritical(findings: AuditFindings): number {
  const all = [
    ...findings.missing,
    ...findings.damaged,
    ...findings.lowStock,
    ...findings.newItems,
  ];
  return all.filter(isCriticalFinding).length;
}

// ── notifyHostOfAudit ────────────────────────────────────────────────────────
// Sends push + emits socket event. Does NOT create Issue records.
// Called by the background video processor when an audit first lands in review.

export async function notifyHostOfAudit(
  auditId: string,
  propertyId: string,
  findings: AuditFindings
): Promise<{ criticalCount: number }> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { hostId: true, name: true },
  });
  if (!property) throw new Error(`Property ${propertyId} not found`);

  const criticalCount = countCritical(findings);

  // Push notification only if critical findings exist
  if (criticalCount > 0) {
    try {
      const host = await prisma.host.findUnique({
        where: { id: property.hostId },
        select: { pushToken: true, notificationPrefs: true },
      });

      const prefs = (() => {
        try { return JSON.parse(host?.notificationPrefs || '{}'); }
        catch { return {}; }
      })();

      if (host?.pushToken && prefs.aiIssueAlerts !== 'none') {
        const { sendPushNotification } = require('../../../../backend/src/lib/pushNotifications');
        await sendPushNotification(host.pushToken, {
          title: `Checkout Audit: ${criticalCount} critical finding${criticalCount === 1 ? '' : 's'}`,
          body: `${findings.summary.itemsMissing} missing, ${findings.summary.itemsDamaged} damaged at ${property.name}`,
          data: { auditId, type: 'checkout_audit' },
          sound: 'default',
          priority: 'high',
          channelId: 'issues',
        });
      }
    } catch (err) {
      console.error('Failed to send audit push notification:', err);
    }
  }

  // Emit audit completion via Socket.IO
  const io = getIO();
  if (io) {
    io.of('/host').emit('audit:complete', {
      auditId,
      propertyId,
      summary: findings.summary,
      criticalCount,
    });
  }

  return { criticalCount };
}

// ── createIssuesForFindings ──────────────────────────────────────────────────
// Creates Issue records for non-dismissed, above-threshold findings that
// have not already been turned into issues. Mutates `findings` in place to
// record which findings were processed (via `issueCreated` flag). Callers must
// persist the mutated findings JSON back to the CheckoutAudit record.

export interface CreateIssuesResult {
  issueIds: string[];
  updatedFindings: AuditFindings;
}

export async function createIssuesForFindings(
  auditId: string,
  propertyId: string,
  bookingId: string,
  findings: AuditFindings
): Promise<CreateIssuesResult> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { hostId: true, name: true },
  });
  if (!property) throw new Error(`Property ${propertyId} not found`);

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { guestName: true },
  });

  const groups: TrackedFinding[][] = [
    findings.missing as TrackedFinding[],
    findings.damaged as TrackedFinding[],
    findings.lowStock as TrackedFinding[],
    findings.newItems as TrackedFinding[],
  ];

  const issueIds: string[] = [];

  for (const group of groups) {
    for (const finding of group) {
      // Skip if already turned into an issue (idempotency)
      if (finding.issueCreated) continue;
      if (!shouldCreateIssue(finding)) continue;

      const severity =
        finding.severity === 'CRITICAL' ? 'HIGH' :
        finding.severity === 'HIGH' ? 'HIGH' :
        finding.severity === 'MEDIUM' ? 'MEDIUM' : 'LOW';

      const description = [
        `[Checkout Audit] ${finding.type}: ${finding.description}`,
        `Room: ${finding.roomLabel}`,
        booking?.guestName ? `Guest: ${booking.guestName}` : null,
        finding.baselineItem ? `Baseline: ${finding.baselineItem.name} (${finding.baselineItem.condition}, qty: ${finding.baselineItem.quantity})` : null,
        finding.auditItem ? `Audit: ${finding.auditItem.name} (${finding.auditItem.condition}, qty: ${finding.auditItem.quantity})` : null,
      ].filter(Boolean).join('\n');

      const issue = await prisma.issue.create({
        data: {
          propertyId,
          description,
          severity,
          status: 'OPEN',
        },
      });

      issueIds.push(issue.id);
      finding.issueCreated = true;
      finding.generatedIssueId = issue.id;

      // Trigger AI analysis on the issue (fire and forget)
      analyzeIssue(
        { id: issue.id, description, severity, propertyId },
        property.hostId
      ).catch((err: any) => console.error('Audit issue AI analysis failed:', err));
    }
  }

  return { issueIds, updatedFindings: findings };
}
