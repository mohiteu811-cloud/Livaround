import { io, Socket } from 'socket.io-client';
import { getToken } from './api';

const API_URL = 'https://livaroundbackend-production.up.railway.app';

let socket: Socket | null = null;

export async function connectSocket() {
  const token = await getToken();
  if (!token) return;

  if (socket?.connected) return;

  socket = io(`${API_URL}/worker`, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('Worker socket connected');
  });

  socket.on('disconnect', (reason) => {
    console.log('Worker socket disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('Worker socket error:', err.message);
  });
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}

export function joinConversation(conversationId: string) {
  socket?.emit('join_conversation', conversationId);
}

export function leaveConversation(conversationId: string) {
  socket?.emit('leave_conversation', conversationId);
}
