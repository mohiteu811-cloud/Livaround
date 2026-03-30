import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { api } from '../../src/lib/api';

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.jobs.get(id).then(setJob).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#3b82f6" size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!job) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Job not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Job Detail</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.jobType}>{job.type}</Text>
          <Text style={styles.status}>{job.status}</Text>
        </View>

        <View style={styles.card}>
          {job.property && (
            <>
              <Text style={styles.label}>Property</Text>
              <Text style={styles.value}>{job.property.name}</Text>
            </>
          )}
          <Text style={styles.label}>Scheduled</Text>
          <Text style={styles.value}>{new Date(job.scheduledAt).toLocaleString()}</Text>
          {job.worker && (
            <>
              <Text style={styles.label}>Assigned Worker</Text>
              <Text style={styles.value}>{job.worker.user?.name || 'Unknown'}</Text>
            </>
          )}
          {job.completedAt && (
            <>
              <Text style={styles.label}>Completed</Text>
              <Text style={styles.value}>{new Date(job.completedAt).toLocaleString()}</Text>
            </>
          )}
        </View>

        {job.notes && (
          <View style={styles.card}>
            <Text style={styles.label}>Notes</Text>
            <Text style={styles.value}>{job.notes}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  backText: { color: '#3b82f6', fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#f8fafc' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 24 },
  card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#334155' },
  jobType: { fontSize: 20, fontWeight: '700', color: '#f8fafc', marginBottom: 4 },
  status: { fontSize: 14, color: '#3b82f6', fontWeight: '600' },
  label: { fontSize: 12, color: '#64748b', textTransform: 'uppercase', marginTop: 12, marginBottom: 2 },
  value: { fontSize: 15, color: '#e2e8f0' },
  errorText: { color: '#fca5a5', textAlign: 'center', marginTop: 40, fontSize: 16 },
});
