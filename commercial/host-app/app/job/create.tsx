import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { api } from '../../src/lib/api';

const JOB_TYPES = ['CLEANING', 'COOKING', 'DRIVING', 'MAINTENANCE'] as const;

export default function JobCreateScreen() {
  const [properties, setProperties] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);

  const [propertyId, setPropertyId] = useState('');
  const [propertyName, setPropertyName] = useState('');
  const [type, setType] = useState<string>('CLEANING');
  const [scheduledAt, setScheduledAt] = useState('');
  const [notes, setNotes] = useState('');
  const [workerId, setWorkerId] = useState('');
  const [workerName, setWorkerName] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [propertyModalVisible, setPropertyModalVisible] = useState(false);
  const [typeModalVisible, setTypeModalVisible] = useState(false);
  const [workerModalVisible, setWorkerModalVisible] = useState(false);

  useEffect(() => {
    api.properties.list().then(setProperties).catch(() => {});
  }, []);

  const loadWorkers = async (propId: string) => {
    setLoadingWorkers(true);
    try {
      const data = await api.jobs.dispatchWorkers(propId);
      setWorkers(data);
    } catch {
      setWorkers([]);
    }
    setLoadingWorkers(false);
  };

  const selectProperty = (prop: any) => {
    setPropertyId(prop.id);
    setPropertyName(prop.name);
    setPropertyModalVisible(false);
    setWorkerId('');
    setWorkerName('');
    loadWorkers(prop.id);
  };

  const handleSubmit = async () => {
    if (!propertyId) { Alert.alert('Error', 'Please select a property'); return; }
    if (!scheduledAt.trim()) { Alert.alert('Error', 'Please enter a scheduled date/time'); return; }

    setSubmitting(true);
    try {
      await api.jobs.create({
        propertyId,
        type,
        scheduledAt: scheduledAt.trim(),
        notes: notes.trim() || undefined,
        workerId: workerId || undefined,
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create job');
    }
    setSubmitting(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Job</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Property picker */}
        <Text style={styles.label}>Property</Text>
        <TouchableOpacity style={styles.pickerBtn} onPress={() => setPropertyModalVisible(true)}>
          <Text style={propertyName ? styles.pickerText : styles.pickerPlaceholder}>
            {propertyName || 'Select property...'}
          </Text>
        </TouchableOpacity>

        {/* Job type picker */}
        <Text style={styles.label}>Job Type</Text>
        <TouchableOpacity style={styles.pickerBtn} onPress={() => setTypeModalVisible(true)}>
          <Text style={styles.pickerText}>{type}</Text>
        </TouchableOpacity>

        {/* Scheduled date/time */}
        <Text style={styles.label}>Scheduled Date/Time</Text>
        <TextInput
          style={styles.input}
          value={scheduledAt}
          onChangeText={setScheduledAt}
          placeholder="e.g. 2026-04-01T10:00:00Z"
          placeholderTextColor="#475569"
          autoCapitalize="none"
          autoCorrect={false}
        />

        {/* Notes */}
        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional notes..."
          placeholderTextColor="#475569"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* Worker assignment (optional) */}
        <Text style={styles.label}>Assign Worker (optional)</Text>
        <TouchableOpacity
          style={[styles.pickerBtn, !propertyId && styles.pickerDisabled]}
          onPress={() => propertyId && setWorkerModalVisible(true)}
          disabled={!propertyId}
        >
          <Text style={workerName ? styles.pickerText : styles.pickerPlaceholder}>
            {workerName || (propertyId ? 'Select worker...' : 'Select a property first')}
          </Text>
        </TouchableOpacity>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Create Job</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Property modal */}
      <Modal visible={propertyModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Property</Text>
            <FlatList
              data={properties}
              keyExtractor={(p) => p.id}
              style={{ maxHeight: 320 }}
              ListEmptyComponent={<Text style={styles.emptyList}>No properties found</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.modalRow} onPress={() => selectProperty(item)}>
                  <Text style={styles.modalRowText}>{item.name}</Text>
                  {item.address && <Text style={styles.modalRowSub}>{item.address}</Text>}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setPropertyModalVisible(false)}>
              <Text style={styles.modalCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Job type modal */}
      <Modal visible={typeModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Job Type</Text>
            {JOB_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.modalRow, t === type && styles.modalRowActive]}
                onPress={() => { setType(t); setTypeModalVisible(false); }}
              >
                <Text style={[styles.modalRowText, t === type && styles.modalRowActiveText]}>{t}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setTypeModalVisible(false)}>
              <Text style={styles.modalCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Worker modal */}
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
                ListEmptyComponent={<Text style={styles.emptyList}>No workers available</Text>}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalRow}
                    onPress={() => {
                      setWorkerId(item.id);
                      setWorkerName(item.user?.name || item.name || 'Worker');
                      setWorkerModalVisible(false);
                    }}
                  >
                    <Text style={styles.modalRowText}>{item.user?.name || item.name || 'Unknown'}</Text>
                    {item.user?.email && <Text style={styles.modalRowSub}>{item.user.email}</Text>}
                  </TouchableOpacity>
                )}
              />
            )}
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setWorkerModalVisible(false)}
            >
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
  content: { padding: 16, paddingBottom: 32 },
  label: { fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600', marginTop: 16, marginBottom: 6 },
  input: {
    backgroundColor: '#1e293b', borderRadius: 10, padding: 14,
    color: '#e2e8f0', fontSize: 15, borderWidth: 1, borderColor: '#334155',
  },
  textArea: { minHeight: 80 },
  pickerBtn: {
    backgroundColor: '#1e293b', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#334155',
  },
  pickerDisabled: { opacity: 0.5 },
  pickerText: { color: '#e2e8f0', fontSize: 15 },
  pickerPlaceholder: { color: '#475569', fontSize: 15 },
  submitBtn: {
    backgroundColor: '#3b82f6', borderRadius: 10, paddingVertical: 16,
    alignItems: 'center', marginTop: 28,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#1e293b', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 32,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#f8fafc', marginBottom: 16 },
  modalRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#334155' },
  modalRowActive: { backgroundColor: '#334155', borderRadius: 8, paddingHorizontal: 12 },
  modalRowText: { fontSize: 15, color: '#e2e8f0', fontWeight: '600' },
  modalRowActiveText: { color: '#3b82f6' },
  modalRowSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  emptyList: { color: '#64748b', textAlign: 'center', marginVertical: 24, fontSize: 14 },
  modalCloseBtn: {
    marginTop: 16, paddingVertical: 12, alignItems: 'center',
    borderRadius: 10, borderWidth: 1, borderColor: '#334155',
  },
  modalCloseBtnText: { color: '#94a3b8', fontSize: 15, fontWeight: '600' },
});
