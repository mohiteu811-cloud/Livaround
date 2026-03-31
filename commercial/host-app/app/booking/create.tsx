import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { api } from '../../src/lib/api';

const SOURCES = ['DIRECT', 'AIRBNB', 'BOOKING_COM', 'VRBO', 'LIVAROUND'] as const;

export default function BookingCreateScreen() {
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guestCount, setGuestCount] = useState('1');
  const [totalAmount, setTotalAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [source, setSource] = useState<string>('DIRECT');
  const [notes, setNotes] = useState('');
  const [lockCode, setLockCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.properties.list().then((data) => {
      setProperties(data);
      if (data.length > 0) setPropertyId(data[0].id);
    }).catch(() => {});
  }, []);

  const handleSubmit = async () => {
    if (!propertyId || !guestName || !checkIn || !checkOut) {
      Alert.alert('Validation', 'Property, guest name, check-in, and check-out are required.');
      return;
    }
    setSubmitting(true);
    try {
      await api.bookings.create({
        propertyId,
        guestName,
        guestEmail: guestEmail || undefined,
        guestPhone: guestPhone || undefined,
        checkIn,
        checkOut,
        guestCount: parseInt(guestCount, 10) || 1,
        totalAmount: parseFloat(totalAmount) || 0,
        currency,
        source,
        notes: notes || undefined,
        lockCode: lockCode || undefined,
      });
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to create booking');
    }
    setSubmitting(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>&#8249; Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Booking</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Property Picker */}
        <Text style={styles.label}>Property</Text>
        <View style={styles.pickerRow}>
          {properties.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.chip, propertyId === p.id && styles.chipActive]}
              onPress={() => setPropertyId(p.id)}
            >
              <Text style={[styles.chipText, propertyId === p.id && styles.chipTextActive]}>{p.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Guest Name *</Text>
        <TextInput style={styles.input} value={guestName} onChangeText={setGuestName} placeholderTextColor="#475569" placeholder="Full name" />

        <Text style={styles.label}>Guest Email</Text>
        <TextInput style={styles.input} value={guestEmail} onChangeText={setGuestEmail} placeholderTextColor="#475569" placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none" />

        <Text style={styles.label}>Guest Phone</Text>
        <TextInput style={styles.input} value={guestPhone} onChangeText={setGuestPhone} placeholderTextColor="#475569" placeholder="+91 ..." keyboardType="phone-pad" />

        <Text style={styles.label}>Check-in (ISO) *</Text>
        <TextInput style={styles.input} value={checkIn} onChangeText={setCheckIn} placeholderTextColor="#475569" placeholder="2026-04-01T14:00:00Z" />

        <Text style={styles.label}>Check-out (ISO) *</Text>
        <TextInput style={styles.input} value={checkOut} onChangeText={setCheckOut} placeholderTextColor="#475569" placeholder="2026-04-05T11:00:00Z" />

        <Text style={styles.label}>Guest Count</Text>
        <TextInput style={styles.input} value={guestCount} onChangeText={setGuestCount} placeholderTextColor="#475569" placeholder="1" keyboardType="number-pad" />

        <Text style={styles.label}>Total Amount</Text>
        <TextInput style={styles.input} value={totalAmount} onChangeText={setTotalAmount} placeholderTextColor="#475569" placeholder="0" keyboardType="decimal-pad" />

        <Text style={styles.label}>Currency</Text>
        <TextInput style={styles.input} value={currency} onChangeText={setCurrency} placeholderTextColor="#475569" placeholder="INR" autoCapitalize="characters" />

        {/* Source Picker */}
        <Text style={styles.label}>Source</Text>
        <View style={styles.pickerRow}>
          {SOURCES.map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.chip, source === s && styles.chipActive]}
              onPress={() => setSource(s)}
            >
              <Text style={[styles.chipText, source === s && styles.chipTextActive]}>{s.replace('_', '.')}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Lock Code</Text>
        <TextInput style={styles.input} value={lockCode} onChangeText={setLockCode} placeholderTextColor="#475569" placeholder="Optional lock code" />

        <Text style={styles.label}>Notes</Text>
        <TextInput style={[styles.input, styles.textArea]} value={notes} onChangeText={setNotes} placeholderTextColor="#475569" placeholder="Any special instructions..." multiline numberOfLines={3} textAlignVertical="top" />

        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting} activeOpacity={0.8}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Create Booking</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backText: { color: '#3b82f6', fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#f8fafc' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', marginTop: 16, marginBottom: 6, fontWeight: '600' },
  input: { backgroundColor: '#1e293b', borderRadius: 10, padding: 14, fontSize: 15, color: '#f8fafc', borderWidth: 1, borderColor: '#334155' },
  textArea: { minHeight: 80 },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#1e293b', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#334155' },
  chipActive: { backgroundColor: '#1d4ed8', borderColor: '#3b82f6' },
  chipText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  submitBtn: { backgroundColor: '#3b82f6', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  submitBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
