import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { paypalRequest } from '../lib/commercial/subscriptions';

const router = Router();
router.use(authenticate);

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'mohit@livaround.com';
const PAYOUT_THRESHOLD = 25;

function requireAdmin(req: AuthRequest, res: Response): boolean {
  if (req.user?.email !== ADMIN_EMAIL) {
    res.status(403).json({ error: 'Admin access required' });
    return false;
  }
  return true;
}

// ── Cron / Processing endpoint ──────────────────────────────────────────────

/**
 * POST /api/admin/payouts/process
 * Monthly cron job: approve old commissions, create payout records for eligible partners.
 * Can also be called manually by admin or by an external cron service.
 * Accepts optional X-Cron-Secret header for unauthenticated cron calls.
 */
router.post('/process', async (req: AuthRequest, res: Response) => {
  // Allow cron secret OR admin auth
  const cronSecret = process.env.CRON_SECRET;
  const headerSecret = req.headers['x-cron-secret'] as string | undefined;
  const isCron = cronSecret && headerSecret === cronSecret;

  if (!isCron && !requireAdmin(req, res)) return;

  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Step 1: Approve commissions older than 30 days that are still pending
    const approvedResult = await prisma.commission.updateMany({
      where: {
        status: 'pending',
        createdAt: { lt: thirtyDaysAgo },
      },
      data: { status: 'approved' },
    });

    // Step 2: Find all partners with pendingPayout >= threshold
    const eligiblePartners = await prisma.partner.findMany({
      where: {
        status: 'active',
        pendingPayout: { gte: PAYOUT_THRESHOLD },
      },
      include: {
        user: { select: { name: true, email: true } },
        commissions: {
          where: { status: 'approved', payoutId: null },
        },
      },
    });

    // Step 3: Create payout records for each eligible partner
    const payoutsCreated: { partnerId: string; partnerName: string; amount: number; payoutId: string }[] = [];

    for (const partner of eligiblePartners) {
      const approvedCommissions = partner.commissions;
      if (approvedCommissions.length === 0) continue;

      const payoutAmount = approvedCommissions.reduce((sum, c) => sum + c.amount, 0);
      if (payoutAmount < PAYOUT_THRESHOLD) continue;

      // Create payout record
      const payout = await prisma.payout.create({
        data: {
          partnerId: partner.id,
          amount: payoutAmount,
          currency: 'USD',
          method: 'paypal_payout',
          status: 'pending',
        },
      });

      // Link commissions to this payout
      await prisma.commission.updateMany({
        where: {
          id: { in: approvedCommissions.map((c) => c.id) },
        },
        data: { payoutId: payout.id },
      });

      payoutsCreated.push({
        partnerId: partner.id,
        partnerName: partner.user.name,
        amount: payoutAmount,
        payoutId: payout.id,
      });
    }

    console.log(
      `[payouts] Processed: ${approvedResult.count} commissions approved, ${payoutsCreated.length} payouts created`
    );

    return res.json({
      success: true,
      commissionsApproved: approvedResult.count,
      payoutsCreated: payoutsCreated.length,
      payouts: payoutsCreated,
    });
  } catch (err) {
    console.error('[payouts] Processing error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── List payouts ────────────────────────────────────────────────────────────

/**
 * GET /api/admin/payouts
 * List all payouts with filters.
 * Query: ?status=&partner=&from=&to=&page=1&limit=25
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const statusFilter = req.query.status as string | undefined;
    const partnerSearch = req.query.partner as string | undefined;
    const fromDate = req.query.from as string | undefined;
    const toDate = req.query.to as string | undefined;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (statusFilter) where.status = statusFilter;
    if (partnerSearch) {
      where.partner = {
        user: {
          OR: [
            { name: { contains: partnerSearch, mode: 'insensitive' } },
            { email: { contains: partnerSearch, mode: 'insensitive' } },
          ],
        },
      };
    }
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) (where.createdAt as Record<string, unknown>).gte = new Date(fromDate);
      if (toDate) (where.createdAt as Record<string, unknown>).lte = new Date(toDate + 'T23:59:59Z');
    }

    const [payouts, total] = await Promise.all([
      prisma.payout.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          partner: {
            include: {
              user: { select: { name: true, email: true } },
            },
          },
          commissions: {
            select: { id: true, amount: true, period: true, type: true },
          },
        },
      }),
      prisma.payout.count({ where }),
    ]);

    const rows = payouts.map((p) => ({
      id: p.id,
      partnerId: p.partnerId,
      partnerName: p.partner.user.name,
      partnerEmail: p.partner.user.email,
      partnerTier: p.partner.tier,
      amount: p.amount,
      currency: p.currency,
      method: p.method,
      status: p.status,
      reference: p.reference,
      commissionCount: p.commissions.length,
      processedAt: p.processedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    }));

    return res.json({ payouts: rows, total, page, limit });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── KPIs ────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/payouts/stats
 * Payout KPIs for the admin dashboard.
 */
router.get('/stats', async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      paidThisMonth,
      paidAllTime,
      activePartners,
      pendingPayouts,
    ] = await Promise.all([
      prisma.payout.aggregate({
        where: { status: 'completed', processedAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      prisma.payout.aggregate({
        where: { status: 'completed' },
        _sum: { amount: true },
      }),
      prisma.partner.count({ where: { status: 'active' } }),
      prisma.payout.count({ where: { status: 'pending' } }),
    ]);

    return res.json({
      paidThisMonth: paidThisMonth._sum.amount ?? 0,
      paidAllTime: paidAllTime._sum.amount ?? 0,
      activePartners,
      pendingPayouts,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Send payouts via PayPal ─────────────────────────────────────────────────

/**
 * POST /api/admin/payouts/send
 * Batch-send all pending payouts via PayPal Payouts API.
 * Optionally accepts { payoutIds: string[] } to send specific payouts.
 */
router.post('/send', async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const { payoutIds } = req.body as { payoutIds?: string[] };

    const where: Record<string, unknown> = { status: 'pending' };
    if (payoutIds?.length) {
      where.id = { in: payoutIds };
    }

    const pendingPayouts = await prisma.payout.findMany({
      where,
      include: {
        partner: {
          include: { user: { select: { email: true, name: true } } },
        },
      },
    });

    if (pendingPayouts.length === 0) {
      return res.json({ success: true, message: 'No pending payouts to process', processed: 0 });
    }

    // Build PayPal Payouts API request
    const senderBatchId = `LivAround_${Date.now()}`;
    const items = pendingPayouts.map((p) => ({
      recipient_type: 'EMAIL',
      amount: {
        value: p.amount.toFixed(2),
        currency: p.currency,
      },
      receiver: p.partner.user.email,
      note: `LivAround partner payout - ${p.partner.user.name}`,
      sender_item_id: p.id,
    }));

    // Mark all as processing before calling PayPal
    await prisma.payout.updateMany({
      where: { id: { in: pendingPayouts.map((p) => p.id) } },
      data: { status: 'processing' },
    });

    let paypalBatchId: string | null = null;

    try {
      const paypalResponse = await paypalRequest<{
        batch_header: { payout_batch_id: string; batch_status: string };
      }>('POST', '/v1/payments/payouts', {
        sender_batch_header: {
          sender_batch_id: senderBatchId,
          email_subject: 'You have a payment from LivAround',
          email_message: 'Thank you for being a LivAround partner! Here is your commission payout.',
        },
        items,
      });

      paypalBatchId = paypalResponse.batch_header.payout_batch_id;

      // Update all payouts with the PayPal batch reference
      await prisma.payout.updateMany({
        where: { id: { in: pendingPayouts.map((p) => p.id) } },
        data: { reference: paypalBatchId },
      });

      console.log(
        `[payouts] PayPal batch ${paypalBatchId} created with ${items.length} items`
      );

      return res.json({
        success: true,
        processed: pendingPayouts.length,
        paypalBatchId,
        totalAmount: pendingPayouts.reduce((sum, p) => sum + p.amount, 0),
      });
    } catch (paypalErr) {
      // Revert to pending if PayPal call fails
      await prisma.payout.updateMany({
        where: { id: { in: pendingPayouts.map((p) => p.id) } },
        data: { status: 'pending', reference: null },
      });

      console.error('[payouts] PayPal payout failed:', paypalErr);
      return res.status(502).json({
        error: 'PayPal payout request failed',
        details: paypalErr instanceof Error ? paypalErr.message : 'Unknown error',
      });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Confirm payout completion ───────────────────────────────────────────────

/**
 * POST /api/admin/payouts/:id/complete
 * Mark a payout as completed. Updates partner's pendingPayout and totalEarned.
 * Can be called manually or by a webhook handler.
 */
router.post('/:id/complete', async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const payout = await prisma.payout.findUnique({
      where: { id: req.params.id },
      include: { commissions: true },
    });

    if (!payout) return res.status(404).json({ error: 'Payout not found' });
    if (payout.status === 'completed') {
      return res.status(400).json({ error: 'Payout already completed' });
    }

    const now = new Date();

    // Update payout status
    await prisma.payout.update({
      where: { id: payout.id },
      data: { status: 'completed', processedAt: now },
    });

    // Mark all linked commissions as paid
    await prisma.commission.updateMany({
      where: { payoutId: payout.id },
      data: { status: 'paid', paidAt: now },
    });

    // Update partner balances
    await prisma.partner.update({
      where: { id: payout.partnerId },
      data: {
        pendingPayout: { decrement: payout.amount },
        totalEarned: { increment: payout.amount },
      },
    });

    console.log(`[payouts] Payout ${payout.id} completed: $${payout.amount} to partner ${payout.partnerId}`);

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Reject a payout ─────────────────────────────────────────────────────────

/**
 * POST /api/admin/payouts/:id/reject
 * Reject a pending payout and unlink its commissions (back to approved state).
 */
router.post('/:id/reject', async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const payout = await prisma.payout.findUnique({
      where: { id: req.params.id },
    });

    if (!payout) return res.status(404).json({ error: 'Payout not found' });
    if (payout.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending payouts can be rejected' });
    }

    // Unlink commissions from this payout (back to approved, no payoutId)
    await prisma.commission.updateMany({
      where: { payoutId: payout.id },
      data: { payoutId: null, status: 'approved' },
    });

    // Delete the payout record
    await prisma.payout.delete({ where: { id: payout.id } });

    console.log(`[payouts] Payout ${payout.id} rejected for partner ${payout.partnerId}`);

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Check PayPal batch status ───────────────────────────────────────────────

/**
 * POST /api/admin/payouts/check-status
 * Check the status of processing payouts by querying PayPal batch status.
 * Auto-completes payouts that PayPal confirms as SUCCESS.
 */
router.post('/check-status', async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    // Find all processing payouts with a PayPal reference
    const processingPayouts = await prisma.payout.findMany({
      where: { status: 'processing', reference: { not: null } },
      include: { commissions: true },
    });

    if (processingPayouts.length === 0) {
      return res.json({ success: true, message: 'No processing payouts to check', updated: 0 });
    }

    // Group by batch reference
    const batches = new Map<string, typeof processingPayouts>();
    for (const p of processingPayouts) {
      const ref = p.reference!;
      if (!batches.has(ref)) batches.set(ref, []);
      batches.get(ref)!.push(p);
    }

    let completedCount = 0;
    let failedCount = 0;

    for (const [batchId, payouts] of batches) {
      try {
        const batchStatus = await paypalRequest<{
          batch_header: { batch_status: string };
          items?: { payout_item_id: string; transaction_status: string; payout_item: { sender_item_id: string } }[];
        }>('GET', `/v1/payments/payouts/${batchId}`);

        if (batchStatus.batch_header.batch_status === 'SUCCESS' && batchStatus.items) {
          for (const item of batchStatus.items) {
            const payout = payouts.find((p) => p.id === item.payout_item.sender_item_id);
            if (!payout) continue;

            if (item.transaction_status === 'SUCCESS') {
              const now = new Date();
              await prisma.payout.update({
                where: { id: payout.id },
                data: { status: 'completed', processedAt: now },
              });
              await prisma.commission.updateMany({
                where: { payoutId: payout.id },
                data: { status: 'paid', paidAt: now },
              });
              await prisma.partner.update({
                where: { id: payout.partnerId },
                data: {
                  pendingPayout: { decrement: payout.amount },
                  totalEarned: { increment: payout.amount },
                },
              });
              completedCount++;
            } else if (item.transaction_status === 'FAILED' || item.transaction_status === 'RETURNED') {
              await prisma.payout.update({
                where: { id: payout.id },
                data: { status: 'failed' },
              });
              // Unlink commissions so they can be retried
              await prisma.commission.updateMany({
                where: { payoutId: payout.id },
                data: { payoutId: null, status: 'approved' },
              });
              failedCount++;
            }
          }
        }
      } catch (batchErr) {
        console.error(`[payouts] Failed to check batch ${batchId}:`, batchErr);
      }
    }

    return res.json({ success: true, completed: completedCount, failed: failedCount });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
