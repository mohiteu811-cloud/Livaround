import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { json } from 'body-parser';

import authRoutes from './routes/auth';
import propertiesRoutes from './routes/properties';
import bookingsRoutes from './routes/bookings';
import workersRoutes from './routes/workers';
import jobsRoutes from './routes/jobs';
import inventoryRoutes from './routes/inventory';
import analyticsRoutes from './routes/analytics';

const app = express();

app.use(helmet());
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map(o => o.trim());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(json({ limit: '10mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/properties', propertiesRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/workers', workersRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/analytics', analyticsRoutes);

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
