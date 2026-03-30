import { Router, Response } from 'express';
import { prisma } from '../../../../backend/src/lib/prisma';
import { authenticate, AuthRequest } from '../../../../backend/src/middleware/auth';
import { requirePlan } from '../../../../backend/src/lib/commercial/enforcement';

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
      where: { hostId: host.id },
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

// ── GET /api/conversations/:id ────────────────────────────────────────────────
// Get conversation with paginated messages

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
    if (!host) return res.status(403).json({ error: 'Host not found' });

    const conversation = await prisma.conversation.findFirst({
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
    const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
    if (!host) return res.status(403).json({ error: 'Host not found' });

    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, hostId: host.id },
    });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    const { content, imageUrl } = req.body;
    if (!content && !imageUrl) return res.status(400).json({ error: 'content or imageUrl required' });

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderType: 'HOST',
        senderName: host.name,
        content: content || '',
        imageUrl: imageUrl || null,
        readByHost: true,
        readByGuest: false,
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: message.createdAt,
        lastMessagePreview: (content || 'Image').slice(0, 100),
        unreadByGuest: { increment: 1 },
      },
    });

    // Emit via Socket.IO if available
    const io = req.app.locals.io;
    if (io) {
      io.of('/host').to(`conv:${conversation.id}`).emit('new_message', message);
      io.of('/guest').to(`conv:${conversation.id}`).emit('new_message', message);
    }

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
    const host = await prisma.host.findUnique({ where: { userId: req.user!.id } });
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

export default router;
