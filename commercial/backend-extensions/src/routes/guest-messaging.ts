import { Router, Request, Response } from 'express';
import { prisma } from '../../../../backend/src/lib/prisma';
import { sendPushNotification } from '../../../../backend/src/lib/pushNotifications';
import { IS_COMMERCIAL } from '../../../../backend/src/lib/config';
import { analyzeMessageAsync } from '../lib/ai-analyzer';

const router = Router();

// Rate limiting: 10 messages per minute per guestCode
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(guestCode: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(guestCode);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(guestCode, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

// ── GET /api/stay/:code/messages ──────────────────────────────────────────────
// Guest fetches messages for their booking's conversation

router.get('/:code/messages', async (req: Request, res: Response) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { guestCode: req.params.code },
      include: { property: { select: { hostId: true, host: { select: { organizationId: true } } } } },
    });
    if (!booking) return res.status(404).json({ error: 'Stay not found' });

    // Check if messaging is enabled for this host's plan
    if (IS_COMMERCIAL) {
      const orgId = booking.property.host.organizationId;
      if (!orgId) return res.status(403).json({ error: 'Messaging requires a Pro subscription' });

      const subscription = await prisma.subscription.findUnique({
        where: { organizationId: orgId },
        include: { plan: true },
      });
      const features = (subscription?.plan.features ?? {}) as Record<string, boolean>;
      if (!features.messaging) return res.status(403).json({ error: 'Messaging requires a Pro subscription' });
    }

    const conversation = await prisma.conversation.findFirst({
      where: { bookingId: booking.id },
    });

    if (!conversation) {
      return res.json({ conversation: null, messages: [], hasMore: false });
    }

    const before = req.query.before as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const messages = await prisma.message.findMany({
      where: {
        conversationId: conversation.id,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return res.json({
      conversation: {
        id: conversation.id,
        unreadByGuest: conversation.unreadByGuest,
      },
      messages: messages.reverse(),
      hasMore: messages.length === limit,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/stay/:code/messages ─────────────────────────────────────────────
// Guest sends a message (creates conversation on first message)

router.post('/:code/messages', async (req: Request, res: Response) => {
  try {
    const { content, imageUrl } = req.body;
    if (!content && !imageUrl) return res.status(400).json({ error: 'content or imageUrl required' });

    // Sanitize content
    const sanitizedContent = (content || '').replace(/<[^>]*>/g, '').slice(0, 2000);

    if (!checkRateLimit(req.params.code)) {
      return res.status(429).json({ error: 'Too many messages. Please wait a moment.' });
    }

    const booking = await prisma.booking.findUnique({
      where: { guestCode: req.params.code },
      include: {
        property: {
          select: {
            hostId: true,
            name: true,
            host: { select: { id: true, name: true, pushToken: true, organizationId: true } },
          },
        },
      },
    });
    if (!booking) return res.status(404).json({ error: 'Stay not found' });

    // Check if messaging is enabled for this host's plan
    if (IS_COMMERCIAL) {
      const orgId = booking.property.host.organizationId;
      if (!orgId) return res.status(403).json({ error: 'Messaging requires a Pro subscription' });

      const subscription = await prisma.subscription.findUnique({
        where: { organizationId: orgId },
        include: { plan: true },
      });
      const features = (subscription?.plan.features ?? {}) as Record<string, boolean>;
      if (!features.messaging) return res.status(403).json({ error: 'Messaging requires a Pro subscription' });
    }

    // Find or create conversation
    let conversation = await prisma.conversation.findFirst({
      where: { bookingId: booking.id },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          bookingId: booking.id,
          hostId: booking.property.hostId,
          guestName: booking.guestName,
          guestCode: req.params.code,
        },
      });
    }

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderType: 'GUEST',
        senderName: booking.guestName,
        content: sanitizedContent,
        imageUrl: imageUrl || null,
        readByHost: false,
        readByGuest: true,
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: message.createdAt,
        lastMessagePreview: sanitizedContent.slice(0, 100) || 'Image',
        unreadByHost: { increment: 1 },
      },
    });

    // Emit via Socket.IO if available
    const io = req.app.locals.io;
    if (io) {
      io.of('/host').to(`conv:${conversation.id}`).emit('new_message', message);
      io.of('/guest').to(`conv:${conversation.id}`).emit('new_message', message);
    }

    // Send push notification to host
    if (booking.property.host.pushToken) {
      await sendPushNotification(booking.property.host.pushToken, {
        title: `Message from ${booking.guestName}`,
        body: sanitizedContent.slice(0, 100) || 'Sent an image',
        data: { conversationId: conversation.id, type: 'guest_message' },
        sound: 'default',
        priority: 'high',
        channelId: 'messages',
      });
    }

    // Trigger AI analysis (non-blocking)
    analyzeMessageAsync(message, conversation).catch((err) =>
      console.error('AI analysis failed:', err)
    );

    return res.status(201).json({ message, conversationId: conversation.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /api/stay/:code/messages/read ───────────────────────────────────────
// Guest marks all messages as read

router.patch('/:code/messages/read', async (req: Request, res: Response) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { guestCode: req.params.code },
      select: { id: true },
    });
    if (!booking) return res.status(404).json({ error: 'Stay not found' });

    const conversation = await prisma.conversation.findFirst({
      where: { bookingId: booking.id },
    });
    if (!conversation) return res.status(404).json({ error: 'No conversation found' });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { unreadByGuest: 0 },
    });
    await prisma.message.updateMany({
      where: { conversationId: conversation.id, readByGuest: false },
      data: { readByGuest: true },
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
