import { Resend } from 'resend';

const FROM = 'Livinbnb <hello@livinbnb.com>';

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

// Sent to the person who just listed their home
export async function sendListingConfirmation({
  to, name, location, destination,
}: {
  to: string; name: string; location: string; destination: string;
}) {
  const resend = getResend();
  if (!resend) return;
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Your home in ${location} is live on Livinbnb`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;color:#1e293b">
        <h2 style="font-size:22px;font-weight:700;margin-bottom:8px">
          You're on the board, ${name}! 🏠
        </h2>
        <p style="color:#64748b;line-height:1.6">
          Your home in <strong>${location}</strong> is now publicly listed on Livinbnb.
          We're actively looking for exchange routes to <strong>${destination}</strong>.
        </p>
        <p style="color:#64748b;line-height:1.6">
          We run the matching algorithm every time a new home is listed —
          we'll email you the moment we find a 2, 3, or 4-way exchange that works for you.
        </p>
        <a href="https://livinbnb.up.railway.app"
           style="display:inline-block;margin-top:16px;background:#d98a2e;color:white;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600">
          View the board →
        </a>
        <p style="margin-top:32px;font-size:12px;color:#94a3b8">
          Livinbnb · Home exchange, reimagined
        </p>
      </div>
    `,
  });
}

// Sent to existing listers when someone lists in their destination
export async function sendDestinationAlert({
  to, recipientName, newListerName, newListerLocation, theirDestination, boardUrl,
}: {
  to: string; recipientName: string; newListerName: string;
  newListerLocation: string; theirDestination: string; boardUrl: string;
}) {
  const resend = getResend();
  if (!resend) return;
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Someone in ${newListerLocation} wants to go to ${theirDestination}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;color:#1e293b">
        <h2 style="font-size:22px;font-weight:700;margin-bottom:8px">
          New listing that might complete your exchange 🔥
        </h2>
        <p style="color:#64748b;line-height:1.6">
          Hi ${recipientName}, <strong>${newListerName}</strong> just listed a home
          in <strong>${newListerLocation}</strong> and wants to go to
          <strong>${theirDestination}</strong>.
        </p>
        <p style="color:#64748b;line-height:1.6">
          This could be part of a circular exchange that includes you.
          We're running the matching algorithm now —
          we'll let you know if a complete cycle is found.
        </p>
        <a href="${boardUrl}"
           style="display:inline-block;margin-top:16px;background:#d98a2e;color:white;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600">
          See the listing →
        </a>
        <p style="margin-top:32px;font-size:12px;color:#94a3b8">
          Livinbnb · Home exchange, reimagined
        </p>
      </div>
    `,
  });
}

// Sent to all participants when a complete cycle is found
export async function sendMatchFound({
  to, recipientName, cycleDescription, boardUrl,
}: {
  to: string; recipientName: string; cycleDescription: string; boardUrl: string;
}) {
  const resend = getResend();
  if (!resend) return;
  await resend.emails.send({
    from: FROM,
    to,
    subject: `🎉 Exchange match found — ${cycleDescription}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;color:#1e293b">
        <h2 style="font-size:22px;font-weight:700;margin-bottom:8px">
          We found your exchange, ${recipientName}! 🎉
        </h2>
        <p style="color:#64748b;line-height:1.6">
          A complete exchange cycle has been found:
        </p>
        <p style="font-size:18px;font-weight:600;background:#fdf8f0;padding:16px;border-radius:12px;text-align:center">
          ${cycleDescription}
        </p>
        <p style="color:#64748b;line-height:1.6">
          All participants have been notified. Head to the board to connect with your exchange partners.
        </p>
        <a href="${boardUrl}"
           style="display:inline-block;margin-top:16px;background:#22c55e;color:white;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600">
          View your match →
        </a>
        <p style="margin-top:32px;font-size:12px;color:#94a3b8">
          Livinbnb · Home exchange, reimagined
        </p>
      </div>
    `,
  });
}
