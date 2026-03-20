import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Modal, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { api } from '../../src/lib/api';
import { useLang, t } from '../../src/lib/i18n';

type JobType = 'CLEANING' | 'COOKING' | 'DRIVING' | 'MAINTENANCE';

const JOB_TYPES: { type: JobType; icon: string }[] = [
  { type: 'CLEANING', icon: '🧹' },
  { type: 'COOKING', icon: '🍳' },
  { type: 'DRIVING', icon: '🚗' },
  { type: 'MAINTENANCE', icon: '🔨' },
];

const PROPERTY_ICON: Record<string, string> = {
  VILLA: '🏖️', APARTMENT: '🏢', HOUSE: '🏠', HOTEL: '🏨',
};

interface AssignedProperty {
  id: string;
  name: string;
  city: string;
  address?: string;
  type?: string;
  staffRole: string;
}

export default function PropertiesScreen() {
  const [lang] = useLang();
  const tr = t(lang);
  const [properties, setProperties] = useState<AssignedProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<AssignedProperty | null>(null);
  const [jobType, setJobType] = useState<JobType>('CLEANING');
  const [notes, setNotes] = useState('');
  const [starting, setStarting] = useState(false);

  const loadProperties = useCallback(async () => {
    try {
      const data = await api.workers.myProperties();
      setProperties(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadProperties(); }, [loadProperties]);

  function openModal(property: AssignedProperty) {
    setSelectedProperty(property);
    setJobType('CLEANING');
    setNotes('');
    setModalVisible(true);
  }

  async function handleStartJob() {
    if (!selectedProperty) return;
    setStarting(true);
    try {
      const job = await api.jobs.selfStart({
        propertyId: selectedProperty.id,
        type: jobType,
        notes: notes.trim() || undefined,
      });
      setModalVisible(false);
      router.push(`/job/${job.id}`);
    } catch (err: any) {
      Alert.alert(tr.errorTitle, err.message || 'Failed to start job');
    } finally {
      setStarting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{tr.myProperties}</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#3b82f6" style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={properties}
          keyExtractor={p => p.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadProperties(); }}
              tintColor="#3b82f6"
            />
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.propIcon}>{PROPERTY_ICON[item.type ?? ''] ?? '🏠'}</Text>
                <View style={styles.cardInfo}>
                  <Text style={styles.propName}>{item.name}</Text>
                  <Text style={styles.propCity}>{item.city}</Text>
                  {item.address ? <Text style={styles.propAddress} numberOfLines={1}>{item.address}</Text> : null}
                  <View style={styles.rolePill}>
                    <Text style={styles.roleText}>{item.staffRole}</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity style={styles.startBtn} activeOpacity={0.7} onPress={() => openModal(item)}>
                <Text style={styles.startBtnText}>▶ {tr.startNewJob}</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🏠</Text>
              <Text style={styles.emptyText}>{tr.noPropertiesAssigned}</Text>
              <Text style={styles.emptySubtext}>{tr.pullToRefresh}</Text>
            </View>
          }
        />
      )}

      {/* Start Job bottom sheet */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.overlayTap} activeOpacity={1} onPress={() => setModalVisible(false)} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{tr.startNewJob}</Text>
            {selectedProperty && (
              <Text style={styles.sheetProp}>{selectedProperty.name} · {selectedProperty.city}</Text>
            )}

            <Text style={styles.label}>{tr.jobTypeLabel}</Text>
            <View style={styles.typeGrid}>
              {JOB_TYPES.map(({ type, icon }) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeBtn, jobType === type && styles.typeBtnActive]}
                  onPress={() => setJobType(type)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.typeIcon}>{icon}</Text>
                  <Text style={[styles.typeLabel, jobType === type && styles.typeLabelActive]}>
                    {type.charAt(0) + type.slice(1).toLowerCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>{tr.notes} <Text style={styles.labelOptional}>({tr.optional})</Text></Text>
            <TextInput
              style={styles.notesInput}
              placeholder={tr.notesPlaceholder}
              placeholderTextColor="#475569"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[styles.confirmBtn, starting && styles.confirmBtnDisabled]}
              activeOpacity={0.8}
              onPress={handleStartJob}
              disabled={starting}
            >
              <Text style={styles.confirmBtnText}>
                {starting ? tr.starting : `▶ ${tr.startJobNow}`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelBtnText}>{tr.cancel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { fontSize: 28, fontWeight: '700', color: '#f8fafc' },
  list: { paddingHorizontal: 20, paddingBottom: 20, gap: 12 },

  card: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#334155' },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  propIcon: { fontSize: 32, lineHeight: 40 },
  cardInfo: { flex: 1 },
  propName: { fontSize: 16, fontWeight: '700', color: '#f8fafc' },
  propCity: { fontSize: 14, color: '#94a3b8', marginTop: 2 },
  propAddress: { fontSize: 12, color: '#64748b', marginTop: 1 },
  rolePill: { marginTop: 6, alignSelf: 'flex-start', backgroundColor: '#1d4ed8', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  roleText: { fontSize: 11, fontWeight: '700', color: '#bfdbfe' },
  startBtn: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  startBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  empty: { alignItems: 'center', marginTop: 80, gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#f8fafc' },
  emptySubtext: { fontSize: 14, color: '#64748b' },

  // Modal
  overlay: { flex: 1, justifyContent: 'flex-end' },
  overlayTap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 },
  handle: { width: 40, height: 4, backgroundColor: '#475569', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: '#f8fafc', marginBottom: 4 },
  sheetProp: { fontSize: 14, color: '#94a3b8', marginBottom: 20 },

  label: { fontSize: 13, fontWeight: '600', color: '#94a3b8', marginBottom: 10 },
  labelOptional: { fontWeight: '400', color: '#64748b' },

  typeGrid: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  typeBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, backgroundColor: '#0f172a', borderRadius: 12, borderWidth: 1, borderColor: '#334155' },
  typeBtnActive: { backgroundColor: '#1d4ed8', borderColor: '#3b82f6' },
  typeIcon: { fontSize: 22 },
  typeLabel: { fontSize: 11, fontWeight: '600', color: '#64748b', marginTop: 4 },
  typeLabelActive: { color: '#fff' },

  notesInput: {
    backgroundColor: '#0f172a', borderRadius: 12, borderWidth: 1, borderColor: '#334155',
    color: '#f8fafc', padding: 12, fontSize: 14, textAlignVertical: 'top', minHeight: 72, marginBottom: 20,
  },

  confirmBtn: { backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelBtn: { paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { color: '#64748b', fontSize: 14, fontWeight: '600' },
});
