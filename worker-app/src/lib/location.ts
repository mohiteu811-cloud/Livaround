import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { getToken } from './api';

const LOCATION_TASK = 'livaround-background-location';
const API_URL = 'https://livaroundbackend-production.up.railway.app';

// Send location to backend
async function sendLocation(latitude: number, longitude: number) {
  const token = await getToken();
  if (!token) return;

  try {
    await fetch(`${API_URL}/api/workers/me/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ latitude, longitude }),
    });
  } catch (err) {
    console.warn('Failed to send location:', err);
  }
}

// Define background task (must be at top level, outside components)
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background location error:', error);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const loc = locations[0];
    if (loc) {
      await sendLocation(loc.coords.latitude, loc.coords.longitude);
    }
  }
});

export async function requestLocationPermissions(): Promise<boolean> {
  const { status: foreground } = await Location.requestForegroundPermissionsAsync();
  if (foreground !== 'granted') return false;

  const { status: background } = await Location.requestBackgroundPermissionsAsync();
  return background === 'granted';
}

export async function startLocationTracking(): Promise<boolean> {
  const hasPermission = await requestLocationPermissions();
  if (!hasPermission) return false;

  const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
  if (isTracking) return true;

  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 15000,       // every 15 seconds
    distanceInterval: 10,      // or every 10 meters
    deferredUpdatesInterval: 15000,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'LivAround Worker',
      notificationBody: 'Location tracking is active',
      notificationColor: '#3b82f6',
    },
  });

  // Also send an immediate location update
  try {
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    await sendLocation(loc.coords.latitude, loc.coords.longitude);
  } catch {}

  return true;
}

export async function stopLocationTracking() {
  const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
  if (isTracking) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
}
