import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://livaroundbackend-production.up.railway.app';

let socket: Socket | null = null;

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('livaround_token');
}

export function connectSocket(): Socket | null {
  if (socket?.connected) return socket;

  const token = getToken();
  if (!token) return null;

  socket = io(`${API_URL}/host`, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
  });

  socket.on('connect', () => {
    console.log('[socket] connected to /host');
  });

  socket.on('disconnect', (reason) => {
    console.log('[socket] disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('[socket] connection error:', err.message);
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function joinConversation(conversationId: string): void {
  socket?.emit('join_conversation', conversationId);
}

export function leaveConversation(conversationId: string): void {
  socket?.emit('leave_conversation', conversationId);
}

export function sendSocketMessage(conversationId: string, content: string, imageUrl?: string): void {
  socket?.emit('send_message', { conversationId, content, imageUrl });
}

export function markSocketRead(conversationId: string): void {
  socket?.emit('mark_read', conversationId);
}

export function emitTyping(conversationId: string): void {
  socket?.emit('typing', conversationId);
}
