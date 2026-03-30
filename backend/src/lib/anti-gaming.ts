import { prisma } from './prisma';

/**
 * Anti-gaming protection logic for the partner/affiliate program.
 */

// ─── A. Self-Referral Prevention ────────────────────────────────────────────

function getEmailDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() ?? '';
}

export async function checkSelfReferral(
  partnerId: string,
  orgAdminEmail: string
): Promise<{ blocked: boolean; flagReason?: string }> {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: { email: true, paypalEmail: true, fullName: true },
  });
  if (!partner) return { blocked: false };

  const adminEmail = orgAdminEmail.trim().toLowerCase();
  const partnerEmail = partner.email?.trim().toLowerCase() ?? '';
  const partnerPaypal = partner.paypalEmail?.trim().toLowerCase() ?? '';

  // Exact email match
  if (adminEmail === partnerEmail || adminEmail === partnerPaypal) {
    await flagPartner(partnerId, 'self_referral',
      `Partner email (${partnerEmail}) or PayPal (${partnerPaypal}) matches org admin email (${adminEmail})`
    );
    return { blocked: true, flagReason: 'self_referral' };
  }

  // Domain match (flag for review, don't block)
  const adminDomain = getEmailDomain(adminEmail);
  const partnerDomain = getEmailDomain(partnerEmail);
  const freeProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com', 'protonmail.com', 'mail.com'];

  if (adminDomain && partnerDomain && adminDomain === partnerDomain && !freeProviders.includes(adminDomain)) {
    await flagPartner(partnerId, 'domain_match',
      `Partner domain (${partnerDomain}) matches org admin domain (${adminDomain})`
    );
    // Don't block, just flag for review
  }

  return { blocked: false };
}

// ─── B. 30-Day Commission Hold ──────────────────────────────────────────────

export function getHoldUntilDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d;
}

export function getClawbackUntilDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 60);
  return d;
}

/**
 * Process pending commissions — approve those past the 30-day hold.
 */
export async function processCommissionHolds(): Promise<number> {
  const now = new Date();
  const result = await prisma.commission.updateMany({
    where: {
      status: 'pending',
      holdUntil: { lte: now },
    },
    data: { status: 'approved' },
  });
  return result.count;
}

/**
 * Void commissions for a cancelled subscription (within hold period).
 */
export async function voidCommissionsForCancellation(subscriptionId: string): Promise<number> {
  const result = await prisma.commission.updateMany({
    where: {
      subscriptionId,
      status: 'pending',
    },
    data: { status: 'voided' },
  });
  return result.count;
}

// ─── C. Minimum Activity Threshold ──────────────────────────────────────────

export async function checkActivityThreshold(organizationId: string): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      host: {
        include: {
          properties: {
            where: { isActive: true },
            select: { id: true, isActive: true, jobs: { where: { status: 'COMPLETED' }, take: 1, select: { id: true } } },
          },
        },
      },
    },
  });

  if (!org?.host) return false;

  const activeProperties = org.host.properties.filter(p => p.isActive);
  const hasCompletedJob = org.host.properties.some(p => p.jobs.length > 0);

  return activeProperties.length >= 1 && hasCompletedJob;
}

// ─── D. Duplicate Detection (same IP within 24h) ───────────────────────────

export async function checkDuplicateSignup(
  partnerId: string,
  signupIp: string | null
): Promise<{ flagged: boolean }> {
  if (!signupIp) return { flagged: false };

  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);

  const sameIpOrgs = await prisma.organization.count({
    where: {
      referredByPartnerId: partnerId,
      signupIp,
      createdAt: { gte: oneDayAgo },
    },
  });

  if (sameIpOrgs >= 2) {
    await flagPartner(partnerId, 'same_ip',
      `Multiple orgs (${sameIpOrgs + 1}) signed up from IP ${signupIp} within 24 hours`
    );
    return { flagged: true };
  }

  return { flagged: false };
}

// ─── E. Payment Velocity Limits ─────────────────────────────────────────────

export async function checkDailyReferralLimit(partnerId: string): Promise<{ exceeded: boolean }> {
  const today = new Date().toISOString().slice(0, 10);

  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: { dailyReferralCount: true, dailyReferralDate: true },
  });

  if (!partner) return { exceeded: false };

  let count = partner.dailyReferralCount;
  if (partner.dailyReferralDate !== today) {
    count = 0;
  }

  if (count >= 10) {
    await flagPartner(partnerId, 'velocity_limit',
      `Daily referral limit exceeded (${count} referrals on ${today})`
    );
    return { exceeded: true };
  }

  // Increment counter
  await prisma.partner.update({
    where: { id: partnerId },
    data: {
      dailyReferralCount: count + 1,
      dailyReferralDate: today,
    },
  });

  return { exceeded: false };
}

export async function checkMonthlyPayoutCap(partnerId: string): Promise<{ capped: boolean; maxPayout: number }> {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: { createdAt: true, monthlyPayout: true, monthlyPayoutMonth: true },
  });
  if (!partner) return { capped: false, maxPayout: Infinity };

  // Check if partner is in first 3 months
  const threeMonthsAfterCreation = new Date(partner.createdAt);
  threeMonthsAfterCreation.setMonth(threeMonthsAfterCreation.getMonth() + 3);

  if (new Date() > threeMonthsAfterCreation) {
    return { capped: false, maxPayout: Infinity }; // No cap after 3 months
  }

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyAmount = partner.monthlyPayoutMonth === currentMonth ? partner.monthlyPayout : 0;

  return {
    capped: monthlyAmount >= 500,
    maxPayout: 500 - monthlyAmount,
  };
}

