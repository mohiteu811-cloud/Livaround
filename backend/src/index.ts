import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { json } from 'body-parser';

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

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const allowedOrigins = (process.env.CORS_ORIGIN || 'https://livarounddashboard-production.up.railway.app,http://localhost:3000').split(',').map(o => o.trim());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(json({ limit: '10mb' }));

// Serve uploaded media files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

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

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`LivAround API running on http://localhost:${PORT}`);
});

export default app;
