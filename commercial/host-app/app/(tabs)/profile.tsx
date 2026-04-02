import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform, Linking, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { api, User, clearToken } from '../../src/lib/api';
import { disconnectSocket } from '../../src/lib/socket';

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [autoDispatch, setAutoDispatch] = useState(false);

  useEffect(() => {
    api.auth.me().then(setUser).catch(() => {});
    api.hostApp.getSettings().then(s => setAutoDispatch(s.autoDispatch)).catch(() => {});
  }, []);

  async function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          disconnectSocket();
          await clearToken();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  async function toggleAutoDispatch(val: boolean) {
    setAutoDispatch(val);
    try {
      await api.hostApp.updateSettings({ autoDispatch: val });
    } catch {
      setAutoDispatch(!val);
      Alert.alert('Error', 'Failed to update setting');
    }
  }

  function openBilling() {
    if (Platform.OS === 'ios') {
      Linking.openURL('https://livarounddashboard-production.up.railway.app/settings/billing');
    } else {
      router.push('/subscription');
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.header}>Profile</Text>

      {user && (
        <View style={styles.profileCard}>
          <Text style={styles.avatar}>👤</Text>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.email}>{user.email}</Text>
          {user.phone && <Text style={styles.phone}>{user.phone}</Text>}
        </View>
      )}

      <View style={styles.menu}>
        <TouchableOpacity style={styles.menuItem} onPress={openBilling}>
          <Text style={styles.menuEmoji}>💳</Text>
          <Text style={styles.menuText}>Subscription & Billing</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/notifications-settings')}>
          <Text style={styles.menuEmoji}>🔔</Text>
          <Text style={styles.menuText}>Notifications</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/workers')}>
          <Text style={styles.menuEmoji}>👷</Text>
          <Text style={styles.menuText}>Workers</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/properties')}>
          <Text style={styles.menuEmoji}>🏠</Text>
          <Text style={styles.menuText}>Properties</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>

        <View style={styles.menuItem}>
          <Text style={styles.menuEmoji}>⚡</Text>
          <Text style={styles.menuText}>Auto-Dispatch Jobs</Text>
          <Switch
            value={autoDispatch}
            onValueChange={toggleAutoDispatch}
            trackColor={{ false: '#334155', true: '#1d4ed8' }}
            thumbColor={autoDispatch ? '#3b82f6' : '#94a3b8'}
          />
        </View>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', paddingHorizontal: 16 },
  header: { fontSize: 24, fontWeight: '700', color: '#f8fafc', paddingTop: 8, paddingBottom: 12 },
  profileCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#334155', marginBottom: 24 },
  avatar: { fontSize: 48, marginBottom: 12 },
  name: { fontSize: 20, fontWeight: '700', color: '#f8fafc' },
  email: { fontSize: 14, color: '#94a3b8', marginTop: 4 },
  phone: { fontSize: 14, color: '#94a3b8', marginTop: 2 },
  menu: { gap: 8 },
  menuItem: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  menuEmoji: { fontSize: 20, marginRight: 12 },
  menuText: { fontSize: 15, color: '#f8fafc', flex: 1 },
  menuArrow: { fontSize: 20, color: '#64748b' },
  logoutButton: { backgroundColor: '#7f1d1d', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  logoutText: { color: '#fca5a5', fontSize: 16, fontWeight: '600' },
});
