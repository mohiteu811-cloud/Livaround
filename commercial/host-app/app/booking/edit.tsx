import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { api, Booking } from '../../src/lib/api';

const SOURCES = ['DIRECT', 'AIRBNB', 'BOOKING_COM', 'VRBO', 'LIVAROUND'] as const;

export default function BookingEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

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
    api.bookings.get(id).then((b) => {
      setBooking(b);
      setGuestName(b.guestName || '');
      setGuestEmail(b.guestEmail || '');
      setGuestPhone(b.guestPhone || '');
      setCheckIn(b.checkIn || '');
      setCheckOut(b.checkOut || '');
      setGuestCount(String(b.guestCount || 1));
      setTotalAmount(String(b.totalAmount || ''));
      setCurrency(b.currency || 'INR');
      setSource(b.source || 'DIRECT');
      setNotes(b.notes || '');
      setLockCode(b.lockCode || '');
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async () => {
    if (!guestName || !checkIn || !checkOut) {
      Alert.alert('Validation', 'Guest name, check-in, and check-out are required.');
      return;
    }
    setSubmitting(true);
    try {
      await api.bookings.update(id, {
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
      Alert.alert('Error', 'Failed to update booking');
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ActivityIndicator color="#3b82f6" size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Text style={styles.errorText}>Booking not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>&#8249; Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Booking</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Property (read-only) */}
        {booking.property && (
          <>
            <Text style={styles.label}>Property</Text>
            <View style={styles.disabledField}>
              <Text style={styles.disabledText}>{booking.property.name}</Text>
            </View>
          </>
        )}

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
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Save Changes</Text>}
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
  disabledField: { backgroundColor: '#1e293b', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#334155', opacity: 0.6 },
  disabledText: { fontSize: 15, color: '#94a3b8' },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#1e293b', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#334155' },
  chipActive: { backgroundColor: '#1d4ed8', borderColor: '#3b82f6' },
  chipText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  submitBtn: { backgroundColor: '#3b82f6', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  submitBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  errorText: { color: '#fca5a5', textAlign: 'center', marginTop: 40, fontSize: 16 },
});
