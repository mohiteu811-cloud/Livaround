import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const API_URL = 'https://livaroundbackend-production.up.railway.app';
import { getToken } from '../../src/lib/api';

export default function IssuesScreen() {
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadIssues = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/issues`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIssues(data);
      }
    } catch (err) {
      console.error('Failed to load issues:', err);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadIssues();
  }, [loadIssues]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadIssues();
  }, [loadIssues]);

  const SEVERITY_COLORS: Record<string, string> = { HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#3b82f6' };
  const URGENCY_COLORS: Record<string, string> = { CRITICAL: '#dc2626', HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#3b82f6' };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Issues & Maintenance</Text>
      </View>
      {loading ? (
        <ActivityIndicator color="#3b82f6" size="large" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={issues}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
          renderItem={({ item }) => {
            const aiSuggestion = item.aiSuggestions?.[0];
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
                    {item.property && (
                      <Text style={styles.propertyName}>{item.property.name}</Text>
                    )}
                  </View>
                  <View style={[styles.badge, { backgroundColor: SEVERITY_COLORS[item.severity] || '#64748b' }]}>
                    <Text style={styles.badgeText}>{item.severity}</Text>
                  </View>
                </View>

                {item.reportedBy?.user?.name && (
                  <Text style={styles.meta}>
                    Reported by {item.reportedBy.user.name}
                  </Text>
                )}
                <Text style={styles.meta}>
                  {item.status} · {new Date(item.createdAt).toLocaleDateString()}
                </Text>

                {aiSuggestion && (
                  <View style={styles.aiCard}>
                    <View style={styles.aiHeader}>
                      <Ionicons name="sparkles" size={14} color="#a78bfa" />
                      <Text style={styles.aiLabel}>AI Analysis</Text>
                      {aiSuggestion.urgency && (
                        <View style={[styles.aiBadge, { backgroundColor: URGENCY_COLORS[aiSuggestion.urgency] || '#64748b' }]}>
                          <Text style={styles.aiBadgeText}>{aiSuggestion.urgency}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.aiSummary}>{aiSuggestion.summary}</Text>
                    {aiSuggestion.suggestedReply && (
                      <Text style={styles.aiReply}>
                        Recommended: {aiSuggestion.suggestedReply}
                      </Text>
                    )}
                    <Text style={styles.aiCategory}>{aiSuggestion.category}</Text>
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>No issues reported</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  backText: { color: '#3b82f6', fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#f8fafc' },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  description: { fontSize: 14, color: '#e2e8f0', fontWeight: '500' },
  propertyName: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  meta: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 40, fontSize: 14 },
  // AI suggestion card
  aiCard: { backgroundColor: '#1a1a2e', borderRadius: 8, padding: 12, marginTop: 10, borderWidth: 1, borderColor: '#7c3aed33' },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  aiLabel: { fontSize: 12, fontWeight: '600', color: '#a78bfa' },
  aiBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1, marginLeft: 'auto' },
  aiBadgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  aiSummary: { fontSize: 13, color: '#e2e8f0', lineHeight: 18 },
  aiReply: { fontSize: 12, color: '#94a3b8', marginTop: 6, fontStyle: 'italic' },
  aiCategory: { fontSize: 11, color: '#64748b', marginTop: 4 },
});
