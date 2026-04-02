import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { IS_COMMERCIAL } from '../lib/config';
import {
  isWhatsAppEnabled,
  sendGuestLink,
  buildGuestLink,
  normalizePhoneNumber,
  verifyWebhookSignature,
  getVerifyToken,
} from '../lib/whatsapp';

const router = Router();

// ── Authenticated endpoints ─────────────────────────────────────────────────

/**
 * GET /api/whatsapp/status
 * Returns whether WhatsApp messaging is available for the current host.
 */
router.get('/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!IS_COMMERCIAL) {
      return res.json({ available: false, reason: 'commercial_required' });
    }

    const host = await prisma.host.findFirst({ where: { userId: req.user!.id } });
    if (!host) return res.json({ available: false, reason: 'no_host' });

    const systemEnabled = isWhatsAppEnabled();
    return res.json({
      available: systemEnabled && host.whatsappEnabled,
      systemEnabled,
      hostEnabled: host.whatsappEnabled,
    });
  } catch (err) {
    console.error('WhatsApp status error:', err);
    res.status(500).json({ error: 'Failed to check WhatsApp status' });
  }
});

/**
 * POST /api/whatsapp/toggle
 * Toggle WhatsApp messaging on/off for the current host.
 */
router.post('/toggle', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const host = await prisma.host.findFirst({ where: { userId: req.user!.id } });
    if (!host) return res.status(404).json({ error: 'Host not found' });

    const updated = await prisma.host.update({
      where: { id: host.id },
      data: { whatsappEnabled: !host.whatsappEnabled },
    });

    res.json({ whatsappEnabled: updated.whatsappEnabled });
  } catch (err) {
    console.error('WhatsApp toggle error:', err);
    res.status(500).json({ error: 'Failed to toggle WhatsApp' });
  }
});

/**
 * POST /api/whatsapp/send-guest-link/:bookingId
 * Send the guest stay link to the guest via WhatsApp.
 */
router.post('/send-guest-link/:bookingId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!IS_COMMERCIAL) {
      return res.status(403).json({ error: 'WhatsApp messaging requires a commercial plan' });
    }

    if (!isWhatsAppEnabled()) {
      return res.status(503).json({ error: 'WhatsApp is not configured on this server' });
    }

    const host = await prisma.host.findFirst({ where: { userId: req.user!.id } });
    if (!host) return res.status(404).json({ error: 'Host not found' });

    if (!host.whatsappEnabled) {
      return res.status(403).json({ error: 'WhatsApp messaging is not enabled for your account' });
    }

    const booking = await prisma.booking.findFirst({
      where: {
        id: req.params.bookingId,
        property: { hostId: host.id },
      },
      include: { property: { select: { name: true } } },
    });

    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    if (!booking.guestPhone) {
      return res.status(400).json({ error: 'Guest phone number is missing for this booking' });
    }

    const normalized = normalizePhoneNumber(booking.guestPhone);
    if (!normalized) {
      return res.status(400).json({ error: 'Invalid guest phone number format' });
    }

    if (!booking.guestCode) {
      return res.status(400).json({ error: 'Guest code not generated for this booking' });
    }

    const guestLink = buildGuestLink(booking.guestCode);

    const result = await sendGuestLink({
      guestName: booking.guestName,
      guestPhone: booking.guestPhone,
      propertyName: booking.property.name,
      checkIn: booking.checkIn.toISOString(),
      checkOut: booking.checkOut.toISOString(),
      guestLink,
    });

    // Create audit log
    await prisma.whatsAppLog.create({
      data: {
        bookingId: booking.id,
        hostId: host.id,
        phone: normalized,
        template: 'guest_stay_link',
        messageId: result.messageId,
        status: result.error ? 'FAILED' : 'SENT',
        errorMessage: result.error,
      },
    });

    if (result.error) {
      return res.status(502).json({ error: `WhatsApp send failed: ${result.error}` });
    }

    // Update booking with sent timestamp
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        whatsappSentAt: new Date(),
        whatsappMessageId: result.messageId,
      },
    });

    res.json({ success: true, messageId: result.messageId });
  } catch (err) {
    console.error('WhatsApp send-guest-link error:', err);
    res.status(500).json({ error: 'Failed to send WhatsApp message' });
  }
});

// ── Meta Webhook (public) ───────────────────────────────────────────────────

/**
 * GET /api/whatsapp/webhook
 * Meta webhook verification (challenge-response).
 */
router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === getVerifyToken()) {
    console.log('WhatsApp webhook verified');
    return res.status(200).send(challenge);
  }

  res.status(403).send('Forbidden');
});

/**
 * POST /api/whatsapp/webhook
 * Receives delivery status updates from Meta.
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    // Always respond 200 quickly to avoid Meta retries
    res.sendStatus(200);

    // Verify signature if app secret is configured
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    if (signature && req.body) {
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
      if (!verifyWebhookSignature(rawBody, signature)) {
        console.warn('WhatsApp webhook: invalid signature');
        return;
      }
    }

    const body = req.body;
    const entries = body?.entry ?? [];

    for (const entry of entries) {
      const changes = entry?.changes ?? [];
      for (const change of changes) {
        const statuses = change?.value?.statuses ?? [];
        for (const status of statuses) {
          const metaMessageId = status.id;
          const newStatus = (status.status as string)?.toUpperCase(); // sent, delivered, read, failed

          if (!metaMessageId || !newStatus) continue;

          await prisma.whatsAppLog.updateMany({
            where: { messageId: metaMessageId },
            data: {
              status: newStatus,
              ...(newStatus === 'FAILED'
                ? { errorMessage: status.errors?.[0]?.title || 'Delivery failed' }
                : {}),
            },
          });
        }
      }
    }
  } catch (err) {
    console.error('WhatsApp webhook processing error:', err);
  }
});

export default router;
