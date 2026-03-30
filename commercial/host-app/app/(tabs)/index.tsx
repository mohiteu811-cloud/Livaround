import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { api, DashboardSummary } from '../../src/lib/api';

function StatCard({ label, value, emoji, onPress }: { label: string; value: number; emoji: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.statCard} onPress={onPress} disabled={!onPress}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function DashboardScreen() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    try {
      setError('');
      const data = await api.hostApp.dashboard();
      setSummary(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard');
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Dashboard</Text>

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
      >
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={loadDashboard}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {summary && (
          <>
            {/* Plan badge */}
            <View style={styles.planBadge}>
              <Text style={styles.planText}>
                {summary.subscription.plan.charAt(0).toUpperCase() + summary.subscription.plan.slice(1)} Plan
              </Text>
            </View>

            <View style={styles.statsGrid}>
              <StatCard emoji="🔑" label="Check-ins Today" value={summary.todayCheckIns} onPress={() => router.push('/(tabs)/bookings')} />
              <StatCard emoji="🚪" label="Check-outs Today" value={summary.todayCheckOuts} onPress={() => router.push('/(tabs)/bookings')} />
              <StatCard emoji="⏳" label="Pending Jobs" value={summary.pendingJobs} onPress={() => router.push('/(tabs)/jobs')} />
              <StatCard emoji="📅" label="Active Bookings" value={summary.activeBookings} onPress={() => router.push('/(tabs)/bookings')} />
              <StatCard emoji="💬" label="Unread Messages" value={summary.unreadMessages} onPress={() => router.push('/(tabs)/messages')} />
              <StatCard emoji="⚠️" label="Open Issues" value={summary.openIssues} />
            </View>

            <View style={styles.propertySummary}>
              <Text style={styles.propertyCount}>{summary.propertyCount}</Text>
              <Text style={styles.propertyLabel}>Properties Managed</Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { fontSize: 24, fontWeight: '700', color: '#f8fafc', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  scroll: { flex: 1, paddingHorizontal: 16 },
  errorBox: { backgroundColor: '#7f1d1d', borderRadius: 12, padding: 16, marginBottom: 16, alignItems: 'center' },
  errorText: { color: '#fca5a5', fontSize: 14, textAlign: 'center' },
  retryText: { color: '#3b82f6', fontSize: 14, fontWeight: '600', marginTop: 8 },
  planBadge: { backgroundColor: '#1e3a8a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start', marginBottom: 16 },
  planText: { color: '#93c5fd', fontSize: 13, fontWeight: '600' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, width: '47%', borderWidth: 1, borderColor: '#334155' },
  statEmoji: { fontSize: 24, marginBottom: 8 },
  statValue: { fontSize: 28, fontWeight: '700', color: '#f8fafc' },
  statLabel: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  propertySummary: { backgroundColor: '#1e293b', borderRadius: 12, padding: 20, marginTop: 16, marginBottom: 24, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  propertyCount: { fontSize: 36, fontWeight: '700', color: '#3b82f6' },
  propertyLabel: { fontSize: 14, color: '#94a3b8', marginTop: 4 },
});
