import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { api } from '../../src/lib/api';

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [property, setProperty] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.properties.get(id).then(setProperty).catch(() => {}).finally(() => setLoading(false));
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
  errorText: { color: '#fca5a5', textAlign: 'center', marginTop: 40, fontSize: 16 },
});
