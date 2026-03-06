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

export async function sendWorkerWelcomeEmail({
  name,
  email,
  tempPassword,
  workerAppUrl,
}: {
  name: string;
  email: string;
  tempPassword: string;
  workerAppUrl: string;
}) {
  await transporter.sendMail({
    from: `"Livaround" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: email,
    subject: 'Your Livaround worker account is ready',
    text: [
      `Hi ${name},`,
      '',
      'Your Livaround account has been created. Use the credentials below to log in:',
      '',
      `  App:      ${workerAppUrl}`,
      `  Email:    ${email}`,
      `  Password: ${tempPassword}`,
      '',
      'Please change your password after your first login.',
      '',
      '— Livaround',
    ].join('\n'),
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1e293b">
        <h2 style="color:#2563eb">Welcome to Livaround, ${name}!</h2>
        <p>Your worker account has been created. Use the credentials below to log in:</p>
        <div style="background:#f1f5f9;border-radius:8px;padding:16px 20px;margin:20px 0">
          <p style="margin:4px 0"><strong>App:</strong> <a href="${workerAppUrl}">${workerAppUrl}</a></p>
          <p style="margin:4px 0"><strong>Email:</strong> ${email}</p>
          <p style="margin:4px 0"><strong>Password:</strong> <code style="background:#e2e8f0;padding:2px 6px;border-radius:4px">${tempPassword}</code></p>
        </div>
        <p style="color:#64748b;font-size:14px">Please change your password after your first login.</p>
        <p style="color:#64748b;font-size:14px">— Livaround</p>
      </div>
    `,
  });
}
