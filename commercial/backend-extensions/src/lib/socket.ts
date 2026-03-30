import http from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '../../../../backend/src/lib/prisma';
import { sendPushNotification } from '../../../../backend/src/lib/pushNotifications';

let io: Server;

export function getIO(): Server {
  return io;
}

export function setupSocketIO(server: http.Server, allowedOrigins: string[]): Server {
  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // ── /host namespace (JWT auth) ──────────────────────────────────────────────

  const hostNs = io.of('/host');

  hostNs.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required'));

      const secret = process.env.JWT_SECRET;
      if (!secret) return next(new Error('Server configuration error'));

      const payload = jwt.verify(token, secret) as { id: string; role: string; hostId?: string };
      if (payload.role !== 'HOST') return next(new Error('Host role required'));

      const host = await prisma.host.findUnique({ where: { userId: payload.id } });
      if (!host) return next(new Error('Host not found'));

      (socket as any).hostId = host.id;
      (socket as any).userId = payload.id;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  hostNs.on('connection', (socket: Socket) => {
    const hostId = (socket as any).hostId;

    socket.on('join_conversation', (conversationId: string) => {
      socket.join(`conv:${conversationId}`);
    });

    socket.on('leave_conversation', (conversationId: string) => {
      socket.leave(`conv:${conversationId}`);
    });

    socket.on('send_message', async (data: { conversationId: string; content: string; imageUrl?: string }) => {
      try {
        const conversation = await prisma.conversation.findFirst({
          where: { id: data.conversationId, hostId },
          include: { host: true },
        });
        if (!conversation) return;

        const message = await prisma.message.create({
          data: {
            conversationId: data.conversationId,
            senderType: 'HOST',
            senderName: conversation.host.name,
            content: data.content,
            imageUrl: data.imageUrl || null,
            readByHost: true,
            readByGuest: false,
          },
        });

        await prisma.conversation.update({
          where: { id: data.conversationId },
          data: {
            lastMessageAt: message.createdAt,
            lastMessagePreview: data.content.slice(0, 100),
            unreadByGuest: { increment: 1 },
          },
        });

        // Emit to all clients in the conversation room
        hostNs.to(`conv:${data.conversationId}`).emit('new_message', message);
        guestNs.to(`conv:${data.conversationId}`).emit('new_message', message);
      } catch (err) {
        console.error('Host send_message error:', err);
      }
    });

    socket.on('mark_read', async (conversationId: string) => {
      try {
        await prisma.conversation.update({
          where: { id: conversationId, hostId },
          data: { unreadByHost: 0 },
        });
        await prisma.message.updateMany({
          where: { conversationId, readByHost: false },
          data: { readByHost: true },
        });
      } catch (err) {
        console.error('Host mark_read error:', err);
      }
    });

    socket.on('typing', (conversationId: string) => {
      guestNs.to(`conv:${conversationId}`).emit('typing', { senderType: 'HOST' });
    });
  });

  // ── /guest namespace (guestCode auth) ───────────────────────────────────────

  const guestNs = io.of('/guest');

  guestNs.use(async (socket, next) => {
    try {
      const guestCode = socket.handshake.auth.guestCode;
      if (!guestCode) return next(new Error('Guest code required'));

      const booking = await prisma.booking.findUnique({
        where: { guestCode },
        include: { property: { select: { hostId: true } } },
      });
      if (!booking) return next(new Error('Invalid guest code'));

      (socket as any).guestCode = guestCode;
      (socket as any).bookingId = booking.id;
      (socket as any).hostId = booking.property.hostId;
      (socket as any).guestName = booking.guestName;
      next();
    } catch {
      next(new Error('Authentication failed'));
    }
  });

  guestNs.on('connection', (socket: Socket) => {
    const guestCode = (socket as any).guestCode;
    const bookingId = (socket as any).bookingId;

    socket.on('join_conversation', async (conversationId: string) => {
      // Verify guest owns this conversation
      const conv = await prisma.conversation.findFirst({
        where: { id: conversationId, guestCode },
      });
      if (conv) socket.join(`conv:${conversationId}`);
    });

    socket.on('leave_conversation', (conversationId: string) => {
      socket.leave(`conv:${conversationId}`);
    });

    socket.on('send_message', async (data: { conversationId: string; content: string; imageUrl?: string }) => {
      try {
        const guestName = (socket as any).guestName;
        const hostId = (socket as any).hostId;

        // Find or create conversation
        let conversation = await prisma.conversation.findFirst({
          where: { id: data.conversationId, guestCode },
        });
        if (!conversation) return;

        const message = await prisma.message.create({
          data: {
            conversationId: data.conversationId,
            senderType: 'GUEST',
            senderName: guestName,
            content: data.content,
            imageUrl: data.imageUrl || null,
            readByHost: false,
            readByGuest: true,
          },
        });

        await prisma.conversation.update({
          where: { id: data.conversationId },
          data: {
            lastMessageAt: message.createdAt,
            lastMessagePreview: data.content.slice(0, 100),
            unreadByHost: { increment: 1 },
          },
        });

        // Emit to room
        hostNs.to(`conv:${data.conversationId}`).emit('new_message', message);
        guestNs.to(`conv:${data.conversationId}`).emit('new_message', message);

        // Send push notification to host
        const host = await prisma.host.findUnique({
          where: { id: hostId },
          select: { pushToken: true },
        });
        if (host?.pushToken) {
          await sendPushNotification(host.pushToken, {
            title: `Message from ${guestName}`,
            body: data.content.slice(0, 100),
            data: { conversationId: data.conversationId, type: 'guest_message' },
            sound: 'default',
            priority: 'high',
            channelId: 'messages',
          });
        }
      } catch (err) {
        console.error('Guest send_message error:', err);
      }
    });

    socket.on('mark_read', async (conversationId: string) => {
      try {
        await prisma.conversation.update({
          where: { id: conversationId, guestCode },
          data: { unreadByGuest: 0 },
        });
        await prisma.message.updateMany({
          where: { conversationId, readByGuest: false },
          data: { readByGuest: true },
        });
      } catch (err) {
        console.error('Guest mark_read error:', err);
      }
    });

    socket.on('typing', (conversationId: string) => {
      hostNs.to(`conv:${conversationId}`).emit('typing', { senderType: 'GUEST' });
    });
  });

  return io;
}
