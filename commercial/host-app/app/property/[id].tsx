import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { api } from '../../src/lib/api';

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [property, setProperty] = useState<any>(null);
  const [audits, setAudits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.properties.get(id).then(setProperty).catch(() => {}),
      api.audits.listForProperty(id).then(setAudits).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ActivityIndicator color="#3b82f6" size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!property) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Text style={styles.errorText}>Property not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{property.name}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.propertyName}>{property.name}</Text>
          <Text style={styles.address}>{property.address}</Text>
          <Text style={styles.meta}>{property.city}, {property.country}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.statsRow}>
            <View style={styles.stat}><Text style={styles.statValue}>{property.bedrooms}</Text><Text style={styles.statLabel}>Bedrooms</Text></View>
            <View style={styles.stat}><Text style={styles.statValue}>{property.bathrooms}</Text><Text style={styles.statLabel}>Bathrooms</Text></View>
            <View style={styles.stat}><Text style={styles.statValue}>{property.maxGuests}</Text><Text style={styles.statLabel}>Max Guests</Text></View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Type</Text>
          <Text style={styles.value}>{property.type}</Text>
          <Text style={styles.label}>Status</Text>
          <Text style={[styles.value, { color: property.isActive ? '#4ade80' : '#fca5a5' }]}>
            {property.isActive ? 'Active' : 'Inactive'}
          </Text>
        </View>

        {property.description && (
          <View style={styles.card}>
            <Text style={styles.label}>Description</Text>
            <Text style={styles.value}>{property.description}</Text>
          </View>
        )}

        {audits.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Recent Audits</Text>
            {audits.slice(0, 5).map((audit: any) => (
              <TouchableOpacity
                key={audit.id}
                style={styles.card}
                onPress={() => router.push(`/audit/${audit.id}`)}
              >
                <View style={styles.auditRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.auditGuest}>{audit.booking?.guestName || 'Guest'}</Text>
                    <Text style={styles.auditDate}>
                      {audit.booking?.checkOut ? new Date(audit.booking.checkOut).toLocaleDateString() : ''}
                    </Text>
                  </View>
                  <View style={styles.auditStats}>
                    {audit.itemsMissing > 0 && (
                      <Text style={[styles.auditBadge, { color: '#fca5a5' }]}>
                        {audit.itemsMissing} missing
                      </Text>
                    )}
                    {audit.itemsDamaged > 0 && (
                      <Text style={[styles.auditBadge, { color: '#fdba74' }]}>
                        {audit.itemsDamaged} damaged
                      </Text>
                    )}
                    {audit.itemsMissing === 0 && audit.itemsDamaged === 0 && (
                      <Text style={[styles.auditBadge, { color: '#4ade80' }]}>All OK</Text>
                    )}
                  </View>
                </View>
                <View style={styles.auditStatusRow}>
                  <Text style={[styles.auditStatus, {
                    color: audit.status === 'completed' ? '#4ade80' : '#f59e0b',
                  }]}>
                    {audit.status === 'completed' ? 'Completed' : 'Pending Review'}
                  </Text>
                  {audit.overallScore != null && (
                    <Text style={styles.auditScore}>Score: {audit.overallScore.toFixed(1)}/5</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  backText: { color: '#3b82f6', fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#f8fafc', flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 24 },
  card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#334155' },
  propertyName: { fontSize: 20, fontWeight: '700', color: '#f8fafc', marginBottom: 4 },
  address: { fontSize: 14, color: '#94a3b8' },
  meta: { fontSize: 13, color: '#64748b', marginTop: 2 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700', color: '#3b82f6' },
  statLabel: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  label: { fontSize: 12, color: '#64748b', textTransform: 'uppercase', marginTop: 12, marginBottom: 2 },
  value: { fontSize: 15, color: '#e2e8f0' },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', marginTop: 8 },
  auditRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  auditGuest: { fontSize: 15, fontWeight: '600', color: '#f8fafc' },
  auditDate: { fontSize: 12, color: '#64748b', marginTop: 2 },
  auditStats: { alignItems: 'flex-end' },
  auditBadge: { fontSize: 12, fontWeight: '600' },
  auditStatusRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  auditStatus: { fontSize: 12, fontWeight: '500' },
  auditScore: { fontSize: 12, color: '#94a3b8' },
  errorText: { color: '#fca5a5', textAlign: 'center', marginTop: 40, fontSize: 16 },
});
