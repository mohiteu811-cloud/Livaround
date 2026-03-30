import { Express } from 'express';
import http from 'http';
import { prisma } from '../../backend/src/lib/prisma';
import { setupSocketIO } from './src/lib/socket';
import conversationsRoutes from './src/routes/conversations';
import hostAppRoutes from './src/routes/host-app';
import guestMessagingRoutes from './src/routes/guest-messaging';
import internalMessagingRoutes from './src/routes/internal-messaging';
import aiSuggestionsRoutes from './src/routes/ai-suggestions';

export function register(app: Express, server: http.Server, allowedOrigins: string[]) {
  // Set up Socket.IO for real-time messaging (host, guest, worker namespaces)
  const io = setupSocketIO(server, allowedOrigins);

  // Make io available to route handlers via app.locals
  app.locals.io = io;

  // Mount commercial routes
  app.use('/api/conversations', conversationsRoutes);
  app.use('/api/host-app', hostAppRoutes);
  app.use('/api/stay', guestMessagingRoutes);
  app.use('/api/internal-conversations', internalMessagingRoutes);
  app.use('/api/ai-suggestions', aiSuggestionsRoutes);

  console.log('Commercial extensions registered: messaging, internal-messaging, ai-suggestions, host-app');
}
