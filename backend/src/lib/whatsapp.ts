/**
 * WhatsApp Business Cloud API (Meta) integration.
 *
 * Uses the Meta Graph API to send pre-approved template messages to guests.
 * Follows the same retry pattern as pushNotifications.ts.
 */

const WHATSAPP_API_VERSION = 'v21.0';

function getConfig() {
  return {
    enabled: process.env.WHATSAPP_ENABLED === 'true',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    appSecret: process.env.WHATSAPP_APP_SECRET || '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
    guestLinkBaseUrl: process.env.GUEST_LINK_BASE_URL || '',
  };
}

export function isWhatsAppEnabled(): boolean {
  const cfg = getConfig();
  return cfg.enabled && !!cfg.phoneNumberId && !!cfg.accessToken;
}

/**
 * Normalize a phone number to E.164 format.
 * Strips spaces, dashes, parentheses, dots. Ensures leading +.
 */
export function normalizePhoneNumber(phone: string): string | null {
  let cleaned = phone.replace(/[\s\-().]/g, '');
  if (!cleaned) return null;

  // If starts with 00, replace with +
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2);
  }
  // Ensure leading +
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  // Basic validation: + followed by 7-15 digits
  if (!/^\+\d{7,15}$/.test(cleaned)) return null;

  return cleaned;
}

// ── Meta Cloud API helpers ──────────────────────────────────────────────────

interface TemplateComponent {
  type: 'body' | 'header' | 'button';
  parameters: { type: 'text'; text: string }[];
  sub_type?: string;
  index?: number;
}

interface SendTemplatePayload {
  messaging_product: 'whatsapp';
  to: string;
  type: 'template';
  template: {
    name: string;
    language: { code: string };
    components?: TemplateComponent[];
  };
}

interface MetaApiResponse {
  messages?: { id: string }[];
  error?: { message: string; code: number };
}

async function sendTemplate(
  to: string,
  templateName: string,
  languageCode: string,
  bodyParams: string[],
  retries = 3,
): Promise<{ messageId: string | null; error: string | null }> {
  const cfg = getConfig();
  if (!cfg.enabled || !cfg.phoneNumberId || !cfg.accessToken) {
    return { messageId: null, error: 'WhatsApp is not configured' };
  }

  const normalized = normalizePhoneNumber(to);
  if (!normalized) {
    return { messageId: null, error: `Invalid phone number: ${to}` };
  }

  const payload: SendTemplatePayload = {
    messaging_product: 'whatsapp',
    to: normalized.replace('+', ''), // Meta API expects number without +
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: bodyParams.length > 0
        ? [{ type: 'body', parameters: bodyParams.map((text) => ({ type: 'text' as const, text })) }]
        : undefined,
    },
  };

  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${cfg.phoneNumberId}/messages`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.accessToken}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      });

      const result = (await response.json()) as MetaApiResponse;

      if (!response.ok || result.error) {
        const errMsg = result.error?.message || `HTTP ${response.status}`;
        console.error(`WhatsApp API error (attempt ${attempt}/${retries}):`, errMsg);
        if (attempt === retries) return { messageId: null, error: errMsg };
      } else {
        const messageId = result.messages?.[0]?.id ?? null;
        console.log('WhatsApp message sent:', messageId);
        return { messageId, error: null };
      }
    } catch (err) {
      console.error(`WhatsApp send attempt ${attempt}/${retries} failed:`, err);
      if (attempt === retries) {
        return { messageId: null, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    }

    // Exponential backoff
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }

  return { messageId: null, error: 'All retry attempts exhausted' };
}

// ── High-level message senders ──────────────────────────────────────────────

function formatDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export async function sendGuestLink({
  guestName,
  guestPhone,
  propertyName,
  checkIn,
  checkOut,
  guestLink,
}: {
  guestName: string;
  guestPhone: string;
  propertyName: string;
  checkIn: string | Date;
  checkOut: string | Date;
  guestLink: string;
}) {
  return sendTemplate(guestPhone, 'guest_stay_link', 'en', [
    guestName,
    propertyName,
    formatDate(checkIn),
    formatDate(checkOut),
    guestLink,
  ]);
}

export async function sendCheckInReminder({
  guestName,
  guestPhone,
  propertyName,
  checkIn,
  guestLink,
}: {
  guestName: string;
  guestPhone: string;
  propertyName: string;
  checkIn: string | Date;
  guestLink: string;
}) {
  return sendTemplate(guestPhone, 'checkin_reminder', 'en', [
    guestName,
    propertyName,
    formatDate(checkIn),
    guestLink,
  ]);
}

export async function sendCheckOutReminder({
  guestName,
  guestPhone,
  propertyName,
  checkOutTime,
}: {
  guestName: string;
  guestPhone: string;
  propertyName: string;
  checkOutTime: string;
}) {
  return sendTemplate(guestPhone, 'checkout_reminder', 'en', [
    guestName,
    propertyName,
    checkOutTime,
  ]);
}

// ── Webhook signature verification ──────────────────────────────────────────

import crypto from 'crypto';

export function verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
  const cfg = getConfig();
  if (!cfg.appSecret) return false;

  const expected = crypto
    .createHmac('sha256', cfg.appSecret)
    .update(rawBody)
    .digest('hex');

  return `sha256=${expected}` === signature;
}

export function getVerifyToken(): string {
  return getConfig().verifyToken;
}

export function buildGuestLink(guestCode: string): string {
  const base = getConfig().guestLinkBaseUrl;
  if (!base) return `/stay/${guestCode}`;
  return `${base.replace(/\/$/, '')}/stay/${guestCode}`;
}
