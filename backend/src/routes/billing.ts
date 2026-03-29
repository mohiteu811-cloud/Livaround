import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { IS_COMMERCIAL } from '../../../lib/config';
import { PLANS } from '../../../lib/commercial/plans';

const router = Router();
router.use(authenticate);

/**
 * GET /api/billing/features
 * Returns the current org's plan name and full feature map.
 * When IS_COMMERCIAL is false, returns all features enabled with no plan requirement.
 */
router.get('/features', async (req: AuthRequest, res: Response) => {
  try {
    if (!IS_COMMERCIAL) {
      // Open-source mode: everything unlocked
      const allFeatures: Record<string, boolean> = {};
      for (const key of Object.keys(PLANS.agency.features)) {
        allFeatures[key] = true;
      }
      return res.json({ plan: null, features: allFeatures });
    }

    const host = await prisma.host.findUnique({
      where: { userId: req.user!.id },
      select: { organizationId: true },
    });

    if (!host?.organizationId) {
      // No org — community defaults
      return res.json({ plan: 'community', features: PLANS.community.features });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId: host.organizationId },
      include: { plan: true },
    });

    if (!subscription) {
      return res.json({ plan: 'community', features: PLANS.community.features });
    }

    return res.json({
      plan: subscription.plan.name,
      features: subscription.plan.features,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
