interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default';
  priority?: 'high' | 'normal';
  channelId?: string;
}

export async function sendPushNotification(pushToken: string, message: Omit<ExpoPushMessage, 'to'>, retries = 3) {
  if (!pushToken.startsWith('ExponentPushToken')) {
    console.warn('Invalid push token format:', pushToken);
    return;
  }
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify({ to: pushToken, ...message }),
        signal: AbortSignal.timeout(10_000),
      });
      const result: { data?: { status?: string } } = await response.json();
      if (!response.ok || result.data?.status === 'error') {
        console.error('Expo push error:', JSON.stringify(result));
      } else {
        console.log('Push notification sent:', result.data?.status ?? 'ok');
      }
      return;
    } catch (err) {
      console.error(`Push notification attempt ${attempt}/${retries} failed:`, err);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
  }
}
