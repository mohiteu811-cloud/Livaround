import { Router, Response } from 'express';
import { prisma } from '../../../../backend/src/lib/prisma';
import { authenticate, AuthRequest } from '../../../../backend/src/middleware/auth';
import { requirePlan } from '../../../../backend/src/lib/commercial/enforcement';
import { analyzeMessageAsync } from '../lib/ai-analyzer';
import { translateVoiceAsync } from '../lib/voice-translator';

const router = Router();
router.use(authenticate);
router.use(requirePlan('pro', prisma));

// ── GET /api/internal-conversations ───────────────────────────────────────────
// List internal conversations (HOST sees all their workers' convos, WORKER sees their own)

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const role = req.user!.role;

    if (role === 'HOST') {
      const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
      if (!host) return res.status(403).json({ error: 'Host not found' });

      const conversations = await prisma.conversation.findMany({
        where: {
          hostId: host.id,
          channelType: { in: ['HOST_WORKER', 'SUPERVISOR_WORKER'] },
        },
        orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
        include: {
          worker: {
            select: { id: true, user: { select: { name: true, email: true } } },
          },
          property: { select: { id: true, name: true } },
        },
      });

      return res.json(conversations);
    }

    if (role === 'WORKER') {
      const worker = await prisma.worker.findUnique({ where: { userId: req.user!.id } });
      if (!worker) return res.status(403).json({ error: 'Worker not found' });

      const conversations = await prisma.conversation.findMany({
        where: {
          workerId: worker.id,
          channelType: { in: ['HOST_WORKER', 'SUPERVISOR_WORKER'] },
        },
        orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
        include: {
          host: { select: { id: true, name: true } },
          property: { select: { id: true, name: true } },
        },
      });

      return res.json(conversations);
    }

    return res.status(403).json({ error: 'Unauthorized role' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/internal-conversations ──────────────────────────────────────────
// Create a new internal conversation (or return existing)

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { workerId, propertyId, channelType } = req.body;
    const type = channelType || 'HOST_WORKER';
    if (!['HOST_WORKER', 'SUPERVISOR_WORKER'].includes(type)) {
      return res.status(400).json({ error: 'Invalid channelType' });
    }

    const role = req.user!.role;

    // workerId is required unless a WORKER is creating a HOST_WORKER conversation (they use their own id)
    if (!workerId && !(type === 'HOST_WORKER' && role === 'WORKER')) {
      return res.status(400).json({ error: 'workerId is required' });
    }

    if (type === 'HOST_WORKER' && role === 'HOST') {
      const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
      if (!host) return res.status(403).json({ error: 'Host not found' });

      // Verify host owns this worker
      const worker = await prisma.worker.findFirst({
        where: { id: workerId, hostId: host.id },
        include: { user: { select: { name: true } } },
      });
      if (!worker) return res.status(400).json({ error: 'Worker not found or not owned by you' });

      // Return existing conversation if one exists
      const existing = await prisma.conversation.findFirst({
        where: { hostId: host.id, workerId, channelType: 'HOST_WORKER' },
        include: {
          worker: { select: { id: true, user: { select: { name: true, email: true } } } },
          property: { select: { id: true, name: true } },
        },
      });
      if (existing) return res.json(existing);

      // Create new conversation
      const conversation = await prisma.conversation.create({
        data: {
          channelType: 'HOST_WORKER',
          hostId: host.id,
          workerId,
          propertyId: propertyId || null,
        },
        include: {
          worker: { select: { id: true, user: { select: { name: true, email: true } } } },
          property: { select: { id: true, name: true } },
        },
      });

      return res.status(201).json(conversation);
    }

    if (type === 'SUPERVISOR_WORKER' && role === 'WORKER') {
      const supervisor = await prisma.worker.findUnique({ where: { userId: req.user!.id } });
      if (!supervisor) return res.status(403).json({ error: 'Worker not found' });

      // Verify supervisor has SUPERVISOR role on at least one shared property
      const supervisorProperties = await prisma.propertyStaff.findMany({
        where: { workerId: supervisor.id, role: 'SUPERVISOR' },
        select: { propertyId: true, property: { select: { hostId: true } } },
      });
      if (supervisorProperties.length === 0) {
        return res.status(403).json({ error: 'You are not a supervisor' });
      }

      const supervisorPropertyIds = supervisorProperties.map((sp) => sp.propertyId);

      // Check target worker is on a shared property
      const sharedAssignment = await prisma.propertyStaff.findFirst({
        where: { workerId, propertyId: { in: supervisorPropertyIds } },
      });
      if (!sharedAssignment) {
        return res.status(400).json({ error: 'Worker not assigned to any of your supervised properties' });
      }

      const hostId = supervisorProperties[0].property.hostId;

      // Return existing
      const existing = await prisma.conversation.findFirst({
        where: {
          workerId,
          channelType: 'SUPERVISOR_WORKER',
          // Use hostId to scope — the supervisor's host
        },
        include: {
          worker: { select: { id: true, user: { select: { name: true, email: true } } } },
          property: { select: { id: true, name: true } },
          host: { select: { id: true, name: true } },
        },
      });
      if (existing) return res.json(existing);

      const conversation = await prisma.conversation.create({
        data: {
          channelType: 'SUPERVISOR_WORKER',
          hostId,
          workerId,
          propertyId: sharedAssignment.propertyId,
        },
        include: {
          worker: { select: { id: true, user: { select: { name: true, email: true } } } },
          property: { select: { id: true, name: true } },
          host: { select: { id: true, name: true } },
        },
      });

      return res.status(201).json(conversation);
    }

    // Worker initiating a conversation with their host
    if (type === 'HOST_WORKER' && role === 'WORKER') {
      const worker = await prisma.worker.findUnique({
        where: { userId: req.user!.id },
        include: { user: { select: { name: true } } },
      });
      if (!worker) return res.status(403).json({ error: 'Worker not found' });

      let resolvedHostId = worker.hostId;

      // Fallback: resolve host through property staff assignments
      if (!resolvedHostId) {
        const staffAssignment = await prisma.propertyStaff.findFirst({
          where: { workerId: worker.id },
          select: { property: { select: { hostId: true } } },
        });
        if (staffAssignment?.property?.hostId) {
          resolvedHostId = staffAssignment.property.hostId;
        }
      }

      if (!resolvedHostId) return res.status(400).json({ error: 'Worker has no assigned host' });

      // Return existing conversation if one exists
      const existing = await prisma.conversation.findFirst({
        where: { hostId: resolvedHostId, workerId: worker.id, channelType: 'HOST_WORKER' },
        include: {
          worker: { select: { id: true, user: { select: { name: true, email: true } } } },
          property: { select: { id: true, name: true } },
          host: { select: { id: true, name: true } },
        },
      });
      if (existing) return res.json(existing);

      // Create new conversation
      const conversation = await prisma.conversation.create({
        data: {
          channelType: 'HOST_WORKER',
          hostId: resolvedHostId,
          workerId: worker.id,
          propertyId: propertyId || null,
        },
        include: {
          worker: { select: { id: true, user: { select: { name: true, email: true } } } },
          property: { select: { id: true, name: true } },
          host: { select: { id: true, name: true } },
        },
      });

      return res.status(201).json(conversation);
    }

    return res.status(403).json({ error: 'Unauthorized for this channel type' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/internal-conversations/:id ───────────────────────────────────────
// Get conversation with paginated messages

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const conversation = await getAuthorizedConversation(req);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    const before = req.query.before as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const messages = await prisma.message.findMany({
      where: {
        conversationId: conversation.id,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        aiSuggestion: true,
      },
    });

    return res.json({
      conversation,
      messages: messages.reverse(),
      hasMore: messages.length === limit,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/internal-conversations/:id/messages ─────────────────────────────
// Send a message in an internal conversation

router.post('/:id/messages', async (req: AuthRequest, res: Response) => {
  try {
    const conversation = await getAuthorizedConversation(req);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    const { content, imageUrl, voiceUrl, voiceDuration } = req.body;
    if (!content && !imageUrl && !voiceUrl) return res.status(400).json({ error: 'content, imageUrl, or voiceUrl required' });

    const role = req.user!.role;
    let senderType: string;
    let senderName: string;

    if (role === 'HOST') {
      const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
      senderType = 'HOST';
      senderName = host?.name || 'Host';
    } else {
      // Worker — determine if they're supervisor in this context
      const worker = await prisma.worker.findUnique({
        where: { userId: req.user!.id },
        include: { user: { select: { name: true } } },
      });
      if (conversation.channelType === 'SUPERVISOR_WORKER' && role === 'WORKER') {
        // Check if sender is the supervisor (not the worker) in this conversation
        const isSupervisor = await prisma.propertyStaff.findFirst({
          where: { workerId: worker!.id, role: 'SUPERVISOR' },
        });
        senderType = isSupervisor ? 'SUPERVISOR' : 'WORKER';
      } else {
        senderType = 'WORKER';
      }
      senderName = worker?.user?.name || 'Worker';
    }

    const isHost = senderType === 'HOST';
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderType,
        senderName,
        content: content || '',
        imageUrl: imageUrl || null,
        voiceUrl: voiceUrl || null,
        voiceDuration: voiceDuration || null,
        readByHost: isHost,
        readByWorker: !isHost,
      },
    });

    // Update conversation metadata
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: message.createdAt,
        lastMessagePreview: (content || 'Image').slice(0, 100),
        ...(isHost
          ? { unreadByWorker: { increment: 1 } }
          : { unreadByHost: { increment: 1 } }),
      },
    });

    // Emit via Socket.IO
    const io = req.app.locals.io;
    if (io) {
      io.of('/host').to(`conv:${conversation.id}`).emit('new_message', message);
      io.of('/worker').to(`conv:${conversation.id}`).emit('new_message', message);
    }

    // Send push notification to the other party
    if (isHost && conversation.workerId) {
      const worker = await prisma.worker.findUnique({
        where: { id: conversation.workerId },
        select: { pushToken: true },
      });
      if (worker?.pushToken) {
        const { sendPushNotification } = require('../../../../backend/src/lib/pushNotifications');
        await sendPushNotification(worker.pushToken, {
          title: `Message from ${senderName}`,
          body: (content || 'Sent an image').slice(0, 100),
          data: { conversationId: conversation.id, type: 'internal_message' },
          sound: 'default',
          priority: 'high',
          channelId: 'messages',
        });
      }
    } else if (!isHost) {
      const host = await prisma.host.findUnique({
        where: { id: conversation.hostId },
        select: { pushToken: true },
      });
      if (host?.pushToken) {
        const { sendPushNotification } = require('../../../../backend/src/lib/pushNotifications');
        await sendPushNotification(host.pushToken, {
          title: `Message from ${senderName}`,
          body: (content || 'Sent an image').slice(0, 100),
          data: { conversationId: conversation.id, type: 'internal_message' },
          sound: 'default',
          priority: 'high',
          channelId: 'messages',
        });
      }
    }

    // Trigger AI analysis (non-blocking)
    analyzeMessageAsync(message, conversation).catch((err) =>
      console.error('AI analysis failed:', err)
    );

    // Trigger voice translation if voice message (non-blocking)
    if (voiceUrl) {
      try {
        translateVoiceAsync(message, io);
      } catch (err) {
        console.error('Voice translation failed:', err);
      }
    }

    return res.status(201).json(message);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /api/internal-conversations/:id/read ────────────────────────────────

router.patch('/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    const conversation = await getAuthorizedConversation(req);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    const role = req.user!.role;
    const isHost = role === 'HOST';

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: isHost ? { unreadByHost: 0 } : { unreadByWorker: 0 },
    });

    await prisma.message.updateMany({
      where: { conversationId: conversation.id, ...(isHost ? { readByHost: false } : { readByWorker: false }) },
      data: isHost ? { readByHost: true } : { readByWorker: true },
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Helper: authorize conversation access ─────────────────────────────────────

async function getAuthorizedConversation(req: AuthRequest) {
  const role = req.user!.role;
  const conversationId = req.params.id;

  if (role === 'HOST') {
    const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
    if (!host) return null;
    return prisma.conversation.findFirst({
      where: {
        id: conversationId,
        hostId: host.id,
        channelType: { in: ['HOST_WORKER', 'SUPERVISOR_WORKER'] },
      },
      include: {
        worker: { select: { id: true, user: { select: { name: true } } } },
        property: { select: { id: true, name: true } },
        host: { select: { id: true, name: true } },
      },
    });
  }

  if (role === 'WORKER') {
    const worker = await prisma.worker.findUnique({ where: { userId: req.user!.id } });
    if (!worker) return null;
    return prisma.conversation.findFirst({
      where: {
        id: conversationId,
        workerId: worker.id,
        channelType: { in: ['HOST_WORKER', 'SUPERVISOR_WORKER'] },
      },
      include: {
        worker: { select: { id: true, user: { select: { name: true } } } },
        property: { select: { id: true, name: true } },
        host: { select: { id: true, name: true } },
      },
    });
  }

  return null;
}

export default router;
