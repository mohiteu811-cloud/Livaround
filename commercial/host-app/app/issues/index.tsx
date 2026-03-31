import { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

// Issues are loaded via the standard API
const API_URL = 'https://livaroundbackend-production.up.railway.app';
import { getToken } from '../../src/lib/api';

export default function IssuesScreen() {
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadIssues();
  }, []);

  async function loadIssues() {
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/issues`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIssues(data);
      }
    } catch {}
    setLoading(false);
  }

  const SEVERITY_COLORS: Record<string, string> = { HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#3b82f6' };

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
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
                <View style={[styles.badge, { backgroundColor: SEVERITY_COLORS[item.severity] || '#64748b' }]}>
                  <Text style={styles.badgeText}>{item.severity}</Text>
                </View>
              </View>
              <Text style={styles.meta}>
                {item.status} · {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </View>
          )}
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
  card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#334155' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  description: { fontSize: 14, color: '#e2e8f0', flex: 1 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  meta: { fontSize: 12, color: '#94a3b8', marginTop: 6 },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 40, fontSize: 14 },
});
