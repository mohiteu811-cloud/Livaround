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

export async function sendPartnerWelcomeEmail({
  name,
  email,
  referralCode,
  referralLink,
  dashboardUrl,
}: {
  name: string;
  email: string;
  referralCode: string;
  referralLink: string;
  dashboardUrl: string;
}) {
  await transporter.sendMail({
    from: `"LivAround Partners" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: email,
    subject: 'Welcome to the LivAround Partner Program!',
    text: [
      `Hi ${name},`,
      '',
      'Welcome to the LivAround Partner Program! You\'re now a Referral Partner earning 15% commission on every customer you refer.',
      '',
      '--- Your Referral Details ---',
      '',
      `  Referral Code: ${referralCode}`,
      `  Referral Link: ${referralLink}`,
      `  Dashboard:     ${dashboardUrl}`,
      '',
      '--- Quick Start Guide ---',
      '',
      '1. Share your referral link with property managers, Airbnb hosts, and hospitality businesses.',
      '2. When they sign up and subscribe, you earn 15% of their monthly subscription fee.',
      '3. Track your earnings in real-time on your Partner Dashboard.',
      '4. Payouts are processed monthly once you reach the $25 minimum threshold.',
      '',
      '--- Tips for Success ---',
      '',
      '- Share your link on social media with a brief explanation of how LivAround helps property managers.',
      '- Write a review or blog post about property management tools.',
      '- Reach out to property managers in your network directly.',
      '',
      '--- Tier Upgrades ---',
      '',
      'You start as a Referral Partner (15% commission). Once you have 10+ active customers with less than 30% churn, you\'ll auto-upgrade to Channel Partner (25% commission)!',
      '',
      'Questions? Reply to this email anytime.',
      '',
      'Happy referring!',
      '— The LivAround Team',
    ].join('\n'),
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
        <div style="background:linear-gradient(135deg,#2563eb,#06b6d4);border-radius:12px 12px 0 0;padding:32px 24px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:24px">Welcome to LivAround Partners!</h1>
          <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px">You're now a Referral Partner earning 15% commission</p>
        </div>

        <div style="background:#fff;padding:24px;border:1px solid #e2e8f0;border-top:0">
          <p>Hi ${name},</p>
          <p>Congratulations on joining the LivAround Partner Program! Here's everything you need to start earning.</p>

          <div style="background:#f1f5f9;border-radius:8px;padding:16px 20px;margin:20px 0">
            <p style="margin:4px 0;font-size:14px"><strong>Referral Code:</strong>
              <code style="background:#e2e8f0;padding:2px 8px;border-radius:4px;font-size:15px;font-weight:bold">${referralCode}</code>
            </p>
            <p style="margin:8px 0 4px;font-size:14px"><strong>Referral Link:</strong></p>
            <p style="margin:0"><a href="${referralLink}" style="color:#2563eb;word-break:break-all;font-size:13px">${referralLink}</a></p>
          </div>

          <a href="${dashboardUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin:8px 0 20px">
            Open Your Dashboard
          </a>

          <h3 style="color:#1e293b;font-size:16px;margin:24px 0 12px">Quick Start Guide</h3>
          <ol style="color:#475569;font-size:14px;line-height:1.8;padding-left:20px">
            <li>Share your referral link with property managers and Airbnb hosts</li>
            <li>When they sign up and subscribe, you earn <strong>15%</strong> of their monthly fee</li>
            <li>Track your earnings in real-time on your dashboard</li>
            <li>Payouts are processed monthly (min $25 threshold)</li>
          </ol>

          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:20px 0">
            <p style="margin:0;font-size:14px;color:#166534">
              <strong>Tier Upgrade:</strong> Get 10+ active customers with &lt;30% churn to auto-upgrade to
              <strong>Channel Partner (25% commission)</strong>!
            </p>
          </div>
        </div>

        <div style="background:#f8fafc;border-radius:0 0 12px 12px;padding:16px 24px;border:1px solid #e2e8f0;border-top:0">
          <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center">
            Questions? Reply to this email anytime. — The LivAround Team
          </p>
        </div>
      </div>
    `,
  });
}
