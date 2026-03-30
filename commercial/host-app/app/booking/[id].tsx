import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { api, Booking } from '../../src/lib/api';

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: '#1d4ed8',
  CHECKED_IN: '#166534',
  CHECKED_OUT: '#64748b',
  CANCELLED: '#7f1d1d',
};

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const load = () => {
    api.bookings.get(id).then(setBooking).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const handleCheckin = async () => {
    setActionLoading(true);
    try {
      await api.bookings.checkin(id);
      const updated = await api.bookings.get(id);
      setBooking(updated);
    } catch {
      Alert.alert('Error', 'Failed to check in');
    }
    setActionLoading(false);
  };

  const handleCheckout = async () => {
    setActionLoading(true);
    try {
      await api.bookings.checkout(id);
      const updated = await api.bookings.get(id);
      setBooking(updated);
    } catch {
      Alert.alert('Error', 'Failed to check out');
    }
    setActionLoading(false);
  };

  const handleDelete = () => {
    Alert.alert('Delete Booking', 'Are you sure you want to delete this booking? This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.bookings.delete(id);
            router.back();
          } catch {
            Alert.alert('Error', 'Failed to delete booking');
          }
        },
      },
    ]);
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
        <Text style={styles.headerTitle}>Booking Detail</Text>
        <TouchableOpacity onPress={() => router.push(`/booking/edit?id=${booking.id}`)}>
          <Text style={styles.editText}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Guest & Status */}
        <View style={styles.card}>
          <Text style={styles.guestName}>{booking.guestName}</Text>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[booking.status] || '#64748b' }]}>
            <Text style={styles.statusBadgeText}>{booking.status.replace('_', ' ')}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        {booking.status === 'CONFIRMED' && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.checkinBtn]}
            onPress={handleCheckin}
            disabled={actionLoading}
            activeOpacity={0.8}
          >
            {actionLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionBtnText}>Check In</Text>
            )}
          </TouchableOpacity>
        )}
        {booking.status === 'CHECKED_IN' && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.checkoutBtn]}
            onPress={handleCheckout}
            disabled={actionLoading}
            activeOpacity={0.8}
          >
            {actionLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionBtnText}>Check Out</Text>
            )}
          </TouchableOpacity>
        )}
        {booking.status === 'CHECKED_OUT' && (
          <View style={[styles.statusBanner, { backgroundColor: '#1e3a2e' }]}>
            <Text style={styles.statusBannerText}>Completed</Text>
          </View>
        )}
        {booking.status === 'CANCELLED' && (
          <View style={[styles.statusBanner, { backgroundColor: '#3b1c1c' }]}>
            <Text style={styles.statusBannerText}>Cancelled</Text>
          </View>
        )}

        {/* Dates & Guests */}
        <View style={styles.card}>
          <Text style={styles.label}>Check-in</Text>
          <Text style={styles.value}>{new Date(booking.checkIn).toLocaleDateString()}</Text>
          <Text style={styles.label}>Check-out</Text>
          <Text style={styles.value}>{new Date(booking.checkOut).toLocaleDateString()}</Text>
          <Text style={styles.label}>Guests</Text>
          <Text style={styles.value}>{booking.guestCount}</Text>
        </View>

        {/* Financial */}
        <View style={styles.card}>
          <Text style={styles.label}>Total Amount</Text>
          <Text style={styles.value}>{booking.currency} {booking.totalAmount}</Text>
          <Text style={styles.label}>Source</Text>
          <Text style={styles.value}>{booking.source}</Text>
        </View>

        {/* Contact */}
        <View style={styles.card}>
          <Text style={styles.label}>Guest Email</Text>
          <Text style={styles.value}>{booking.guestEmail || '-'}</Text>
          <Text style={styles.label}>Guest Phone</Text>
          <Text style={styles.value}>{booking.guestPhone || '-'}</Text>
        </View>

        {/* Codes */}
        <View style={styles.card}>
          <Text style={styles.label}>Guest Code</Text>
          <Text style={styles.codeText}>{booking.guestCode || '-'}</Text>
          <Text style={styles.label}>Lock Code</Text>
          <Text style={styles.codeText}>{booking.lockCode || '-'}</Text>
        </View>

        {/* Notes */}
        {booking.notes ? (
          <View style={styles.card}>
            <Text style={styles.label}>Notes</Text>
            <Text style={styles.value}>{booking.notes}</Text>
          </View>
        ) : null}

        {/* Delete */}
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.8}>
          <Text style={styles.deleteBtnText}>Delete Booking</Text>
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
  editText: { color: '#3b82f6', fontSize: 15, fontWeight: '600' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#334155' },
  guestName: { fontSize: 20, fontWeight: '700', color: '#f8fafc', marginBottom: 8 },
  statusBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  actionBtn: { borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  checkinBtn: { backgroundColor: '#166534' },
  checkoutBtn: { backgroundColor: '#1d4ed8' },
  actionBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  statusBanner: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  statusBannerText: { color: '#94a3b8', fontSize: 15, fontWeight: '600' },
  label: { fontSize: 12, color: '#64748b', textTransform: 'uppercase', marginTop: 12, marginBottom: 2 },
  value: { fontSize: 15, color: '#e2e8f0' },
  codeText: { fontSize: 18, fontWeight: '700', color: '#3b82f6', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  deleteBtn: { backgroundColor: '#7f1d1d', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  deleteBtnText: { color: '#fca5a5', fontSize: 15, fontWeight: '700' },
  errorText: { color: '#fca5a5', textAlign: 'center', marginTop: 40, fontSize: 16 },
});
