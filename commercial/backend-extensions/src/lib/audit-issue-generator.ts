import { prisma } from '../../../../backend/src/lib/prisma';
import { analyzeIssue } from './ai-analyzer';
import { getIO } from './socket';
import type { AuditFinding, AuditFindings } from './inventory-comparator';

// ── Escalation thresholds ────────────────────────────────────────────────────

// Findings that auto-generate Issue records
function shouldCreateIssue(finding: AuditFinding): boolean {
  if (finding.dismissed) return false;

  switch (finding.type) {
    case 'MISSING':
      // Missing high-value items always escalate
      if (finding.severity === 'CRITICAL' || finding.severity === 'HIGH') return true;
      // Missing non-consumables escalate
      if (finding.category !== 'CONSUMABLE' && finding.category !== 'LINEN') return true;
      return false;

    case 'DAMAGED':
      // Significant damage always escalates
      if (finding.severity === 'CRITICAL' || finding.severity === 'HIGH') return true;
      // Condition went from GOOD → DAMAGED on any category
      if (finding.baselineItem?.condition === 'GOOD' &&
          finding.auditItem?.condition === 'DAMAGED') return true;
      return false;

    case 'LOW_STOCK':
      // Low stock consumables: no issue, just restock report
      return false;

    case 'NEW_ITEM':
      // New items: informational, no issue needed
      return false;

    default:
      return false;
  }
}

// Findings that send push notification to host
function shouldEscalateToHost(finding: AuditFinding): boolean {
  return finding.severity === 'CRITICAL' ||
    (finding.type === 'MISSING' && finding.severity === 'HIGH') ||
    (finding.type === 'DAMAGED' && finding.severity === 'HIGH');
}

// ── Main generator ───────────────────────────────────────────────────────────

export interface GeneratedIssues {
  issueIds: string[];
  escalatedCount: number;
}

export async function generateAuditIssues(
  auditId: string,
  propertyId: string,
  bookingId: string,
  findings: AuditFindings
): Promise<GeneratedIssues> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { hostId: true, name: true },
  });
  if (!property) throw new Error(`Property ${propertyId} not found`);

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { guestName: true },
  });

  const allFindings = [
    ...findings.missing,
    ...findings.damaged,
    ...findings.lowStock,
    ...findings.newItems,
  ];

  const issueIds: string[] = [];
  let escalatedCount = 0;

  for (const finding of allFindings) {
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

    // Trigger AI analysis on the issue (reuse existing pattern)
    analyzeIssue(
      { id: issue.id, description, severity, propertyId },
      property.hostId
    ).catch((err: any) => console.error('Audit issue AI analysis failed:', err));

    if (shouldEscalateToHost(finding)) {
      escalatedCount++;
    }
  }

  // Send push notification if there are escalated findings
  if (escalatedCount > 0) {
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
          title: `Checkout Audit: ${allFindings.filter(f => shouldCreateIssue(f)).length} issues found`,
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
      issueCount: issueIds.length,
    });
  }

  return { issueIds, escalatedCount };
}
