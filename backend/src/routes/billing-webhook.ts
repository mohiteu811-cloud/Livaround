import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import {
  handleSubscriptionActivated,
  handlePaymentCompleted,
  handleSubscriptionCancelled,
} from '../../../lib/commercial/subscriptions';
import { sendPaymentSuspendedEmail } from '../lib/billing-email';

const router = Router();

// ── PayPal webhook signature verification ────────────────────────────────────

const PAYPAL_BASE =
  process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) throw new Error('PayPal credentials not configured');

  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function verifyWebhookSignature(req: Request, body: unknown): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    console.warn('[paypal-webhook] PAYPAL_WEBHOOK_ID not set — skipping verification');
    return false;
  }

  const token = await getPayPalAccessToken();

  const verifyPayload = {
    auth_algo: req.headers['paypal-auth-algo'],
    cert_url: req.headers['paypal-cert-url'],
    transmission_id: req.headers['paypal-transmission-id'],
    transmission_sig: req.headers['paypal-transmission-sig'],
    transmission_time: req.headers['paypal-transmission-time'],
    webhook_id: webhookId,
    webhook_event: body,
  };

  const res = await fetch(`${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(verifyPayload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[paypal-webhook] Signature verification request failed (${res.status}): ${text}`);
    return false;
  }

  const result = (await res.json()) as { verification_status: string };
  return result.verification_status === 'SUCCESS';
}

// ── Webhook handler ──────────────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response) => {
  const event = req.body as {
    event_type: string;
    resource: Record<string, unknown>;
  };

  const eventType = event?.event_type || 'UNKNOWN';
  const resourceId = (event?.resource?.id as string) || 'unknown';

  console.log(`[paypal-webhook] Received ${eventType} (resource: ${resourceId})`);

  // Verify signature — reject if verification fails
  try {
    const valid = await verifyWebhookSignature(req, req.body);
    if (!valid) {
      console.error(`[paypal-webhook] Signature verification FAILED for ${eventType}`);
      // Return 200 anyway to stop PayPal retries, but do not process
      return res.status(200).json({ received: true, verified: false });
    }
    console.log(`[paypal-webhook] Signature verified for ${eventType}`);
  } catch (err) {
    console.error('[paypal-webhook] Signature verification error:', err);
    return res.status(200).json({ received: true, verified: false });
  }

  // Process the event — always return 200, log errors but don't fail
  try {
    switch (eventType) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED': {
        const subId = event.resource.id as string;
        console.log(`[paypal-webhook] Processing subscription activated: ${subId}`);
        await handleSubscriptionActivated(subId, prisma);
        console.log(`[paypal-webhook] Subscription activated successfully: ${subId}`);
        break;
      }

      case 'PAYMENT.SALE.COMPLETED': {
        const billingAgreementId = event.resource.billing_agreement_id as string | undefined;
        const amountObj = event.resource.amount as { total?: string; value?: string } | undefined;
        const amount = parseFloat(amountObj?.total || amountObj?.value || '0');

        if (billingAgreementId) {
          console.log(`[paypal-webhook] Processing payment completed: sub=${billingAgreementId}, amount=${amount}`);
          await handlePaymentCompleted(billingAgreementId, amount, prisma);
          console.log(`[paypal-webhook] Payment processed and commissions calculated: ${billingAgreementId}`);
        } else {
          console.warn(`[paypal-webhook] PAYMENT.SALE.COMPLETED without billing_agreement_id — skipping`);
        }
        break;
      }

      case 'BILLING.SUBSCRIPTION.CANCELLED': {
        const subId = event.resource.id as string;
        console.log(`[paypal-webhook] Processing subscription cancelled: ${subId}`);
        await handleSubscriptionCancelled(subId, prisma);
        console.log(`[paypal-webhook] Subscription cancelled: ${subId}`);
        break;
      }

      case 'BILLING.SUBSCRIPTION.SUSPENDED': {
        const subId = event.resource.id as string;
        console.log(`[paypal-webhook] Processing subscription suspended: ${subId}`);

        const subscription = await prisma.subscription.findFirst({
          where: { paypalSubId: subId },
          include: {
            organization: {
              include: {
                host: {
                  include: { user: { select: { email: true, name: true } } },
                },
              },
            },
          },
        });

        if (subscription) {
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: 'past_due' },
          });

          // Send email notification to the org owner
          const user = subscription.organization.host?.user;
          if (user?.email) {
            await sendPaymentSuspendedEmail({
              name: user.name,
              email: user.email,
              orgName: subscription.organization.name,
            });
          }

          console.log(`[paypal-webhook] Subscription marked past_due, notification sent: ${subId}`);
        } else {
          console.warn(`[paypal-webhook] No local subscription found for PayPal sub: ${subId}`);
        }
        break;
      }

      default:
        console.log(`[paypal-webhook] Unhandled event type: ${eventType}`);
    }
  } catch (err) {
    // Log but don't fail — returning 200 prevents PayPal retry floods
    console.error(`[paypal-webhook] Error handling ${eventType}:`, err);
  }

  return res.status(200).json({ received: true });
});

export default router;
