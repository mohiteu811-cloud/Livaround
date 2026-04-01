import { prisma } from '../../../../backend/src/lib/prisma';

interface ActionPayload {
  issueData?: {
    description: string;
    severity: string;
    photoUrl?: string;
  };
  jobData?: {
    type: string;
    propertyId: string;
    notes: string;
  };
  dispatchData?: {
    suggestedRole: string;
    reason: string;
  };
  tradesmanData?: {
    suggestedTrade: string;
    reason: string;
  };
}

export async function executeAction(
  suggestionId: string,
  overrides?: { suggestedReply?: string; actionPayload?: ActionPayload }
) {
  const suggestion = await prisma.aiSuggestion.findUnique({
    where: { id: suggestionId },
    include: {
      conversation: {
        include: {
          booking: { select: { id: true } },
        },
      },
      message: true,
      issue: { select: { id: true, propertyId: true, description: true, photoUrl: true } },
    },
  });

  if (!suggestion || suggestion.status !== 'PENDING') {
    throw new Error('Suggestion not found or already processed');
  }

  const payload = (overrides?.actionPayload || suggestion.actionPayload || {}) as ActionPayload;
  const action = suggestion.suggestedAction;
  let createdIssueId: string | undefined;
  let createdJobId: string | undefined;

  // Derive propertyId from conversation or issue
  const propertyId = payload.jobData?.propertyId
    || suggestion.conversation?.propertyId
    || suggestion.issue?.propertyId
    || undefined;

  if (action === 'CREATE_ISSUE' || action === 'CREATE_JOB' || action === 'DISPATCH_WORKER' || action === 'CALL_TRADESMAN') {
    // Create issue if issueData is provided (only for conversation-based suggestions)
    if (payload.issueData) {
      const issue = await prisma.issue.create({
        data: {
          propertyId: propertyId || undefined,
          description: payload.issueData.description || suggestion.summary,
          severity: payload.issueData.severity || 'MEDIUM',
          photoUrl: payload.issueData.photoUrl || suggestion.message?.imageUrl || undefined,
          status: 'OPEN',
        },
      });
      createdIssueId = issue.id;
    }

    // Create job if jobData is provided or if dispatching
    if (payload.jobData && propertyId) {
      const job = await prisma.job.create({
        data: {
          propertyId,
          bookingId: suggestion.conversation?.booking?.id || undefined,
          type: payload.jobData.type || 'MAINTENANCE',
          status: 'PENDING',
          scheduledAt: new Date(),
          notes: payload.jobData.notes || suggestion.summary,
        },
      });
      createdJobId = job.id;

      // Check host's auto-dispatch preference
      const hostId = suggestion.conversation?.hostId
        || (suggestion.issue?.propertyId
          ? (await prisma.property.findUnique({ where: { id: suggestion.issue.propertyId }, select: { hostId: true } }))?.hostId
          : undefined);

      const host = hostId
        ? await prisma.host.findUnique({ where: { id: hostId }, select: { autoDispatch: true } })
        : null;
      const shouldAutoDispatch = host?.autoDispatch !== false; // default true

      // Auto-dispatch if DISPATCH_WORKER and autoDispatch is enabled
      if ((action === 'DISPATCH_WORKER' || action === 'CALL_TRADESMAN') && shouldAutoDispatch) {
        const roleFilter = payload.dispatchData?.suggestedRole;
        const availableWorker = await prisma.propertyStaff.findFirst({
          where: {
            propertyId,
            ...(roleFilter ? { role: roleFilter } : {}),
          },
          include: { worker: { select: { id: true, isAvailable: true, pushToken: true } } },
        });

        if (availableWorker?.worker.isAvailable) {
          await prisma.job.update({
            where: { id: job.id },
            data: { workerId: availableWorker.worker.id, status: 'DISPATCHED' },
          });

          // Send push to worker
          if (availableWorker.worker.pushToken) {
            try {
              const { sendPushNotification } = require('../../../../backend/src/lib/pushNotifications');
              await sendPushNotification(availableWorker.worker.pushToken, {
                title: 'New Job Assigned',
                body: payload.jobData.notes || suggestion.summary,
                data: { jobId: job.id, type: 'job_dispatched' },
                sound: 'default',
                priority: 'high',
                channelId: 'jobs',
              });
            } catch {}
          }
        }
      }

      // Link job back to the issue if this was an issue-based suggestion
      if (suggestion.issueId) {
        await prisma.issue.update({
          where: { id: suggestion.issueId },
          data: { jobId: job.id, status: 'IN_REVIEW' },
        });
      }
    }
  }

  // Send suggested reply if action is AUTO_REPLY (only for conversation-based suggestions)
  const replyText = overrides?.suggestedReply || suggestion.suggestedReply;
  if (action === 'AUTO_REPLY' && replyText && suggestion.conversationId) {
    await prisma.message.create({
      data: {
        conversationId: suggestion.conversationId,
        senderType: 'HOST',
        senderName: 'Host (AI-assisted)',
        content: replyText,
        readByHost: true,
        readByGuest: false,
        readByWorker: false,
      },
    });

    await prisma.conversation.update({
      where: { id: suggestion.conversationId },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: replyText.slice(0, 100),
        unreadByGuest: { increment: 1 },
      },
    });
  }

  // Update suggestion status
  await prisma.aiSuggestion.update({
    where: { id: suggestionId },
    data: {
      status: 'APPROVED',
      createdIssueId,
      createdJobId,
    },
  });

  return { createdIssueId, createdJobId };
}

export async function dismissSuggestion(suggestionId: string) {
  await prisma.aiSuggestion.update({
    where: { id: suggestionId },
    data: { status: 'DISMISSED' },
  });
}
