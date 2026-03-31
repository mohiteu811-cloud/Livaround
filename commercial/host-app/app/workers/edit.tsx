import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../../src/lib/api';
import type { Worker } from '../../src/lib/api';

const SKILL_OPTIONS = ['CLEANING', 'COOKING', 'DRIVING', 'MAINTENANCE', 'CARETAKER'] as const;

export default function WorkerEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [skills, setSkills] = useState<string[]>([]);

  useEffect(() => {
    if (!id) return;
    api.workers
      .get(id)
      .then((worker: Worker) => {
        setName(worker.user?.name || worker.name || '');
        setEmail(worker.user?.email || worker.email || '');
        setPhone(worker.user?.phone || worker.phone || '');
        setSkills(worker.skills || []);
      })
      .catch(() => {
        Alert.alert('Error', 'Failed to load worker.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const toggleSkill = (skill: string) => {
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Name is required.');
      return;
    }
    if (!isEdit && !email.trim()) {
      Alert.alert('Validation', 'Email is required.');
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await api.workers.update(id, { name: name.trim(), phone: phone.trim(), skills });
        Alert.alert('Success', 'Worker updated successfully.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        const res = await api.workers.create({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          skills,
        });
        const tempPassword = res.tempPassword || res.temporaryPassword || '';
        Alert.alert(
          'Worker Created',
          tempPassword
            ? `Worker created successfully.\n\nTemporary password:\n${tempPassword}\n\nPlease share this with the worker securely.`
            : 'Worker created successfully.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }
    } catch {
      Alert.alert('Error', `Failed to ${isEdit ? 'update' : 'create'} worker.`);
    } finally {
      setSaving(false);
    }
  };

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
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? 'Edit Worker' : 'Add Worker'}</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Full name"
            placeholderTextColor="#64748b"
            autoCapitalize="words"
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, isEdit && styles.inputDisabled]}
            value={email}
            onChangeText={setEmail}
            placeholder="email@example.com"
            placeholderTextColor="#64748b"
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!isEdit}
          />

          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Phone number"
            placeholderTextColor="#64748b"
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Skills</Text>
          <View style={styles.chipContainer}>
            {SKILL_OPTIONS.map((skill) => {
              const selected = skills.includes(skill);
              return (
                <TouchableOpacity
                  key={skill}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => toggleSkill(skill)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {skill}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>{isEdit ? 'Update Worker' : 'Create Worker'}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backText: { color: '#3b82f6', fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#f8fafc' },
  form: { paddingHorizontal: 16, paddingBottom: 40 },
  label: { color: '#cbd5e1', fontSize: 14, fontWeight: '600', marginTop: 20, marginBottom: 8 },
  input: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#f8fafc',
  },
  inputDisabled: {
    opacity: 0.5,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipSelected: {
    backgroundColor: '#1d4ed8',
    borderColor: '#3b82f6',
  },
  chipText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#fff',
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 32,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
