import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { api } from '../../src/lib/api';
import type { Worker } from '../../src/lib/api';

export default function WorkersScreen() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);

  const loadWorkers = useCallback(() => {
    setLoading(true);
    api.workers.list().then(setWorkers).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadWorkers();
    }, [loadWorkers])
  );

  const handleDelete = (worker: Worker) => {
    const name = worker.user?.name || worker.name || 'this worker';
    Alert.alert(
      'Delete Worker',
      `Are you sure you want to delete ${name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.workers.delete(worker.id);
              setWorkers((prev) => prev.filter((w) => w.id !== worker.id));
            } catch {
              Alert.alert('Error', 'Failed to delete worker.');
            }
          },
        },
      ]
    );
  };

  const handleResetPassword = (worker: Worker) => {
    const name = worker.user?.name || worker.name || 'this worker';
    Alert.alert(
      'Reset Password',
      `Reset the password for ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: async () => {
            try {
              const res = await api.workers.resetPassword(worker.id);
              Alert.alert('Password Reset', `New temporary password:\n\n${res.tempPassword}\n\nPlease share this with the worker securely.`);
            } catch {
              Alert.alert('Error', 'Failed to reset password.');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ActivityIndicator color="#3b82f6" size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Workers</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/workers/edit')}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={workers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.7}
            onPress={() => router.push(`/workers/edit?id=${item.id}`)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.workerName}>{item.user?.name || item.name || 'Unknown'}</Text>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => router.push(`/workers/edit?id=${item.id}`)}
                >
                  <Text style={styles.actionBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.resetBtn]}
                  onPress={() => handleResetPassword(item)}
                >
                  <Text style={styles.actionBtnText}>Reset PW</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.deleteBtn]}
                  onPress={() => handleDelete(item)}
                >
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.availBadge, { backgroundColor: item.isAvailable ? '#166534' : '#7f1d1d' }]}>
                {item.isAvailable ? 'Available' : 'Unavailable'}
              </Text>
              {item.jobsCompleted != null && (
                <Text style={styles.meta}>{item.jobsCompleted} jobs completed</Text>
              )}
            </View>
          </TouchableOpacity>
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
  addButton: {
    backgroundColor: '#3b82f6',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: '#fff', fontSize: 22, fontWeight: '600', marginTop: -1 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#334155' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  workerName: { fontSize: 16, fontWeight: '600', color: '#f8fafc', flex: 1, marginRight: 8 },
  cardActions: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  actionBtnText: { color: '#93c5fd', fontSize: 12, fontWeight: '600' },
  resetBtn: { backgroundColor: '#1e3a5f' },
  deleteBtn: { backgroundColor: '#7f1d1d' },
  deleteBtnText: { color: '#fca5a5', fontSize: 12, fontWeight: '600' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  availBadge: { color: '#fff', fontSize: 11, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  meta: { fontSize: 12, color: '#94a3b8' },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 40, fontSize: 14 },
});
