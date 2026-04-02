import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert, ActivityIndicator, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { api, Property } from '../../src/lib/api';

const PROPERTY_TYPES = ['VILLA', 'APARTMENT', 'HOUSE', 'CONDO'];

export default function PropertyCreateScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [type, setType] = useState('VILLA');
  const [bedrooms, setBedrooms] = useState('1');
  const [bathrooms, setBathrooms] = useState('1');
  const [maxGuests, setMaxGuests] = useState('2');
  const [description, setDescription] = useState('');
  const [wifiName, setWifiName] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [checkInInstructions, setCheckInInstructions] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (isEdit) {
      api.properties.get(id).then((p) => {
        setName(p.name);
        setAddress(p.address);
        setCity(p.city);
        setCountry(p.country);
        setType(p.type);
        setBedrooms(String(p.bedrooms));
        setBathrooms(String(p.bathrooms));
        setMaxGuests(String(p.maxGuests));
        setDescription(p.description || '');
        setWifiName(p.wifiName || '');
        setWifiPassword(p.wifiPassword || '');
        setCheckInInstructions(p.checkInInstructions || '');
        setIsActive(p.isActive);
      }).catch(() => Alert.alert('Error', 'Failed to load property'))
        .finally(() => setLoading(false));
    }
  }, [id]);

  async function handleSave() {
    if (!name.trim() || !address.trim() || !city.trim() || !country.trim()) {
      Alert.alert('Error', 'Name, address, city and country are required');
      return;
    }
    setSaving(true);
    try {
      const data: Partial<Property> = {
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        country: country.trim(),
        type,
        bedrooms: parseInt(bedrooms) || 1,
        bathrooms: parseInt(bathrooms) || 1,
        maxGuests: parseInt(maxGuests) || 2,
        description: description.trim() || undefined,
        wifiName: wifiName.trim() || undefined,
        wifiPassword: wifiPassword.trim() || undefined,
        checkInInstructions: checkInInstructions.trim() || undefined,
        isActive,
      };
      if (isEdit) {
        await api.properties.update(id, data);
      } else {
        await api.properties.create(data);
      }
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save property');
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ActivityIndicator color="#3b82f6" size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? 'Edit Property' : 'New Property'}</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#3b82f6" size="small" /> : <Text style={styles.saveText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Basic Info</Text>
        <TextInput style={styles.input} placeholder="Property Name" placeholderTextColor="#64748b" value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="Address" placeholderTextColor="#64748b" value={address} onChangeText={setAddress} />
        <View style={styles.row}>
          <TextInput style={[styles.input, styles.halfInput]} placeholder="City" placeholderTextColor="#64748b" value={city} onChangeText={setCity} />
          <TextInput style={[styles.input, styles.halfInput]} placeholder="Country" placeholderTextColor="#64748b" value={country} onChangeText={setCountry} />
        </View>

        <Text style={styles.sectionTitle}>Type</Text>
        <View style={styles.chipRow}>
          {PROPERTY_TYPES.map((t) => (
            <TouchableOpacity key={t} style={[styles.chip, type === t && styles.chipActive]} onPress={() => setType(t)}>
              <Text style={[styles.chipText, type === t && styles.chipTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Capacity</Text>
        <View style={styles.row}>
          <View style={styles.counterBox}>
            <Text style={styles.counterLabel}>Bedrooms</Text>
            <TextInput style={styles.counterInput} keyboardType="number-pad" value={bedrooms} onChangeText={setBedrooms} />
          </View>
          <View style={styles.counterBox}>
            <Text style={styles.counterLabel}>Bathrooms</Text>
            <TextInput style={styles.counterInput} keyboardType="number-pad" value={bathrooms} onChangeText={setBathrooms} />
          </View>
          <View style={styles.counterBox}>
            <Text style={styles.counterLabel}>Max Guests</Text>
            <TextInput style={styles.counterInput} keyboardType="number-pad" value={maxGuests} onChangeText={setMaxGuests} />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Details</Text>
        <TextInput style={[styles.input, styles.textArea]} placeholder="Description" placeholderTextColor="#64748b" value={description} onChangeText={setDescription} multiline numberOfLines={3} />

        <Text style={styles.sectionTitle}>Guest Info</Text>
        <View style={styles.row}>
          <TextInput style={[styles.input, styles.halfInput]} placeholder="WiFi Name" placeholderTextColor="#64748b" value={wifiName} onChangeText={setWifiName} />
          <TextInput style={[styles.input, styles.halfInput]} placeholder="WiFi Password" placeholderTextColor="#64748b" value={wifiPassword} onChangeText={setWifiPassword} />
        </View>
        <TextInput style={[styles.input, styles.textArea]} placeholder="Check-in Instructions" placeholderTextColor="#64748b" value={checkInInstructions} onChangeText={setCheckInInstructions} multiline numberOfLines={3} />

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Active</Text>
          <Switch value={isActive} onValueChange={setIsActive} trackColor={{ false: '#334155', true: '#1d4ed8' }} thumbColor={isActive ? '#3b82f6' : '#94a3b8'} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backText: { color: '#94a3b8', fontSize: 15, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#f8fafc' },
  saveText: { color: '#3b82f6', fontSize: 15, fontWeight: '700' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginTop: 20, marginBottom: 8 },
  input: { backgroundColor: '#1e293b', borderRadius: 10, padding: 14, color: '#f8fafc', fontSize: 15, borderWidth: 1, borderColor: '#334155', marginBottom: 10 },
  halfInput: { flex: 1 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#1e293b', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#334155' },
  chipActive: { backgroundColor: '#1e3a8a', borderColor: '#3b82f6' },
  chipText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#93c5fd' },
  counterBox: { flex: 1, backgroundColor: '#1e293b', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
  counterLabel: { fontSize: 11, color: '#64748b', marginBottom: 4 },
  counterInput: { color: '#f8fafc', fontSize: 20, fontWeight: '700', textAlign: 'center', width: '100%' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1e293b', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#334155', marginTop: 16 },
  switchLabel: { color: '#f8fafc', fontSize: 15 },
});
