import { Router, Response } from 'express';
import { prisma } from '../../../../backend/src/lib/prisma';
import { authenticate, AuthRequest } from '../../../../backend/src/middleware/auth';
import { requirePlan } from '../../../../backend/src/lib/commercial/enforcement';
import { translateVoiceAsync } from '../lib/voice-translator';
import { analyzeMessageAsync } from '../lib/ai-analyzer';

const router = Router();
router.use(authenticate);
router.use(requirePlan('pro', prisma));

// ── GET /api/conversations ────────────────────────────────────────────────────
// List host's conversations sorted by lastMessageAt

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
    if (!host) return res.status(403).json({ error: 'Host not found' });

    const conversations = await prisma.conversation.findMany({
      where: { hostId: host.id, channelType: 'GUEST_HOST' },
      orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
      include: {
        booking: {
          select: {
            id: true,
            checkIn: true,
            checkOut: true,
            status: true,
            property: { select: { id: true, name: true } },
          },
        },
      },
    });

    return res.json(conversations);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/conversations/worker-guest ───────────────────────────────────────
// Worker's guest conversations (must be before /:id to avoid route conflict)

router.get('/worker-guest', async (req: any, res: Response) => {
  try {
    const user = req.user;
    if (user.role !== 'WORKER') return res.status(403).json({ error: 'Workers only' });

    const worker = await prisma.worker.findUnique({ where: { userId: user.id } });
    if (!worker) return res.status(404).json({ error: 'Worker not found' });

    // Get properties worker is assigned to
    const assignments = await prisma.propertyStaff.findMany({
      where: { workerId: worker.id },
      select: { propertyId: true },
    });
    const propertyIds = assignments.map((a: any) => a.propertyId);

    const now = new Date();
    const bufferDays = 3;
    const bufferMs = bufferDays * 24 * 60 * 60 * 1000;

    const conversations = await prisma.conversation.findMany({
      where: {
        channelType: 'GUEST_HOST',
        booking: {
          propertyId: { in: propertyIds },
          checkIn: { lte: new Date(now.getTime() + bufferMs) },
          checkOut: { gte: new Date(now.getTime() - bufferMs) },
          status: { in: ['CONFIRMED', 'CHECKED_IN'] },
        },
      },
      include: {
        booking: { include: { property: { select: { id: true, name: true } } } },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    return res.json(conversations);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/conversations/:id ────────────────────────────────────────────────
// Get conversation with paginated messages

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
    if (!host) {
      // Check if user is a worker (handles users whose JWT role may differ)
      const worker = await prisma.worker.findUnique({ where: { userId: req.user!.id } });
      if (!worker) return res.status(403).json({ error: 'Host not found' });

      // Worker access: check if assigned to the property
      const conv = await prisma.conversation.findFirst({
        where: { id: req.params.id },
        include: {
          booking: {
            select: {
              id: true, guestName: true, guestEmail: true, guestPhone: true,
              checkIn: true, checkOut: true, status: true, propertyId: true,
              property: { select: { id: true, name: true } },
            },
          },
        },
      });
      if (conv?.booking) {
        const assigned = await prisma.propertyStaff.findFirst({
          where: { workerId: worker.id, propertyId: conv.booking.propertyId },
        });
        if (assigned) {
          const before = req.query.before as string | undefined;
          const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
          const messages = await prisma.message.findMany({
            where: {
              conversationId: conv.id,
              ...(before ? { createdAt: { lt: new Date(before) } } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
          });
          return res.json({ conversation: conv, messages: messages.reverse(), hasMore: messages.length === limit });
        }
      }
      return res.status(404).json({ error: 'Conversation not found' });
    }

    let conversation: any = await prisma.conversation.findFirst({
      where: { id: req.params.id, hostId: host.id },
      include: {
        booking: {
          select: {
            id: true,
            guestName: true,
            guestEmail: true,
            guestPhone: true,
            checkIn: true,
            checkOut: true,
            status: true,
            property: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Also allow worker access if assigned to the property
    if (!conversation && req.user!.role === 'WORKER') {
      const worker = await prisma.worker.findUnique({ where: { userId: req.user!.id } });
      if (worker) {
        const conv = await prisma.conversation.findFirst({
          where: { id: req.params.id },
          include: {
            booking: {
              select: {
                id: true,
                guestName: true,
                guestEmail: true,
                guestPhone: true,
                checkIn: true,
                checkOut: true,
                status: true,
                propertyId: true,
                property: { select: { id: true, name: true } },
              },
            },
          },
        });
        if (conv?.booking) {
          const assigned = await prisma.propertyStaff.findFirst({
            where: { workerId: worker.id, propertyId: conv.booking.propertyId },
          });
          if (assigned) conversation = conv;
        }
      }
    }

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
      include: { aiSuggestion: true },
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

// ── POST /api/conversations/:id/messages ──────────────────────────────────────
// Host sends a message (REST fallback for when Socket.IO is unavailable)

router.post('/:id/messages', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    let conversation: any = null;
    let senderType = 'HOST';
    let senderName = '';

    if (user.role === 'HOST') {
      const host = await prisma.host.findUnique({ where: { userId: user.id } });
      if (!host) return res.status(403).json({ error: 'Host not found' });

      conversation = await prisma.conversation.findFirst({
        where: { id: req.params.id, hostId: host.id },
      });
      senderType = 'HOST';
      senderName = host.name;
    }

    // Allow worker access if assigned to the property
    if (!conversation && user.role === 'WORKER') {
      const worker = await prisma.worker.findUnique({
        where: { userId: user.id },
        include: { user: { select: { name: true } } },
      });
      if (worker) {
        const conv = await prisma.conversation.findFirst({
          where: { id: req.params.id },
          include: { booking: true },
        });
        if (conv?.booking) {
          const assigned = await prisma.propertyStaff.findFirst({
            where: { workerId: worker.id, propertyId: conv.booking.propertyId },
          });
          if (assigned) {
            conversation = conv;
            senderType = 'WORKER';
            senderName = worker.user?.name || 'Worker';
          }
        }
      }
    }

    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    const { content, imageUrl, voiceUrl, voiceDuration, visibility: rawVisibility } = req.body;
    if (!content && !imageUrl && !voiceUrl) return res.status(400).json({ error: 'content, imageUrl, or voiceUrl required' });

    const visibility = rawVisibility === 'TEAM_ONLY' ? 'TEAM_ONLY' : 'ALL';
    const isWorker = senderType === 'WORKER';
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderType,
        senderName,
        content: content || '',
        imageUrl: imageUrl || null,
        voiceUrl: voiceUrl || null,
        voiceDuration: voiceDuration || null,
        visibility,
        readByHost: !isWorker,
        readByGuest: false,
      },
    });

    // Build unread updates — TEAM_ONLY messages don't increment guest unread
    const unreadUpdates: Record<string, any> = {};
    if (isWorker) {
      unreadUpdates.unreadByHost = { increment: 1 };
      if (visibility === 'ALL') unreadUpdates.unreadByGuest = { increment: 1 };
    } else {
      if (visibility === 'ALL') unreadUpdates.unreadByGuest = { increment: 1 };
      // Only notify worker if looped in
      if (conversation.workerId) {
        unreadUpdates.unreadByWorker = { increment: 1 };
      }
    }

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: message.createdAt,
        lastMessagePreview: (content || (voiceUrl ? 'Voice message' : 'Image')).slice(0, 100),
        ...unreadUpdates,
      },
    });

    // Emit via Socket.IO if available
    const io = req.app.locals.io;
    if (io) {
      io.of('/host').to(`conv:${conversation.id}`).emit('new_message', message);
      // Only emit to guest if message is visible to all
      if (visibility === 'ALL') {
        io.of('/guest').to(`conv:${conversation.id}`).emit('new_message', message);
      }
      // Only broadcast to workers if looped in
      if (conversation.workerId) {
        io.of('/worker').to(`conv:${conversation.id}`).emit('new_message', message);
      }
    }

    // Trigger voice translation if voice message (non-blocking)
    if (voiceUrl) {
      try {
        translateVoiceAsync(message, io);
      } catch (err) {
        console.error('Voice translation failed:', err);
      }
    }

    // Trigger AI analysis (non-blocking)
    analyzeMessageAsync(message, conversation).catch((err) =>
      console.error('AI analysis failed:', err)
    );

    return res.status(201).json(message);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /api/conversations/:id/read ─────────────────────────────────────────
// Mark all messages as read by host

router.patch('/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;

    if (user.role === 'WORKER') {
      // Worker marking messages as read
      const worker = await prisma.worker.findUnique({ where: { userId: user.id } });
      if (!worker) return res.status(403).json({ error: 'Worker not found' });

      const conv = await prisma.conversation.findFirst({
        where: { id: req.params.id },
        include: { booking: true },
      });
      if (!conv?.booking) return res.status(404).json({ error: 'Conversation not found' });

      const assigned = await prisma.propertyStaff.findFirst({
        where: { workerId: worker.id, propertyId: conv.booking.propertyId },
      });
      if (!assigned) return res.status(404).json({ error: 'Conversation not found' });

      await prisma.conversation.update({
        where: { id: conv.id },
        data: { unreadByWorker: 0 },
      });

      await prisma.message.updateMany({
        where: { conversationId: conv.id, readByWorker: false },
        data: { readByWorker: true },
      });

      return res.json({ ok: true });
    }

    // Host marking messages as read (existing behavior)
    const host = await prisma.host.findUnique({ where: { userId: user.id } });
    if (!host) return res.status(403).json({ error: 'Host not found' });

    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, hostId: host.id },
    });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { unreadByHost: 0 },
    });

    await prisma.message.updateMany({
      where: { conversationId: conversation.id, readByHost: false },
      data: { readByHost: true },
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /api/conversations/:id/loop-in-worker ─────────────────────────────
// Host loops a worker into a GUEST_HOST conversation

router.patch('/:id/loop-in-worker', async (req: AuthRequest, res: Response) => {
  try {
    const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
    if (!host) return res.status(403).json({ error: 'Host not found' });

    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, hostId: host.id, channelType: 'GUEST_HOST' },
      include: { booking: { select: { propertyId: true } } },
    });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    const { workerId } = req.body;
    if (!workerId) return res.status(400).json({ error: 'workerId required' });

    // Verify worker is assigned to this property
    if (conversation.booking?.propertyId) {
      const staff = await prisma.propertyStaff.findFirst({
        where: { workerId, propertyId: conversation.booking.propertyId },
      });
      if (!staff) return res.status(403).json({ error: 'Worker not assigned to this property' });
    }

    const updated = await prisma.conversation.update({
      where: { id: conversation.id },
      data: { workerId },
      include: {
        worker: { include: { user: { select: { name: true } } } },
        booking: { select: { id: true, property: { select: { id: true, name: true } } } },
      },
    });

    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
