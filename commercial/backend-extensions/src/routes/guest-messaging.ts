import { Router, Request, Response } from 'express';
import { prisma } from '../../../../backend/src/lib/prisma';
import { sendPushNotification } from '../../../../backend/src/lib/pushNotifications';
import { IS_COMMERCIAL } from '../../../../backend/src/lib/config';
import { analyzeMessageAsync } from '../lib/ai-analyzer';
import { translateVoiceAsync } from '../lib/voice-translator';

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
        visibility: 'ALL', // Guests never see TEAM_ONLY messages
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        conversationId: true,
        senderType: true,
        senderName: true,
        content: true,
        imageUrl: true,
        voiceUrl: true,
        voiceDuration: true,
        voiceTranscript: true,
        voiceTranslation: true,
        voiceLanguage: true,
        readByHost: true,
        readByGuest: true,
        createdAt: true,
        updatedAt: true,
      },
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
    const { content, imageUrl, voiceUrl, voiceDuration } = req.body;
    if (!content && !imageUrl && !voiceUrl) return res.status(400).json({ error: 'content, imageUrl, or voiceUrl required' });

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
            host: { select: { id: true, name: true, pushToken: true, organizationId: true, notificationPrefs: true } },
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
        voiceUrl: voiceUrl || null,
        voiceDuration: voiceDuration || null,
        readByHost: false,
        readByGuest: true,
      },
    });

    const updateData: any = {
      lastMessageAt: message.createdAt,
      lastMessagePreview: (sanitizedContent || (voiceUrl ? 'Voice message' : 'Image')).slice(0, 100),
      unreadByHost: { increment: 1 },
      unreadByWorker: { increment: 1 }, // 3-way: notify assigned workers
    };

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: updateData,
    });

    // Emit via Socket.IO if available
    const io = req.app.locals.io;
    if (io) {
      io.of('/host').to(`conv:${conversation.id}`).emit('new_message', message);
      io.of('/guest').to(`conv:${conversation.id}`).emit('new_message', message);
      io.of('/worker').to(`conv:${conversation.id}`).emit('new_message', message); // 3-way: workers see guest messages
    }

    // Send push notification to host (respects notification prefs)
    const hostPrefs = (() => { try { return JSON.parse(booking.property.host.notificationPrefs || '{}'); } catch { return {}; } })();
    if (booking.property.host.pushToken && hostPrefs.guestMessages !== false) {
      await sendPushNotification(booking.property.host.pushToken, {
        title: `Message from ${booking.guestName}`,
        body: (sanitizedContent || (voiceUrl ? 'Voice message' : 'Sent an image')).slice(0, 100),
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

    // Trigger voice translation if voice message (non-blocking)
    if (voiceUrl) {
      try {
        translateVoiceAsync(message, io);
      } catch (err) {
        console.error('Voice translation failed:', err);
      }
    }

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
