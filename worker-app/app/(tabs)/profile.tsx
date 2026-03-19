import { useState, useEffect } from 'react';
import {
  View, Text, Switch, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, Platform, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { api, clearToken, User } from '../../src/lib/api';
import { useLang, t } from '../../src/lib/i18n';

const SKILL_ICON: Record<string, string> = {
  CLEANING: '🧹',
  COOKING: '🍳',
  DRIVING: '🚗',
  MAINTENANCE: '🔨',
};

const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0;

export default function ProfileScreen() {
  const [lang, setLangVal] = useLang();
  const tr = t(lang);
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
      Alert.alert(tr.errorTitle, err.message);
    } finally {
      setToggling(false);
    }
  }

  async function handleLogout() {
    Alert.alert(tr.signOut, tr.signOutConfirm, [
      { text: tr.cancel, style: 'cancel' },
      {
        text: tr.signOut,
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
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.headerTitle}>{tr.profile}</Text>

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
          <StatCard label={tr.jobsDone} value={String(jobsCompleted)} icon="✅" />
          <StatCard label={tr.rating} value={rating ? `${rating.toFixed(1)} ⭐` : 'N/A'} icon="⭐" />
        </View>

        {/* Availability */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tr.availability}</Text>
          <View style={styles.availabilityRow}>
            <View style={styles.availabilityInfo}>
              <Text style={styles.availabilityLabel}>
                {available ? tr.availableForJobs : tr.notAvailable}
              </Text>
              <Text style={styles.availabilityDesc}>
                {available ? tr.availableDesc : tr.notAvailableDesc}
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
            <Text style={styles.sectionTitle}>{tr.skills}</Text>
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

        {/* Language */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tr.language}</Text>
          <View style={styles.langRow}>
            <TouchableOpacity
              style={[styles.langOption, lang === 'en' && styles.langOptionActive]}
              onPress={() => setLangVal('en')}
            >
              <Text style={[styles.langOptionText, lang === 'en' && styles.langOptionTextActive]}>
                {tr.english}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langOption, lang === 'hi' && styles.langOptionActive]}
              onPress={() => setLangVal('hi')}
            >
              <Text style={[styles.langOptionText, lang === 'hi' && styles.langOptionTextActive]}>
                {tr.hindi}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>{tr.signOut}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
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
  headerTitle: { fontSize: 28, fontWeight: '700', color: '#f8fafc', paddingTop: 8 },
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
  langRow: { flexDirection: 'row', gap: 10 },
  langOption: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    borderRadius: 10, borderWidth: 1.5, borderColor: '#334155',
    backgroundColor: '#0f172a',
  },
  langOptionActive: {
    borderColor: '#3b82f6', backgroundColor: '#3b82f6' + '18',
  },
  langOptionText: { fontSize: 15, fontWeight: '600', color: '#64748b' },
  langOptionTextActive: { color: '#3b82f6' },
  logoutButton: {
    borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    borderWidth: 1, borderColor: '#ef4444',
  },
  logoutText: { color: '#ef4444', fontSize: 16, fontWeight: '700' },
});
