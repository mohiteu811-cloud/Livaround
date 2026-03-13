import { useState, useEffect } from 'react';
import {
  View, Text, Switch, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, Platform, StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { api, clearToken, User } from '../../src/lib/api';

const SKILL_ICON: Record<string, string> = {
  CLEANING: '🧹',
  COOKING: '🍳',
  DRIVING: '🚗',
  MAINTENANCE: '🔨',
};

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [available, setAvailable] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const u = await api.auth.me();
      setUser(u);
      setAvailable(u.worker?.isAvailable ?? false);
    } catch {
      router.replace('/(auth)/login');
    } finally {
      setLoading(false);
    }
  }

  async function toggleAvailability(value: boolean) {
    if (!user?.worker?.id) return;
    setToggling(true);
    try {
      await api.workers.updateAvailability(user.worker.id, value);
      setAvailable(value);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setToggling(false);
    }
  }

  async function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await clearToken();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#3b82f6" size="large" />
      </View>
    );
  }

  if (!user) return null;

  const skills = user.worker ? (user.worker as any).skills ?? [] : [];
  const rating = user.worker?.rating;
  const jobsCompleted = (user.worker as any)?.jobsCompleted ?? 0;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.headerTitle}>Profile</Text>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
          {user.phone && <Text style={styles.userPhone}>📱 {user.phone}</Text>}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatCard label="Jobs Done" value={String(jobsCompleted)} icon="✅" />
          <StatCard label="Rating" value={rating ? `${rating.toFixed(1)} ⭐` : 'N/A'} icon="⭐" />
        </View>

        {/* Availability */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Availability</Text>
          <View style={styles.availabilityRow}>
            <View style={styles.availabilityInfo}>
              <Text style={styles.availabilityLabel}>
                {available ? '🟢 Available for jobs' : '🔴 Not available'}
              </Text>
              <Text style={styles.availabilityDesc}>
                {available
                  ? 'You can receive new job assignments'
                  : 'You won\'t receive new assignments'}
              </Text>
            </View>
            {toggling
              ? <ActivityIndicator color="#3b82f6" />
              : (
                <Switch
                  value={available}
                  onValueChange={toggleAvailability}
                  trackColor={{ false: '#334155', true: '#3b82f6' }}
                  thumbColor="#fff"
                />
              )
            }
          </View>
        </View>

        {/* Skills */}
        {skills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Skills</Text>
            <View style={styles.skillsRow}>
              {skills.map((skill: string) => (
                <View key={skill} style={styles.skillBadge}>
                  <Text style={styles.skillIcon}>{SKILL_ICON[skill] ?? '🔧'}</Text>
                  <Text style={styles.skillText}>{skill}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Sign Out */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 20 },
  headerTitle: { fontSize: 28, fontWeight: '700', color: '#f8fafc', paddingTop: (Platform.OS === 'android' ? (StatusBar.currentHeight ?? 44) : 44) + 12 },
  avatarSection: { alignItems: 'center', paddingVertical: 20 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#fff' },
  userName: { fontSize: 22, fontWeight: '700', color: '#f8fafc' },
  userEmail: { fontSize: 14, color: '#94a3b8', marginTop: 4 },
  userPhone: { fontSize: 14, color: '#94a3b8', marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1, backgroundColor: '#1e293b', borderRadius: 16, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: '#334155', gap: 4,
  },
  statIcon: { fontSize: 24 },
  statValue: { fontSize: 20, fontWeight: '700', color: '#f8fafc' },
  statLabel: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  section: {
    backgroundColor: '#1e293b', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#334155', gap: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#f8fafc' },
  availabilityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  availabilityInfo: { flex: 1, marginRight: 12 },
  availabilityLabel: { fontSize: 15, fontWeight: '600', color: '#e2e8f0' },
  availabilityDesc: { fontSize: 12, color: '#64748b', marginTop: 2 },
  skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skillBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#0f172a', borderRadius: 10, paddingHorizontal: 12,
    paddingVertical: 8, borderWidth: 1, borderColor: '#334155',
  },
  skillIcon: { fontSize: 16 },
  skillText: { fontSize: 13, fontWeight: '600', color: '#94a3b8' },
  logoutButton: {
    borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    borderWidth: 1, borderColor: '#ef4444',
  },
  logoutText: { color: '#ef4444', fontSize: 16, fontWeight: '700' },
});
