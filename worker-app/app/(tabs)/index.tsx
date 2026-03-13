import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Platform, StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { api, getToken, User, Job } from '../../src/lib/api';

const TABS = ['My Jobs', 'Available'] as const;
type TabType = typeof TABS[number];

const STATUS_COLOR: Record<string, string> = {
  DISPATCHED: '#f59e0b',
  ACCEPTED: '#3b82f6',
  IN_PROGRESS: '#8b5cf6',
  COMPLETED: '#10b981',
  CANCELLED: '#ef4444',
  PENDING: '#64748b',
};

const JOB_ICON: Record<string, string> = {
  CLEANING: '🧹',
  COOKING: '🍳',
  DRIVING: '🚗',
  MAINTENANCE: '🔨',
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function JobCard({ job, onPress, embedded }: { job: Job; onPress: () => void; embedded?: boolean }) {
  const color = STATUS_COLOR[job.status] ?? '#64748b';
  return (
    <TouchableOpacity style={embedded ? styles.cardEmbedded : styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <Text style={styles.jobIcon}>{JOB_ICON[job.type] ?? '🔧'}</Text>
        <View style={styles.cardInfo}>
          <Text style={styles.jobType}>{job.type}</Text>
          <Text style={styles.propertyName}>{job.property?.name ?? 'Property'}</Text>
          <Text style={styles.propertyCity}>{job.property?.city}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: color + '22', borderColor: color }]}>
          <Text style={[styles.statusText, { color }]}>{job.status.replace('_', ' ')}</Text>
        </View>
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.scheduledAt}>📅 {formatDate(job.scheduledAt)}</Text>
        {job.booking && (
          <Text style={styles.guestName}>👤 {job.booking.guestName}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function JobsScreen() {
  const [activeTab, setActiveTab] = useState<TabType>('My Jobs');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user) loadJobs();
  }, [user, activeTab]);

  async function loadUser() {
    try {
      const u = await api.auth.me();
      setUser(u);
    } catch {
      router.replace('/(auth)/login');
    }
  }

  const loadJobs = useCallback(async () => {
    if (!user?.worker) return;
    try {
      let data: Job[];
      if (activeTab === 'My Jobs') {
        data = await api.jobs.list();
        data = data.filter(j => ['DISPATCHED', 'ACCEPTED', 'IN_PROGRESS'].includes(j.status));
      } else {
        data = await api.jobs.available();
      }
      setJobs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, activeTab]);

  function onRefresh() {
    setRefreshing(true);
    loadJobs();
  }

  const displayJobs = jobs;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Jobs</Text>
        <Text style={styles.headerSub}>
          {user ? `Hey, ${user.name.split(' ')[0]} 👋` : ''}
        </Text>
      </View>

      <View style={styles.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color="#3b82f6" style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={displayJobs}
          keyExtractor={j => j.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
          renderItem={({ item }) => (
            <View style={activeTab === 'Available' ? styles.cardWithClaim : undefined}>
              <JobCard job={item} onPress={() => router.push(`/job/${item.id}`)} embedded={activeTab === 'Available'} />
              {activeTab === 'Available' && (
                <TouchableOpacity
                  style={styles.claimButton}
                  activeOpacity={0.7}
                  onPress={async () => {
                    try {
                      await api.jobs.claim(item.id);
                      loadJobs();
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                >
                  <Text style={styles.claimButtonText}>Claim Job</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>{activeTab === 'My Jobs' ? '✅' : '🎉'}</Text>
              <Text style={styles.emptyText}>
                {activeTab === 'My Jobs' ? 'No active jobs' : 'No available jobs right now'}
              </Text>
              <Text style={styles.emptySubtext}>Pull to refresh</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    paddingHorizontal: 20,
    paddingTop: (Platform.OS === 'android' ? (StatusBar.currentHeight ?? 44) : 44) + 12,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 28, fontWeight: '700', color: '#f8fafc' },
  headerSub: { fontSize: 14, color: '#94a3b8' },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: '#3b82f6' },
  tabText: { color: '#64748b', fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  list: { paddingHorizontal: 20, paddingBottom: 20, gap: 12 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardEmbedded: {
    backgroundColor: '#1e293b',
    padding: 16,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  jobIcon: { fontSize: 32, lineHeight: 40 },
  cardInfo: { flex: 1 },
  jobType: { fontSize: 16, fontWeight: '700', color: '#f8fafc' },
  propertyName: { fontSize: 14, color: '#94a3b8', marginTop: 2 },
  propertyCity: { fontSize: 12, color: '#64748b', marginTop: 1 },
  statusBadge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardFooter: { marginTop: 12, gap: 4 },
  scheduledAt: { fontSize: 13, color: '#94a3b8' },
  guestName: { fontSize: 13, color: '#94a3b8' },
  empty: { alignItems: 'center', marginTop: 80, gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#f8fafc' },
  emptySubtext: { fontSize: 14, color: '#64748b' },
  cardWithClaim: {
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  claimButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    alignItems: 'center',
  },
  claimButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
