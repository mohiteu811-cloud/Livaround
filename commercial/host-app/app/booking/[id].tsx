import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { api } from '../../src/lib/api';

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.bookings.get(id).then(setBooking).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#3b82f6" size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Booking not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Detail</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.guestName}>{booking.guestName}</Text>
          <Text style={styles.status}>{booking.status}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Check-in</Text>
          <Text style={styles.value}>{new Date(booking.checkIn).toLocaleDateString()}</Text>
          <Text style={styles.label}>Check-out</Text>
          <Text style={styles.value}>{new Date(booking.checkOut).toLocaleDateString()}</Text>
          <Text style={styles.label}>Guests</Text>
          <Text style={styles.value}>{booking.guestCount}</Text>
          <Text style={styles.label}>Amount</Text>
          <Text style={styles.value}>{booking.currency} {booking.totalAmount}</Text>
        </View>

        {booking.guestCode && (
          <View style={styles.card}>
            <Text style={styles.label}>Guest Link Code</Text>
            <Text style={styles.codeText}>{booking.guestCode}</Text>
          </View>
        )}

        {booking.notes && (
          <View style={styles.card}>
            <Text style={styles.label}>Notes</Text>
            <Text style={styles.value}>{booking.notes}</Text>
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
  guestName: { fontSize: 20, fontWeight: '700', color: '#f8fafc', marginBottom: 4 },
  status: { fontSize: 14, color: '#3b82f6', fontWeight: '600' },
  label: { fontSize: 12, color: '#64748b', textTransform: 'uppercase', marginTop: 12, marginBottom: 2 },
  value: { fontSize: 15, color: '#e2e8f0' },
  codeText: { fontSize: 18, fontWeight: '700', color: '#3b82f6', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  errorText: { color: '#fca5a5', textAlign: 'center', marginTop: 40, fontSize: 16 },
});
