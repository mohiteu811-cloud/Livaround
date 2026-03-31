import http from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '../../../../backend/src/lib/prisma';
import { sendPushNotification } from '../../../../backend/src/lib/pushNotifications';
import { translateVoiceAsync } from './voice-translator';

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

    socket.on('send_message', async (data: { conversationId: string; content: string; imageUrl?: string; voiceUrl?: string; voiceDuration?: number }) => {
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
            voiceUrl: data.voiceUrl || null,
            voiceDuration: data.voiceDuration || null,
            readByHost: true,
            readByGuest: false,
          },
        });

        const updateData: any = {
          lastMessageAt: message.createdAt,
          lastMessagePreview: data.content.slice(0, 100),
          unreadByGuest: { increment: 1 },
        };

        // If GUEST_HOST conversation, also increment unreadByWorker
        if (conversation.channelType === 'GUEST_HOST') {
          updateData.unreadByWorker = { increment: 1 };
        }

        await prisma.conversation.update({
          where: { id: data.conversationId },
          data: updateData,
        });

        // Emit to all clients in the conversation room
        hostNs.to(`conv:${data.conversationId}`).emit('new_message', message);
        guestNs.to(`conv:${data.conversationId}`).emit('new_message', message);

        // If GUEST_HOST conversation, also broadcast to workers
        if (conversation.channelType === 'GUEST_HOST') {
          workerNs.to(`conv:${data.conversationId}`).emit('new_message', message);
        }

        // Trigger voice translation if voice message
        if (data.voiceUrl) {
          try {
            translateVoiceAsync(message, io);
          } catch (err) {
            console.error('Voice translation trigger failed:', err);
          }
        }
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

    socket.on('send_message', async (data: { conversationId: string; content: string; imageUrl?: string; voiceUrl?: string; voiceDuration?: number }) => {
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
            voiceUrl: data.voiceUrl || null,
            voiceDuration: data.voiceDuration || null,
            readByHost: false,
            readByGuest: true,
          },
        });

        const updateData: any = {
          lastMessageAt: message.createdAt,
          lastMessagePreview: data.content.slice(0, 100),
          unreadByHost: { increment: 1 },
        };

        // If GUEST_HOST conversation, also increment unreadByWorker
        if (conversation.channelType === 'GUEST_HOST') {
          updateData.unreadByWorker = { increment: 1 };
        }

        await prisma.conversation.update({
          where: { id: data.conversationId },
          data: updateData,
        });

        // Emit to room
        hostNs.to(`conv:${data.conversationId}`).emit('new_message', message);
        guestNs.to(`conv:${data.conversationId}`).emit('new_message', message);

        // If GUEST_HOST conversation, also broadcast to workers
        if (conversation.channelType === 'GUEST_HOST') {
          workerNs.to(`conv:${data.conversationId}`).emit('new_message', message);
        }

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

        // Trigger voice translation if voice message
        if (data.voiceUrl) {
          try {
            translateVoiceAsync(message, io);
          } catch (err) {
            console.error('Voice translation trigger failed:', err);
          }
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

  // ── /worker namespace (JWT auth for workers) ────────────────────────────────

  const workerNs = io.of('/worker');

  workerNs.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required'));

      const secret = process.env.JWT_SECRET;
      if (!secret) return next(new Error('Server configuration error'));

      const payload = jwt.verify(token, secret) as { id: string; role: string };
      if (payload.role !== 'WORKER') return next(new Error('Worker role required'));

      const worker = await prisma.worker.findUnique({ where: { userId: payload.id } });
      if (!worker) return next(new Error('Worker not found'));

      (socket as any).workerId = worker.id;
      (socket as any).userId = payload.id;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  workerNs.on('connection', (socket: Socket) => {
    const workerId = (socket as any).workerId;

    socket.on('join_conversation', async (conversationId: string) => {
      // Allow joining internal conversations (worker is directly assigned)
      const conv = await prisma.conversation.findFirst({
        where: { id: conversationId, workerId },
      });
      if (conv) {
        socket.join(`conv:${conversationId}`);
        return;
      }

      // Allow joining GUEST_HOST conversations if worker is assigned to the booking's property
      const guestHostConv = await prisma.conversation.findFirst({
        where: { id: conversationId, channelType: 'GUEST_HOST' },
        include: { booking: { select: { propertyId: true } } },
      });
      if (guestHostConv?.booking?.propertyId) {
        const staffAssignment = await prisma.propertyStaff.findFirst({
          where: { workerId, propertyId: guestHostConv.booking.propertyId },
        });
        if (staffAssignment) {
          socket.join(`conv:${conversationId}`);
        }
      }
    });

    socket.on('leave_conversation', (conversationId: string) => {
      socket.leave(`conv:${conversationId}`);
    });

    socket.on('send_message', async (data: { conversationId: string; content: string; imageUrl?: string; voiceUrl?: string; voiceDuration?: number }) => {
      try {
        // First try: worker is directly assigned to conversation (internal)
        let conversation = await prisma.conversation.findFirst({
          where: { id: data.conversationId, workerId },
        });

        // Second try: GUEST_HOST conversation where worker is assigned to the property
        let isGuestHostConversation = false;
        if (!conversation) {
          const guestHostConv = await prisma.conversation.findFirst({
            where: { id: data.conversationId, channelType: 'GUEST_HOST' },
            include: { booking: { select: { propertyId: true } } },
          });
          if (guestHostConv?.booking?.propertyId) {
            const staffAssignment = await prisma.propertyStaff.findFirst({
              where: { workerId, propertyId: guestHostConv.booking.propertyId },
            });
            if (staffAssignment) {
              conversation = guestHostConv;
              isGuestHostConversation = true;
            }
          }
        }
        if (!conversation) return;

        if (conversation.channelType === 'GUEST_HOST') {
          isGuestHostConversation = true;
        }

        const worker = await prisma.worker.findUnique({
          where: { id: workerId },
          include: { user: { select: { name: true } } },
        });

        // Determine sender type
        const isSupervisor = await prisma.propertyStaff.findFirst({
          where: { workerId, role: 'SUPERVISOR' },
        });
        const senderType = isSupervisor && conversation.channelType === 'SUPERVISOR_WORKER' ? 'SUPERVISOR' : 'WORKER';

        const message = await prisma.message.create({
          data: {
            conversationId: data.conversationId,
            senderType,
            senderName: worker?.user?.name || 'Worker',
            content: data.content,
            imageUrl: data.imageUrl || null,
            voiceUrl: data.voiceUrl || null,
            voiceDuration: data.voiceDuration || null,
            readByHost: false,
            readByWorker: true,
          },
        });

        const updateData: any = {
          lastMessageAt: message.createdAt,
          lastMessagePreview: data.content.slice(0, 100),
          unreadByHost: { increment: 1 },
        };

        // If GUEST_HOST conversation, also increment guest unread count
        if (isGuestHostConversation) {
          updateData.unreadByGuest = { increment: 1 };
        }

        await prisma.conversation.update({
          where: { id: data.conversationId },
          data: updateData,
        });

        // Emit to all namespaces in the conversation room
        hostNs.to(`conv:${data.conversationId}`).emit('new_message', message);
        workerNs.to(`conv:${data.conversationId}`).emit('new_message', message);

        // If GUEST_HOST conversation, also broadcast to guests
        if (isGuestHostConversation) {
          guestNs.to(`conv:${data.conversationId}`).emit('new_message', message);
        }

        // Push notification to host
        const host = await prisma.host.findUnique({
          where: { id: conversation.hostId },
          select: { pushToken: true },
        });
        if (host?.pushToken) {
          await sendPushNotification(host.pushToken, {
            title: `Message from ${worker?.user?.name || 'Worker'}`,
            body: data.content.slice(0, 100),
            data: { conversationId: data.conversationId, type: 'internal_message' },
            sound: 'default',
            priority: 'high',
            channelId: 'messages',
          });
        }

        // Trigger AI analysis
        const { analyzeMessageAsync } = require('./ai-analyzer');
        analyzeMessageAsync(message, conversation).catch((err: any) =>
          console.error('AI analysis failed:', err)
        );

        // Trigger voice translation if voice message
        if (data.voiceUrl) {
          try {
            translateVoiceAsync(message, io);
          } catch (err) {
            console.error('Voice translation trigger failed:', err);
          }
        }
      } catch (err) {
        console.error('Worker send_message error:', err);
      }
    });

    socket.on('mark_read', async (conversationId: string) => {
      try {
        await prisma.conversation.update({
          where: { id: conversationId, workerId },
          data: { unreadByWorker: 0 },
        });
        await prisma.message.updateMany({
          where: { conversationId, readByWorker: false },
          data: { readByWorker: true },
        });
      } catch (err) {
        console.error('Worker mark_read error:', err);
      }
    });

    socket.on('typing', (conversationId: string) => {
      hostNs.to(`conv:${conversationId}`).emit('typing', { senderType: 'WORKER' });
    });
  });

  return io;
}
