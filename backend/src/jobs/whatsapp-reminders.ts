/**
 * Scheduled job that sends WhatsApp check-in and check-out reminders.
 *
 * - Check-in reminder: sent at ~09:00 the day before check-in
 * - Check-out reminder: sent at ~08:00 on the day of check-out
 *
 * Only sends to bookings where:
 * - guestPhone exists
 * - host has whatsappEnabled = true
 * - the same template hasn't already been sent for that booking (via WhatsAppLog)
 */

import { prisma } from '../lib/prisma';
import { isWhatsAppEnabled, sendCheckInReminder, sendCheckOutReminder, buildGuestLink, normalizePhoneNumber } from '../lib/whatsapp';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

async function sendCheckInReminders() {
  if (!isWhatsAppEnabled()) return;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Find bookings checking in tomorrow that haven't received a check-in reminder
  const bookings = await prisma.booking.findMany({
    where: {
      checkIn: { gte: startOfDay(tomorrow), lte: endOfDay(tomorrow) },
      status: 'CONFIRMED',
      guestPhone: { not: null },
      guestCode: { not: null },
      property: { host: { whatsappEnabled: true } },
    },
    include: {
      property: { select: { name: true, hostId: true } },
    },
  });

  for (const booking of bookings) {
    // Check if reminder already sent
    const existing = await prisma.whatsAppLog.findFirst({
      where: { bookingId: booking.id, template: 'checkin_reminder' },
    });
    if (existing) continue;

    const normalized = normalizePhoneNumber(booking.guestPhone!);
    if (!normalized) continue;

    const guestLink = buildGuestLink(booking.guestCode!);

    const result = await sendCheckInReminder({
      guestName: booking.guestName,
      guestPhone: booking.guestPhone!,
      propertyName: booking.property.name,
      checkIn: booking.checkIn.toISOString(),
      guestLink,
    });

    await prisma.whatsAppLog.create({
      data: {
        bookingId: booking.id,
        hostId: booking.property.hostId,
        phone: normalized,
        template: 'checkin_reminder',
        messageId: result.messageId,
        status: result.error ? 'FAILED' : 'SENT',
        errorMessage: result.error,
      },
    });

    console.log(`Check-in reminder ${result.error ? 'FAILED' : 'sent'} for booking ${booking.id}`);
  }
}

async function sendCheckOutReminders() {
  if (!isWhatsAppEnabled()) return;

  const today = new Date();

  // Find bookings checking out today that haven't received a check-out reminder
  const bookings = await prisma.booking.findMany({
    where: {
      checkOut: { gte: startOfDay(today), lte: endOfDay(today) },
      status: 'CHECKED_IN',
      guestPhone: { not: null },
      property: { host: { whatsappEnabled: true } },
    },
    include: {
      property: { select: { name: true, hostId: true } },
    },
  });

  for (const booking of bookings) {
    const existing = await prisma.whatsAppLog.findFirst({
      where: { bookingId: booking.id, template: 'checkout_reminder' },
    });
    if (existing) continue;

    const normalized = normalizePhoneNumber(booking.guestPhone!);
    if (!normalized) continue;

    // Extract check-out time (default 11:00 AM)
    const checkOutTime = booking.checkOut.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const result = await sendCheckOutReminder({
      guestName: booking.guestName,
      guestPhone: booking.guestPhone!,
      propertyName: booking.property.name,
      checkOutTime,
    });

    await prisma.whatsAppLog.create({
      data: {
        bookingId: booking.id,
        hostId: booking.property.hostId,
        phone: normalized,
        template: 'checkout_reminder',
        messageId: result.messageId,
        status: result.error ? 'FAILED' : 'SENT',
        errorMessage: result.error,
      },
    });

    console.log(`Check-out reminder ${result.error ? 'FAILED' : 'sent'} for booking ${booking.id}`);
  }
}

/**
 * Run all WhatsApp reminder jobs. Called by the scheduler.
 */
export async function runWhatsAppReminders() {
  try {
    console.log('Running WhatsApp reminders...');
    await sendCheckInReminders();
    await sendCheckOutReminders();
    console.log('WhatsApp reminders completed');
  } catch (err) {
    console.error('WhatsApp reminders error:', err);
  }
}

/**
 * Start the daily WhatsApp reminder scheduler.
 * Runs every day at 09:00 server time.
 */
export function startWhatsAppReminderScheduler() {
  if (!isWhatsAppEnabled()) {
    console.log('WhatsApp reminders: disabled (WHATSAPP_ENABLED is not true)');
    return;
  }

  console.log('WhatsApp reminder scheduler started (runs daily at 09:00)');

  function scheduleNextRun() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(9, 0, 0, 0);

    // If already past 09:00 today, schedule for tomorrow
    if (now >= next) {
      next.setDate(next.getDate() + 1);
    }

    const delay = next.getTime() - now.getTime();
    setTimeout(async () => {
      await runWhatsAppReminders();
      scheduleNextRun(); // Schedule next day
    }, delay);
  }

  scheduleNextRun();
}
