import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { json } from 'body-parser';
import { IS_COMMERCIAL } from './lib/config';

import authRoutes from './routes/auth';
import propertiesRoutes from './routes/properties';
import bookingsRoutes from './routes/bookings';
import workersRoutes from './routes/workers';
import jobsRoutes from './routes/jobs';
import inventoryRoutes from './routes/inventory';
import analyticsRoutes from './routes/analytics';
import uploadRoutes from './routes/upload';
import tradeRolesRoutes from './routes/trade-roles';
import propertyStaffRoutes from './routes/property-staff';
import maintenanceRoutes from './routes/maintenance';
import ownersRoutes from './routes/owners';
import revenueRoutes from './routes/revenue';
import guideRoutes from './routes/guide';
import publicRoutes from './routes/public';
import issuesRoutes from './routes/issues';
import tradesmenRoutes from './routes/tradesmen';
import stayRoutes from './routes/stay';
import clientsRoutes from './routes/clients';
import venuesRoutes from './routes/venues';
import shiftsRoutes from './routes/shifts';
import billingRoutes from './routes/billing';
import billingWebhookRoutes from './routes/billing-webhook';
import adminRoutes from './routes/admin';
import adminPayoutsRoutes from './routes/admin-payouts';
import partnerRoutes from './routes/partner';

const app = express();
const server = http.createServer(app);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const allowedOrigins = (process.env.CORS_ORIGIN || 'https://livarounddashboard-production.up.railway.app,http://localhost:3000').split(',').map(o => o.trim());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(json({ limit: '10mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/properties', propertiesRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/workers', workersRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/trade-roles', tradeRolesRoutes);
app.use('/api/properties', propertyStaffRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/owners', ownersRoutes);
app.use('/api/revenue-reports', revenueRoutes);
app.use('/api/properties/:id/guide', guideRoutes);
app.use('/api/guide', publicRoutes);
app.use('/api/issues', issuesRoutes);
app.use('/api/tradesmen', tradesmenRoutes);
app.use('/api/stay', stayRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/venues', venuesRoutes);
app.use('/api/shifts', shiftsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/billing/webhook', billingWebhookRoutes);
app.use('/api/admin/payouts', adminPayoutsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/partner', partnerRoutes);

// Load commercial extensions (messaging, host-app endpoints) when available
if (IS_COMMERCIAL) {
  try {
    const commercial = require('../../commercial/backend-extensions');
    commercial.register(app, server, allowedOrigins);
    console.log('Commercial extensions loaded');
  } catch (e: any) {
    console.log('Commercial extensions not available:', e?.message || e);
  }
}

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`LivAround API running on http://localhost:${PORT}`);
});

export default app;
