import { Router, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { sendWorkerWelcomeEmail } from '../lib/email';

const router = Router();
router.use(authenticate);

// Lightweight location update — worker identifies themselves via JWT
router.post('/me/location', async (req: AuthRequest, res: Response) => {
  try {
    const { latitude, longitude } = req.body;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ error: 'latitude and longitude are required' });
    }
    const worker = await prisma.worker.findUnique({ where: { userId: req.user!.id } });
    if (!worker) return res.status(404).json({ error: 'Worker not found' });

    await prisma.worker.update({
      where: { id: worker.id },
      data: { latitude, longitude },
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a worker's current location (for dashboard)
router.get('/:id/location', async (req: AuthRequest, res: Response) => {
  try {
    const worker = await prisma.worker.findUnique({
      where: { id: req.params.id },
      select: { latitude: true, longitude: true, updatedAt: true, user: { select: { name: true } } },
    });
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    return res.json(worker);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

const createWorkerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  skills: z.array(z.string()).min(1),
  location: z.string().optional(),
  bio: z.string().optional(),
});

const updateWorkerSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  skills: z.array(z.string()).optional(),
  isAvailable: z.boolean().optional(),
  location: z.string().optional(),
  bio: z.string().optional(),
  pushToken: z.string().optional(),
});

function parseSkills(raw: string | undefined): string[] {
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { skill, available } = req.query;
    let workers = await prisma.worker.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        _count: { select: { jobs: true } },
        propertyStaff: {
          where: { property: { host: { userId: req.user!.id } } },
          include: { property: { select: { id: true, name: true, type: true } } },
        },
      },
      orderBy: { jobsCompleted: 'desc' },
    });

    if (skill) workers = workers.filter((w) => parseSkills(w.skills).includes(skill as string));
    if (available !== undefined) workers = workers.filter((w) => w.isAvailable === (available === 'true'));

    return res.json(workers.map((w) => ({ ...w, skills: parseSkills(w.skills) })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', validate(createWorkerSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, phone, skills, location, bio } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const tempPassword = Math.random().toString(36).slice(-10);
    const hashed = await bcrypt.hash(tempPassword, 12);

    const user = await prisma.user.create({
      data: {
        name, email, password: hashed, phone, role: 'WORKER',
        worker: { create: { skills: JSON.stringify(skills), location, bio } },
      },
      include: { worker: true },
    });

    const workerAppUrl = process.env.WORKER_APP_URL || process.env.CORS_ORIGIN || 'http://localhost:3000';
    sendWorkerWelcomeEmail({ name, email, tempPassword, workerAppUrl }).catch((err) =>
      console.error('Failed to send welcome email:', err)
    );

    return res.status(201).json({
      ...user.worker,
      skills: parseSkills(user.worker!.skills),
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone },
      tempPassword,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const worker = await prisma.worker.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        jobs: { orderBy: { scheduledAt: 'desc' }, take: 20, include: { property: { select: { name: true, city: true } } } },
      },
    });
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    return res.json({ ...worker, skills: parseSkills(worker.skills) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', validate(updateWorkerSchema), async (req: AuthRequest, res: Response) => {
  try {
    const worker = await prisma.worker.findUnique({ where: { id: req.params.id } });
    if (!worker) return res.status(404).json({ error: 'Worker not found' });

    const { name, phone, skills, ...workerData } = req.body;
    const updated = await prisma.worker.update({
      where: { id: req.params.id },
      data: {
        ...workerData,
        ...(skills && { skills: JSON.stringify(skills) }),
        user: (name || phone) ? { update: { ...(name && { name }), ...(phone && { phone }) } } : undefined,
      },
      include: { user: { select: { id: true, name: true, email: true, phone: true } } },
    });
    return res.json({ ...updated, skills: parseSkills(updated.skills) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/reset-password', async (req: AuthRequest, res: Response) => {
  try {
    const worker = await prisma.worker.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { name: true, email: true } } },
    });
    if (!worker) return res.status(404).json({ error: 'Worker not found' });

    const tempPassword = Math.random().toString(36).slice(-10);
    const hashed = await bcrypt.hash(tempPassword, 12);

    await prisma.user.update({ where: { id: worker.userId }, data: { password: hashed } });

    const workerAppUrl = process.env.WORKER_APP_URL || process.env.CORS_ORIGIN || 'http://localhost:3000';
    sendWorkerWelcomeEmail({ name: worker.user.name, email: worker.user.email, tempPassword, workerAppUrl }).catch((err) =>
      console.error('Failed to send password reset email:', err)
    );

    return res.json({ tempPassword });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const worker = await prisma.worker.findUnique({ where: { id: req.params.id } });
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    await prisma.user.delete({ where: { id: worker.userId } });
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
