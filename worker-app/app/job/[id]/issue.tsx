import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, SafeAreaView, ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../../../src/lib/api';

const SEVERITIES = [
  { value: 'LOW', label: 'Low', color: '#10b981', desc: 'Minor, non-urgent' },
  { value: 'MEDIUM', label: 'Medium', color: '#f59e0b', desc: 'Needs attention soon' },
  { value: 'HIGH', label: 'High', color: '#ef4444', desc: 'Urgent / safety issue' },
] as const;

type Severity = 'LOW' | 'MEDIUM' | 'HIGH';

export default function ReportIssueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<Severity>('MEDIUM');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!description.trim()) {
      Alert.alert('Required', 'Please describe the issue.');
      return;
    }
    setLoading(true);
    try {
      await api.jobs.reportIssue(id, { description: description.trim(), severity });
      Alert.alert('Issue Reported', 'The host has been notified.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report Issue</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Severity</Text>
        <View style={styles.severityRow}>
          {SEVERITIES.map(s => (
            <TouchableOpacity
              key={s.value}
              style={[
                styles.severityOption,
                severity === s.value && { borderColor: s.color, backgroundColor: s.color + '18' },
              ]}
              onPress={() => setSeverity(s.value)}
            >
              <Text style={[styles.severityLabel, severity === s.value && { color: s.color }]}>
                {s.label}
              </Text>
              <Text style={styles.severityDesc}>{s.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={styles.textarea}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe the issue in detail..."
          placeholderTextColor="#475569"
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitText}>⚠️  Submit Issue Report</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: { paddingVertical: 8 },
  backText: { color: '#3b82f6', fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#f8fafc' },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 12 },
  label: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
  },
  severityRow: { gap: 10 },
  severityOption: {
    borderWidth: 1.5,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#1e293b',
  },
  severityLabel: { fontSize: 15, fontWeight: '700', color: '#94a3b8' },
  severityDesc: { fontSize: 12, color: '#64748b', marginTop: 2 },
  textarea: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 14,
    color: '#f8fafc',
    fontSize: 15,
    minHeight: 140,
  },
  submitButton: {
    backgroundColor: '#ef4444',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
