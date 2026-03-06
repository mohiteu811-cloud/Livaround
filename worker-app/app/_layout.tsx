import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { getToken, api } from '../src/lib/api';
import { registerForPushNotifications } from '../src/lib/notifications';

export default function RootLayout() {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    // Listen for notification taps — navigate to job detail
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const jobId = response.notification.request.content.data?.jobId as string | undefined;
      if (jobId) {
        router.push(`/job/${jobId}`);
      }
    });
    return () => sub.remove();
  }, []);

  async function checkAuth() {
    try {
      const token = await getToken();
      if (!token) {
        router.replace('/(auth)/login');
        return;
      }
      const user = await api.auth.me();
      if (user.role !== 'WORKER') {
        router.replace('/(auth)/login');
        return;
      }
      // Register push token
      const pushToken = await registerForPushNotifications();
      if (pushToken && user.worker?.id) {
        await api.workers.registerPushToken(user.worker.id, pushToken).catch(() => {});
      }
      router.replace('/(tabs)');
    } catch {
      router.replace('/(auth)/login');
    } finally {
      setChecked(true);
    }
  }

  if (!checked) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
