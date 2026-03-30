import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { IS_COMMERCIAL } from '../config';
import { PLAN_HIERARCHY, PlanName } from './plans';

interface AuthRequest extends Request {
  user?: { id: string; email: string; role: string; hostId?: string };
}

/**
 * Express middleware that blocks requests when the org's plan is below
 * the required minimum.  When IS_COMMERCIAL is false, always allows.
 *
 * Usage:
 *   router.post('/reports', requirePlan('pro', prisma), handler);
 */
export function requirePlan(minimumPlan: 'pro' | 'agency', prisma: PrismaClient) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!IS_COMMERCIAL) return next();

    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const host = await prisma.host.findUnique({
      where: { userId },
      select: { organizationId: true },
    });

    if (!host?.organizationId) {
      // No org linked — treat as community (free) tier
      return res.status(403).json({
        error: 'upgrade_required',
        requiredPlan: minimumPlan,
        upgradeUrl: '/settings/billing',
      });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId: host.organizationId },
      include: { plan: true },
    });

    const currentPlan = (subscription?.plan.name ?? 'community') as PlanName;
    const currentIdx = PLAN_HIERARCHY.indexOf(currentPlan);
    const requiredIdx = PLAN_HIERARCHY.indexOf(minimumPlan);

    if (currentIdx < requiredIdx) {
      return res.status(403).json({
        error: 'upgrade_required',
        requiredPlan: minimumPlan,
        currentPlan,
        upgradeUrl: '/settings/billing',
      });
    }

    next();
  };
}

/**
 * Check whether a specific feature is enabled for an organization's plan.
 * When IS_COMMERCIAL is false, every feature is allowed.
 */
export async function checkFeature(
  orgId: string,
  featureName: string,
  prisma: PrismaClient,
): Promise<boolean> {
  if (!IS_COMMERCIAL) return true;

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: orgId },
    include: { plan: true },
  });

  if (!subscription) {
    // No subscription — community plan; look up community features
    const communityPlan = await prisma.plan.findFirst({ where: { name: 'community' } });
    if (!communityPlan) return false;
    const features = communityPlan.features as Record<string, boolean>;
    return features[featureName] === true;
  }

  const features = subscription.plan.features as Record<string, boolean>;
  return features[featureName] === true;
}