// ─── F. Churn-Based Commission Clawback ─────────────────────────────────────

export async function processChurnClawback(subscriptionId: string): Promise<number> {
  // Find the org and check if within 60-day clawback window
  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { organization: true },
  });
  if (!sub?.organization) return 0;

  const commissions = await prisma.commission.findMany({
    where: {
      subscriptionId,
      status: { in: ['pending', 'approved'] },
      clawbackUntil: { gte: new Date() },
    },
  });

  if (commissions.length === 0) return 0;

  const totalClawback = commissions.reduce((sum, c) => sum + c.amount, 0);

  // Update commissions to clawback status
  await prisma.commission.updateMany({
    where: { id: { in: commissions.map(c => c.id) } },
    data: { status: 'clawback' },
  });

  // Deduct from partner's pending balance
  if (sub.organization.referredByPartnerId) {
    await prisma.partner.update({
      where: { id: sub.organization.referredByPartnerId },
      data: {
        pendingPayout: { decrement: totalClawback },
        totalEarned: { decrement: totalClawback },
      },
    });

    // Check partner churn rate and auto-suspend if >50%
    await checkPartnerChurnRate(sub.organization.referredByPartnerId);
  }

  return commissions.length;
}

export async function checkPartnerChurnRate(partnerId: string): Promise<void> {
  const referredOrgs = await prisma.organization.findMany({
    where: { referredByPartnerId: partnerId },
    include: { subscription: { select: { status: true } } },
  });

  if (referredOrgs.length < 4) return; // Not enough data to judge

  const churned = referredOrgs.filter(o => o.subscription?.status === 'cancelled').length;
  const churnRate = churned / referredOrgs.length;

  if (churnRate > 0.5) {
    await prisma.partner.update({
      where: { id: partnerId },
      data: { status: 'suspended', suspendReason: `Auto-suspended: ${(churnRate * 100).toFixed(0)}% churn rate` },
    });
    await flagPartner(partnerId, 'high_churn',
      `Churn rate ${(churnRate * 100).toFixed(0)}% exceeds 50% threshold (${churned}/${referredOrgs.length})`
    );
  }
}

// ─── G. Tier Auto-Upgrade ───────────────────────────────────────────────────

export async function checkTierUpgrade(partnerId: string): Promise<boolean> {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: { tier: true },
  });
  if (!partner || partner.tier !== 'referral') return false;

  const referredOrgs = await prisma.organization.findMany({
    where: { referredByPartnerId: partnerId },
    include: { subscription: { select: { status: true } } },
  });

  const activeCustomers = referredOrgs.filter(o => o.subscription?.status === 'active').length;
  const totalReferred = referredOrgs.length;
  const churned = referredOrgs.filter(o => o.subscription?.status === 'cancelled').length;
  const churnRate = totalReferred > 0 ? churned / totalReferred : 0;

  if (activeCustomers >= 10 && churnRate < 0.3) {
    await prisma.partner.update({
      where: { id: partnerId },
      data: { tier: 'channel', commissionRate: 0.25 },
    });
    return true;
  }

  return false;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function flagPartner(
  partnerId: string,
  reason: string,
  details: string
): Promise<void> {
  // Don't create duplicate pending flags for the same reason
  const existing = await prisma.partnerFlag.findFirst({
    where: { partnerId, reason, status: 'pending' },
  });
  if (existing) return;

  await prisma.partnerFlag.create({
    data: { partnerId, reason, details },
  });
}

/**
 * Process referral attribution on org signup.
 * Called from auth/billing routes when an org is created.
 */
export async function processReferralAttribution(params: {
  organizationId: string;
  referralCode: string;
  adminEmail: string;
  signupIp?: string;
  signupFingerprint?: string;
}): Promise<{ success: boolean; partnerId?: string; flagged?: boolean; error?: string }> {
  const { organizationId, referralCode, adminEmail, signupIp, signupFingerprint } = params;

  // Find partner
  const partner = await prisma.partner.findUnique({ where: { referralCode } });
  if (!partner || partner.status !== 'active') {
    return { success: false, error: 'Invalid or inactive referral code' };
  }

  // A. Self-referral check
  const selfRef = await checkSelfReferral(partner.id, adminEmail);
  if (selfRef.blocked) {
    return { success: false, error: 'Self-referral detected' };
  }

  // D. Duplicate detection
  const dupCheck = await checkDuplicateSignup(partner.id, signupIp ?? null);

  // E. Daily referral limit
  const velocityCheck = await checkDailyReferralLimit(partner.id);

  // Update org with referral attribution
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      referredByPartnerId: partner.id,
      signupIp: signupIp ?? null,
      signupFingerprint: signupFingerprint ?? null,
    },
  });

  return {
    success: true,
    partnerId: partner.id,
    flagged: dupCheck.flagged || velocityCheck.exceeded,
  };
}
