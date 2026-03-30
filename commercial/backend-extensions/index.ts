import { Express } from 'express';
import http from 'http';
import { prisma } from '../../backend/src/lib/prisma';
import { setupSocketIO } from './src/lib/socket';
import conversationsRoutes from './src/routes/conversations';
import hostAppRoutes from './src/routes/host-app';
import guestMessagingRoutes from './src/routes/guest-messaging';

export function register(app: Express, server: http.Server, allowedOrigins: string[]) {
  // Set up Socket.IO for real-time messaging
  const io = setupSocketIO(server, allowedOrigins);

  // Make io available to route handlers via app.locals
  app.locals.io = io;

  // Mount commercial routes
  app.use('/api/conversations', conversationsRoutes);
  app.use('/api/host-app', hostAppRoutes);
  app.use('/api/stay', guestMessagingRoutes);

  console.log('Commercial extensions registered: messaging, host-app');
}
