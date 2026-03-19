import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { getToken, api } from '../src/lib/api';
import { registerForPushNotifications } from '../src/lib/notifications';
import { startLocationTracking } from '../src/lib/location';
import { initLang } from '../src/lib/i18n';

interface JobBanner {
  jobId: string;
  title: string;
  body: string;
}

export default function RootLayout() {
  const [checked, setChecked] = useState(false);
  const [banner, setBanner] = useState<JobBanner | null>(null);
  const translateY = useRef(new Animated.Value(-100)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    initLang().then(() => checkAuth());
  }, []);

  useEffect(() => {
    // Foreground notification — show in-app banner
    const foregroundSub = Notifications.addNotificationReceivedListener((notification) => {
      const jobId = notification.request.content.data?.jobId as string | undefined;
      if (!jobId) return;
      showBanner({
        jobId,
        title: notification.request.content.title ?? 'New Job',
        body: notification.request.content.body ?? '',
      });
    });

    // Notification tap — navigate to job detail
    const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const jobId = response.notification.request.content.data?.jobId as string | undefined;
      if (jobId) {
        router.push(`/job/${jobId}`);
      }
    });

    return () => {
      foregroundSub.remove();
      tapSub.remove();
    };
  }, []);

  function showBanner(b: JobBanner) {
    setBanner(b);
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
    dismissTimer.current = setTimeout(() => dismissBanner(), 6000);
  }

  function dismissBanner() {
    Animated.timing(translateY, { toValue: -120, useNativeDriver: true, duration: 300 }).start(() =>
      setBanner(null)
    );
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
  }

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
      router.replace('/(tabs)');

      // Register push token and start location tracking after navigation
      // (outside auth flow so failures don't redirect to login)
      try {
        const pushToken = await registerForPushNotifications();
        if (pushToken && user.worker?.id) {
          await api.workers.registerPushToken(user.worker.id, pushToken).catch(() => {});
        }
      } catch {}
      startLocationTracking().catch(() => {});
    } catch {
      router.replace('/(auth)/login');
    } finally {
      setChecked(true);
    }
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />

      {banner && (
        <Animated.View style={[styles.banner, { transform: [{ translateY }] }]}>
          <View style={styles.bannerContent}>
            <Text style={styles.bannerEmoji}>🔔</Text>
            <View style={styles.bannerText}>
              <Text style={styles.bannerTitle} numberOfLines={1}>{banner.title}</Text>
              <Text style={styles.bannerBody} numberOfLines={1}>{banner.body}</Text>
            </View>
          </View>
          <View style={styles.bannerActions}>
            <TouchableOpacity
              style={styles.viewButton}
              onPress={() => {
                dismissBanner();
                router.push(`/job/${banner.jobId}`);
              }}
            >
              <Text style={styles.viewButtonText}>View</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dismissButton} onPress={dismissBanner}>
              <Text style={styles.dismissText}>✕</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1e40af',
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 12,
    zIndex: 999,
  },
  bannerContent: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  bannerEmoji: { fontSize: 24 },
  bannerText: { flex: 1 },
  bannerTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  bannerBody: { color: '#bfdbfe', fontSize: 12, marginTop: 1 },
  bannerActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 8 },
  viewButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  viewButtonText: { color: '#1e40af', fontWeight: '700', fontSize: 13 },
  dismissButton: {
    backgroundColor: '#1e3a8a',
    borderRadius: 8,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissText: { color: '#93c5fd', fontSize: 13, fontWeight: '700' },
});
