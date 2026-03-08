import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { validate } from '../middleware/validate';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function signToken(payload: object) {
  return jwt.sign(payload, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '7d' });
}

router.post('/register', validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const { name, email, password, phone } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashed = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        phone,
        role: 'HOST',
        host: { create: { name } },
      },
      include: { host: true },
    });

    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
      hostId: user.host?.id,
    });

    return res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { host: true, worker: true, owner: true },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
      hostId: user.host?.id,
      workerId: user.worker?.id,
      ownerId: user.owner?.id,
    });

    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        host: { select: { id: true, name: true } },
        worker: { select: { id: true, skills: true, rating: true, isAvailable: true, jobsCompleted: true } },
      },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    const parsed = {
      ...user,
      worker: user.worker
        ? {
            ...user.worker,
            skills: (() => { try { return JSON.parse(user.worker!.skills as unknown as string || '[]'); } catch { return []; } })(),
          }
        : null,
    };

    return res.json(parsed);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
