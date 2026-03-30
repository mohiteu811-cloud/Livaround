import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { api } from '../../src/lib/api';

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [workerModalVisible, setWorkerModalVisible] = useState(false);
  const [workers, setWorkers] = useState<any[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);

  const loadJob = useCallback(async () => {
    try {
      const data = await api.jobs.get(id);
      setJob(data);
    } catch {}
    setLoading(false);
  }, [id]);

  useEffect(() => { loadJob(); }, [loadJob]);

  const runAction = async (action: () => Promise<any>) => {
    setActing(true);
    try {
      await action();
      await loadJob();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Action failed');
    }
    setActing(false);
  };

  const handleAssignWorker = async () => {
    if (!job?.property?.id) {
      Alert.alert('Error', 'No property associated with this job');
      return;
    }
    setLoadingWorkers(true);
    setWorkerModalVisible(true);
    try {
      const data = await api.jobs.dispatchWorkers(job.property.id);
      setWorkers(data);
    } catch {
      Alert.alert('Error', 'Failed to load workers');
      setWorkerModalVisible(false);
    }
    setLoadingWorkers(false);
  };

  const handleDispatch = (workerId: string) => {
    setWorkerModalVisible(false);
    runAction(() => api.jobs.dispatch(id, workerId));
  };

  const handleCancel = () => {
    Alert.alert('Cancel Job', 'Are you sure you want to cancel this job?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive', onPress: () => runAction(() => api.jobs.cancel(id)) },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ActivityIndicator color="#3b82f6" size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!job) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Text style={styles.errorText}>Job not found</Text>
      </SafeAreaView>
    );
  }

  const canCancel = !['COMPLETED', 'CANCELLED'].includes(job.status);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
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

        {job.checklist && job.checklist.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.label}>Checklist</Text>
            {job.checklist.map((item: any, i: number) => (
              <View key={item.id || i} style={styles.checklistRow}>
                <Text style={styles.checkIcon}>{item.completed ? '☑' : '☐'}</Text>
                <Text style={[styles.value, item.completed && styles.completedText]}>{item.title || item.text}</Text>
              </View>
            ))}
          </View>
        )}

        {job.issues && job.issues.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.label}>Issues</Text>
            {job.issues.map((issue: any, i: number) => (
              <View key={issue.id || i} style={styles.issueRow}>
                <Text style={styles.issueSeverity}>{issue.severity || 'INFO'}</Text>
                <Text style={styles.value}>{issue.description || issue.title}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actionsCard}>
          {job.status === 'PENDING' && (
            <TouchableOpacity style={styles.primaryBtn} onPress={handleAssignWorker} disabled={acting}>
              <Text style={styles.btnText}>Assign Worker</Text>
            </TouchableOpacity>
          )}
          {job.status === 'DISPATCHED' && (
            <TouchableOpacity style={styles.primaryBtn} onPress={() => runAction(() => api.jobs.accept(id))} disabled={acting}>
              <Text style={styles.btnText}>Accept</Text>
            </TouchableOpacity>
          )}
          {job.status === 'ACCEPTED' && (
            <TouchableOpacity style={styles.primaryBtn} onPress={() => runAction(() => api.jobs.start(id))} disabled={acting}>
              <Text style={styles.btnText}>Start</Text>
            </TouchableOpacity>
          )}
          {job.status === 'IN_PROGRESS' && (
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: '#166534' }]} onPress={() => runAction(() => api.jobs.complete(id))} disabled={acting}>
              <Text style={styles.btnText}>Complete</Text>
            </TouchableOpacity>
          )}
          {canCancel && (
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} disabled={acting}>
              <Text style={styles.cancelBtnText}>Cancel Job</Text>
            </TouchableOpacity>
          )}
          {acting && <ActivityIndicator color="#3b82f6" style={{ marginTop: 12 }} />}
        </View>
      </ScrollView>

      {/* Worker picker modal */}
      <Modal visible={workerModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Worker</Text>
            {loadingWorkers ? (
              <ActivityIndicator color="#3b82f6" style={{ marginVertical: 24 }} />
            ) : (
              <FlatList
                data={workers}
                keyExtractor={(w) => w.id}
                style={{ maxHeight: 320 }}
                ListEmptyComponent={<Text style={styles.emptyWorkers}>No workers available</Text>}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.workerRow} onPress={() => handleDispatch(item.id)}>
                    <Text style={styles.workerName}>{item.user?.name || item.name || 'Unknown'}</Text>
                    {item.user?.email && <Text style={styles.workerEmail}>{item.user.email}</Text>}
                  </TouchableOpacity>
                )}
              />
            )}
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setWorkerModalVisible(false)}>
              <Text style={styles.modalCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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

  checklistRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  checkIcon: { fontSize: 16, color: '#94a3b8' },
  completedText: { textDecorationLine: 'line-through', color: '#64748b' },

  issueRow: { marginTop: 8 },
  issueSeverity: { fontSize: 11, fontWeight: '700', color: '#f59e0b', marginBottom: 2 },

  actionsCard: { gap: 10, marginTop: 4 },
  primaryBtn: {
    backgroundColor: '#3b82f6', borderRadius: 10, paddingVertical: 14,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: {
    borderRadius: 10, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#7f1d1d', backgroundColor: 'transparent',
  },
  cancelBtnText: { color: '#fca5a5', fontSize: 15, fontWeight: '600' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 32,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#f8fafc', marginBottom: 16 },
  workerRow: {
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#334155',
  },
  workerName: { fontSize: 15, color: '#e2e8f0', fontWeight: '600' },
  workerEmail: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  emptyWorkers: { color: '#64748b', textAlign: 'center', marginVertical: 24, fontSize: 14 },
  modalCloseBtn: {
    marginTop: 16, paddingVertical: 12, alignItems: 'center',
    borderRadius: 10, borderWidth: 1, borderColor: '#334155',
  },
  modalCloseBtnText: { color: '#94a3b8', fontSize: 15, fontWeight: '600' },
});
