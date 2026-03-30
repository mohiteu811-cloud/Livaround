import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const from = () => `"LivAround" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`;

export async function sendPaymentSuspendedEmail({
  name,
  email,
  orgName,
}: {
  name: string;
  email: string;
  orgName: string;
}) {
  const billingUrl = `${process.env.APP_URL || 'http://localhost:3000'}/settings/billing`;

  await transporter.sendMail({
    from: from(),
    to: email,
    subject: `Action required: payment failed for ${orgName}`,
    text: [
      `Hi ${name},`,
      '',
      `We were unable to collect payment for your ${orgName} subscription.`,
      'Your account has been marked as past due.',
      '',
      'Please update your payment method to avoid service interruption:',
      `  ${billingUrl}`,
      '',
      'If you believe this is an error, reply to this email and we\'ll help.',
      '',
      '— LivAround',
    ].join('\n'),
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1e293b">
        <h2 style="color:#dc2626">Payment failed</h2>
        <p>Hi ${name},</p>
        <p>We were unable to collect payment for your <strong>${orgName}</strong> subscription.
           Your account has been marked as <strong>past due</strong>.</p>
        <p>Please update your payment method to avoid service interruption:</p>
        <p style="margin:20px 0">
          <a href="${billingUrl}"
             style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
            Update payment method
          </a>
        </p>
        <p style="color:#64748b;font-size:14px">
          If you believe this is an error, reply to this email and we'll help.
        </p>
        <p style="color:#64748b;font-size:14px">— LivAround</p>
      </div>
    `,
  });
}
