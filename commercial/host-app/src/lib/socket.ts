import { io, Socket } from 'socket.io-client';
import { getToken } from './api';

const API_URL = 'https://livaroundbackend-production.up.railway.app';

let socket: Socket | null = null;

export async function connectSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  const token = await getToken();
  if (!token) throw new Error('No auth token');

  socket = io(`${API_URL}/host`, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
  });

  socket.on('connect', () => {
    console.log('Socket.IO connected to /host');
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket.IO disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('Socket.IO connection error:', err.message);
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
