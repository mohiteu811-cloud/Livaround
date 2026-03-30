import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { api, Property } from '../../src/lib/api';

export default function PropertiesScreen() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

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

  return (
    <SafeAreaView style={styles.container}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { fontSize: 24, fontWeight: '700', color: '#f8fafc', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
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
});
