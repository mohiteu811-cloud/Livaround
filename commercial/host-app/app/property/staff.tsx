import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Modal, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { api, Worker, PropertyStaffAssignment } from '../../src/lib/api';

const ROLES = ['CARETAKER', 'CLEANER', 'SUPERVISOR'] as const;
const ROLE_COLORS: Record<string, string> = { CARETAKER: '#166534', CLEANER: '#1d4ed8', SUPERVISOR: '#7c3aed' };

export default function PropertyStaffScreen() {
  const { id, name: propertyName } = useLocalSearchParams<{ id: string; name?: string }>();
  const [staff, setStaff] = useState<PropertyStaffAssignment[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<typeof ROLES[number]>('CLEANER');

  const load = useCallback(async () => {
    try {
      const data = await api.propertyStaff.list(id);
      setStaff(data);
    } catch {}
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  async function openAddModal() {
    try {
      const w = await api.workers.list();
      const assignedIds = new Set(staff.map(s => s.workerId));
      setWorkers(w.filter(w => !assignedIds.has(w.id)));
      setSelectedWorker('');
      setSelectedRole('CLEANER');
      setShowModal(true);
    } catch {
      Alert.alert('Error', 'Failed to load workers');
    }
  }

  async function handleAssign() {
    if (!selectedWorker) { Alert.alert('Error', 'Select a worker'); return; }
    try {
      await api.propertyStaff.assign(id, { workerId: selectedWorker, role: selectedRole });
      setShowModal(false);
      load();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to assign');
    }
  }

  async function handleRemove(workerId: string, workerName: string) {
    Alert.alert('Remove Staff', `Remove ${workerName} from this property?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try { await api.propertyStaff.remove(id, workerId); load(); } catch { Alert.alert('Error', 'Failed to remove'); }
      }},
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>&#8249; Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Staff</Text>
        <TouchableOpacity onPress={openAddModal}>
          <Text style={styles.addText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {propertyName && <Text style={styles.subtitle}>{propertyName}</Text>}

      <FlatList
        data={staff}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.workerName}>{item.worker?.user?.name || 'Unknown'}</Text>
                <View style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[item.role] || '#64748b' }]}>
                  <Text style={styles.roleText}>{item.role}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => handleRemove(item.workerId, item.worker?.user?.name || 'this worker')}>
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No staff assigned</Text>}
      />

      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Assign Worker</Text>

            <Text style={styles.modalLabel}>Worker</Text>
            {workers.map((w) => (
              <TouchableOpacity key={w.id} style={[styles.modalOption, selectedWorker === w.id && styles.modalOptionActive]} onPress={() => setSelectedWorker(w.id)}>
                <Text style={[styles.modalOptionText, selectedWorker === w.id && styles.modalOptionTextActive]}>{w.user.name}</Text>
              </TouchableOpacity>
            ))}
            {workers.length === 0 && <Text style={styles.empty}>No available workers</Text>}

            <Text style={[styles.modalLabel, { marginTop: 16 }]}>Role</Text>
            <View style={styles.chipRow}>
              {ROLES.map((r) => (
                <TouchableOpacity key={r} style={[styles.chip, selectedRole === r && styles.chipActive]} onPress={() => setSelectedRole(r)}>
                  <Text style={[styles.chipText, selectedRole === r && styles.chipTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.assignBtn} onPress={handleAssign}>
                <Text style={styles.assignText}>Assign</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backText: { color: '#3b82f6', fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#f8fafc', flex: 1, textAlign: 'center' },
  addText: { color: '#3b82f6', fontSize: 15, fontWeight: '700' },
  subtitle: { color: '#94a3b8', fontSize: 13, paddingHorizontal: 16, marginBottom: 8 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#334155' },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  workerName: { fontSize: 16, fontWeight: '600', color: '#f8fafc', marginBottom: 6 },
  roleBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  roleText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  removeText: { color: '#fca5a5', fontSize: 13, fontWeight: '600' },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 40, fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1e293b', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '70%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#f8fafc', marginBottom: 16 },
  modalLabel: { fontSize: 12, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 },
  modalOption: { backgroundColor: '#0f172a', borderRadius: 10, padding: 14, marginBottom: 6, borderWidth: 1, borderColor: '#334155' },
  modalOptionActive: { borderColor: '#3b82f6', backgroundColor: '#1e3a8a' },
  modalOptionText: { color: '#94a3b8', fontSize: 14 },
  modalOptionTextActive: { color: '#93c5fd', fontWeight: '600' },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { backgroundColor: '#0f172a', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#334155' },
  chipActive: { backgroundColor: '#1e3a8a', borderColor: '#3b82f6' },
  chipText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#93c5fd' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: { flex: 1, backgroundColor: '#334155', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  cancelText: { color: '#94a3b8', fontSize: 15, fontWeight: '600' },
  assignBtn: { flex: 1, backgroundColor: '#3b82f6', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  assignText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
