import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  Modal, ScrollView, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { api, Property } from '../../src/lib/api';

const PROPERTY_TYPES = ['VILLA', 'APARTMENT', 'HOUSE', 'CONDO', 'COTTAGE'];

const INITIAL_FORM = {
  name: '',
  address: '',
  city: '',
  country: '',
  type: 'VILLA',
  bedrooms: '1',
  bathrooms: '1',
  maxGuests: '2',
};

export default function PropertiesScreen() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.properties.list();
      setProperties(data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.address.trim() || !form.city.trim() || !form.country.trim()) {
      Alert.alert('Required Fields', 'Please fill in name, address, city, and country.');
      return;
    }
    setSubmitting(true);
    try {
      await api.properties.create({
        name: form.name.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        country: form.country.trim(),
        type: form.type,
        bedrooms: parseInt(form.bedrooms) || 1,
        bathrooms: parseInt(form.bathrooms) || 1,
        maxGuests: parseInt(form.maxGuests) || 2,
      });
      setShowAddModal(false);
      setForm(INITIAL_FORM);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create property');
    }
    setSubmitting(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.header}>Properties</Text>
      <FlatList
        data={properties}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => router.push(`/property/${item.id}`)}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardName}>{item.name}</Text>
              <View style={[styles.statusBadge, item.isActive ? styles.active : styles.inactive]}>
                <Text style={styles.statusText}>{item.isActive ? 'Active' : 'Inactive'}</Text>
              </View>
            </View>
            <Text style={styles.cardAddress}>{item.address}</Text>
            <Text style={styles.cardMeta}>{item.city}, {item.country} · {item.bedrooms} bed · {item.bathrooms} bath · {item.maxGuests} guests</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>No properties found</Text> : null
        }
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Add Property Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add Property</Text>
              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                <Text style={styles.inputLabel}>Name *</Text>
                <TextInput
                  style={styles.input}
                  value={form.name}
                  onChangeText={(v) => setForm({ ...form, name: v })}
                  placeholder="e.g. Villa Sussegad"
                  placeholderTextColor="#475569"
                />

                <Text style={styles.inputLabel}>Address *</Text>
                <TextInput
                  style={styles.input}
                  value={form.address}
                  onChangeText={(v) => setForm({ ...form, address: v })}
                  placeholder="Full address"
                  placeholderTextColor="#475569"
                />

                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>City *</Text>
                    <TextInput
                      style={styles.input}
                      value={form.city}
                      onChangeText={(v) => setForm({ ...form, city: v })}
                      placeholder="City"
                      placeholderTextColor="#475569"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Country *</Text>
                    <TextInput
                      style={styles.input}
                      value={form.country}
                      onChangeText={(v) => setForm({ ...form, country: v })}
                      placeholder="Country"
                      placeholderTextColor="#475569"
                    />
                  </View>
                </View>

                <Text style={styles.inputLabel}>Type</Text>
                <View style={styles.typeRow}>
                  {PROPERTY_TYPES.map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.typeBtn, form.type === t && styles.typeBtnActive]}
                      onPress={() => setForm({ ...form, type: t })}
                    >
                      <Text style={[styles.typeBtnText, form.type === t && styles.typeBtnTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Bedrooms</Text>
                    <TextInput
                      style={styles.input}
                      value={form.bedrooms}
                      onChangeText={(v) => setForm({ ...form, bedrooms: v })}
                      keyboardType="numeric"
                      placeholderTextColor="#475569"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Bathrooms</Text>
                    <TextInput
                      style={styles.input}
                      value={form.bathrooms}
                      onChangeText={(v) => setForm({ ...form, bathrooms: v })}
                      keyboardType="numeric"
                      placeholderTextColor="#475569"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Max Guests</Text>
                    <TextInput
                      style={styles.input}
                      value={form.maxGuests}
                      onChangeText={(v) => setForm({ ...form, maxGuests: v })}
                      keyboardType="numeric"
                      placeholderTextColor="#475569"
                    />
                  </View>
                </View>
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowAddModal(false); setForm(INITIAL_FORM); }}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
                  {submitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.submitBtnText}>Add Property</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { fontSize: 24, fontWeight: '700', color: '#f8fafc', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 80 },
  card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardName: { fontSize: 16, fontWeight: '600', color: '#f8fafc', flex: 1 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  active: { backgroundColor: '#166534' },
  inactive: { backgroundColor: '#7f1d1d' },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  cardAddress: { fontSize: 13, color: '#94a3b8', marginBottom: 4 },
  cardMeta: { fontSize: 12, color: '#64748b' },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 40, fontSize: 14 },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '600', marginTop: -2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1e293b', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#f8fafc', marginBottom: 16 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: '#94a3b8', marginBottom: 4, marginTop: 12 },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 14,
  },
  row: { flexDirection: 'row', gap: 10 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  typeBtn: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#334155' },
  typeBtnActive: { backgroundColor: '#1e3a8a', borderColor: '#3b82f6' },
  typeBtnText: { fontSize: 11, fontWeight: '600', color: '#94a3b8' },
  typeBtnTextActive: { color: '#93c5fd' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1, borderRadius: 10, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  cancelBtnText: { color: '#94a3b8', fontSize: 15, fontWeight: '600' },
  submitBtn: { flex: 1, borderRadius: 10, paddingVertical: 14, alignItems: 'center', backgroundColor: '#3b82f6' },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
