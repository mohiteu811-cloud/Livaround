import { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { api } from '../../src/lib/api';

export default function WorkersScreen() {
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.workers.list().then(setWorkers).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#3b82f6" size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Workers</Text>
      </View>
      <FlatList
        data={workers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.workerName}>{item.user?.name || item.name || 'Unknown'}</Text>
            <View style={styles.detailRow}>
              <Text style={[styles.availBadge, { backgroundColor: item.isAvailable ? '#166534' : '#7f1d1d' }]}>
                {item.isAvailable ? 'Available' : 'Unavailable'}
              </Text>
              {item.jobsCompleted != null && (
                <Text style={styles.meta}>{item.jobsCompleted} jobs completed</Text>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No workers found</Text>}
      />
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
  workerName: { fontSize: 16, fontWeight: '600', color: '#f8fafc', marginBottom: 6 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  availBadge: { color: '#fff', fontSize: 11, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  meta: { fontSize: 12, color: '#94a3b8' },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 40, fontSize: 14 },
});
