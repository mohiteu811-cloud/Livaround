import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Guest Messages',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#3b82f6',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });

    await Notifications.setNotificationChannelAsync('jobs', {
      name: 'Job Notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 200, 400],
      lightColor: '#3b82f6',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
    });

    await Notifications.setNotificationChannelAsync('bookings', {
      name: 'Booking Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#3b82f6',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });

    await Notifications.setNotificationChannelAsync('issues', {
      name: 'Issues & Maintenance',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 200, 400],
      lightColor: '#ef4444',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
      bypassDnd: true,
    });
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    console.warn('No EAS projectId found — push token may not work in production builds');
  }

  const token = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );
  return token.data;
}
