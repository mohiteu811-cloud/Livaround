import { PrismaClient } from '@prisma/client';
import { IS_COMMERCIAL } from '../config';

/**
 * Count active properties for an organization.
 * When IS_COMMERCIAL is false, returns Infinity (no limits).
 */
export async function getPropertyCount(
  orgId: string,
  prisma: PrismaClient,
): Promise<number> {
  if (!IS_COMMERCIAL) return Infinity;

  const host = await prisma.host.findUnique({
    where: { organizationId: orgId },
    select: { id: true },
  });
  if (!host) return 0;

  return prisma.property.count({
    where: { hostId: host.id, isActive: true },
  });
}

/**
 * Calculate the monthly amount owed for an organization's subscription.
 * Community = $0, Pro = activeProperties × $10, Agency = flat $100.
 * When IS_COMMERCIAL is false, always returns 0.
 */
export async function calculateMonthlyAmount(
  orgId: string,
  prisma: PrismaClient,
): Promise<number> {
  if (!IS_COMMERCIAL) return 0;

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: orgId },
    include: { plan: true },
  });
  if (!subscription) return 0;

  const { plan } = subscription;

  if (plan.flatPrice != null) {
    return plan.flatPrice;
  }

  if (plan.pricePerProperty != null) {
    const count = await getPropertyCount(orgId, prisma);
    return count * plan.pricePerProperty;
  }

  // Community / free plan
  return 0;
}

/**
 * Recount active properties and update the subscription record.
 * Call this after a property is created, deleted, or has isActive toggled.
 * When IS_COMMERCIAL is false, this is a no-op.
 */
export async function syncPropertyCount(
  orgId: string,
  prisma: PrismaClient,
): Promise<void> {
  if (!IS_COMMERCIAL) return;

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: orgId },
  });
  if (!subscription) return;

  const propertyCount = await getPropertyCount(orgId, prisma);
  const monthlyAmount = await calculateMonthlyAmount(orgId, prisma);

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { propertyCount, monthlyAmount },
  });
}
