interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default';
  priority?: 'high' | 'normal';
  channelId?: string;
}

export async function sendPushNotification(pushToken: string, message: Omit<ExpoPushMessage, 'to'>) {
  if (!pushToken.startsWith('ExponentPushToken')) return;
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify({ to: pushToken, ...message }),
    });
  } catch (err) {
    console.error('Push notification failed:', err);
  }
}
