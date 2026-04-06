import { Express } from 'express';
import http from 'http';
import { prisma } from '../../backend/src/lib/prisma';
import { setupSocketIO } from './src/lib/socket';
import conversationsRoutes from './src/routes/conversations';
import hostAppRoutes from './src/routes/host-app';
import guestMessagingRoutes from './src/routes/guest-messaging';
import internalMessagingRoutes from './src/routes/internal-messaging';
import aiSuggestionsRoutes from './src/routes/ai-suggestions';
import walkthroughsRoutes from './src/routes/walkthroughs';
import inventoryRoutes from './src/routes/inventory';
import auditsRoutes from './src/routes/audits';
import { analyzeIssue } from './src/lib/ai-analyzer';
import { startVideoProcessingWorker } from './src/lib/video-processor';

export function register(app: Express, server: http.Server, allowedOrigins: string[]) {
  // Set up Socket.IO for real-time messaging (host, guest, worker namespaces)
  const io = setupSocketIO(server, allowedOrigins);

  // Make io and AI functions available to route handlers via app.locals
  app.locals.io = io;
  app.locals.analyzeIssue = analyzeIssue;

  // Mount commercial routes
  app.use('/api/conversations', conversationsRoutes);
  app.use('/api/host-app', hostAppRoutes);
  app.use('/api/stay', guestMessagingRoutes);
  app.use('/api/internal-conversations', internalMessagingRoutes);
  app.use('/api/ai-suggestions', aiSuggestionsRoutes);
  app.use('/api/walkthroughs', walkthroughsRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/audits', auditsRoutes);

  // Start background workers
  if (process.env.REDIS_URL) {
    startVideoProcessingWorker();
  }

  console.log('Commercial extensions registered: messaging, internal-messaging, ai-suggestions, host-app, walkthroughs, inventory, audits');
}
