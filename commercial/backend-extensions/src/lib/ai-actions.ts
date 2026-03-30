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
    },
  });

  if (!suggestion || suggestion.status !== 'PENDING') {
    throw new Error('Suggestion not found or already processed');
  }

  const payload = (overrides?.actionPayload || suggestion.actionPayload || {}) as ActionPayload;
  const action = suggestion.suggestedAction;
  let createdIssueId: string | undefined;
  let createdJobId: string | undefined;

  if (action === 'CREATE_ISSUE' || action === 'CREATE_JOB' || action === 'DISPATCH_WORKER') {
    // Create issue if issueData is provided
    if (payload.issueData) {
      const propertyId = payload.jobData?.propertyId || suggestion.conversation.propertyId;
      const issue = await prisma.issue.create({
        data: {
          propertyId: propertyId || undefined,
          jobId: undefined,
          description: payload.issueData.description || suggestion.summary,
          severity: payload.issueData.severity || 'MEDIUM',
          photoUrl: payload.issueData.photoUrl || suggestion.message.imageUrl || undefined,
          status: 'OPEN',
        },
      });
      createdIssueId = issue.id;
    }

    // Create job if jobData is provided
    if (payload.jobData && payload.jobData.propertyId) {
      const job = await prisma.job.create({
        data: {
          propertyId: payload.jobData.propertyId,
          bookingId: suggestion.conversation.booking?.id || undefined,
          type: payload.jobData.type || 'MAINTENANCE',
          status: 'PENDING',
          scheduledAt: new Date(),
          notes: payload.jobData.notes || suggestion.summary,
        },
      });
      createdJobId = job.id;

      // Auto-dispatch if DISPATCH_WORKER
      if (action === 'DISPATCH_WORKER') {
        const availableWorker = await prisma.propertyStaff.findFirst({
          where: { propertyId: payload.jobData.propertyId },
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
    }
  }

  // Send suggested reply if action is AUTO_REPLY or if reply was provided
  const replyText = overrides?.suggestedReply || suggestion.suggestedReply;
  if (action === 'AUTO_REPLY' && replyText) {
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
