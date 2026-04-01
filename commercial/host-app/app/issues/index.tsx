import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

const FILTERS = [
  { label: 'All', value: undefined },
  { label: 'Open', value: 'OPEN' },
  { label: 'In Review', value: 'IN_REVIEW' },
  { label: 'Resolved', value: 'RESOLVED' },
];

const SEVERITY_COLORS: Record<string, string> = { HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#3b82f6' };
const STATUS_COLORS: Record<string, string> = { OPEN: '#ef4444', IN_REVIEW: '#f59e0b', RESOLVED: '#10b981' };

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function IssuesScreen() {
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string | undefined>(undefined);

  const loadIssues = useCallback(async () => {
    try {
      const params: any = {};
      if (filter) params.status = filter;
      const data = await api.issues.list(params);
      setIssues(data);
    } catch (err) {
      console.error('Failed to load issues:', err);
    }
    setLoading(false);
    setRefreshing(false);
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    loadIssues();
  }, [loadIssues]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadIssues();
  }, [loadIssues]);

  const counts = {
    all: issues.length,
    OPEN: issues.filter(i => i.status === 'OPEN').length,
    IN_REVIEW: issues.filter(i => i.status === 'IN_REVIEW').length,
    RESOLVED: issues.filter(i => i.status === 'RESOLVED').length,
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Issues & Maintenance</Text>
      </View>

      {/* Filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={styles.filterContent}>
        {FILTERS.map(f => {
          const isActive = filter === f.value;
          const count = f.value ? counts[f.value as keyof typeof counts] : counts.all;
          return (
            <TouchableOpacity
              key={f.label}
              style={[styles.filterPill, isActive && styles.filterPillActive]}
              onPress={() => setFilter(f.value)}
            >
              <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                {f.label}{count > 0 ? ` (${count})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color="#3b82f6" size="large" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={issues}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
          renderItem={({ item }) => {
            const hasPendingAI = item.aiSuggestions?.length > 0;
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => router.push(`/issues/${item.id}`)}
              >
                <View style={styles.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.description} numberOfLines={1}>{item.description}</Text>
                    <View style={styles.metaRow}>
                      {item.property && <Text style={styles.propertyName}>{item.property.name}</Text>}
                      <Text style={styles.dot}> · </Text>
                      <Text style={styles.timeText}>{timeAgo(item.createdAt)}</Text>
                    </View>
                  </View>
                  <View style={styles.badges}>
                    <View style={[styles.badge, { backgroundColor: SEVERITY_COLORS[item.severity] || '#64748b' }]}>
                      <Text style={styles.badgeText}>{item.severity}</Text>
                    </View>
                    {hasPendingAI && (
                      <Ionicons name="sparkles" size={16} color="#a78bfa" style={{ marginLeft: 6 }} />
                    )}
                  </View>
                </View>
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[item.status] || '#64748b' }]} />
                  <Text style={styles.statusText}>{item.status.replace('_', ' ')}</Text>
                  {item.reportedBy?.user?.name && (
                    <>
                      <Text style={styles.dot}> · </Text>
                      <Text style={styles.statusText}>{item.reportedBy.user.name}</Text>
                    </>
                  )}
                  <Ionicons name="chevron-forward" size={14} color="#475569" style={{ marginLeft: 'auto' }} />
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {filter ? `No ${filter.toLowerCase().replace('_', ' ')} issues` : 'No issues reported'}
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  headerBar: { paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#f8fafc' },
  filterBar: { maxHeight: 44, marginBottom: 4 },
  filterContent: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  filterPill: { backgroundColor: '#1e293b', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: '#334155' },
  filterPillActive: { backgroundColor: '#1e3a5f', borderColor: '#3b82f6' },
  filterText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#3b82f6' },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#334155' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  description: { fontSize: 14, color: '#e2e8f0', fontWeight: '500' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  propertyName: { fontSize: 12, color: '#94a3b8' },
  timeText: { fontSize: 12, color: '#64748b' },
  dot: { fontSize: 12, color: '#475569' },
  badges: { flexDirection: 'row', alignItems: 'center' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusText: { fontSize: 12, color: '#64748b' },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 40, fontSize: 14 },
});
