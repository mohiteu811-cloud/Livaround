import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, SafeAreaView, ScrollView, Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../../src/lib/api';

const SEVERITIES = [
  { value: 'LOW',    label: 'Low',    color: '#10b981', desc: 'Minor, non-urgent' },
  { value: 'MEDIUM', label: 'Medium', color: '#f59e0b', desc: 'Needs attention soon' },
  { value: 'HIGH',   label: 'High',   color: '#ef4444', desc: 'Urgent / safety issue' },
] as const;

type Severity = 'LOW' | 'MEDIUM' | 'HIGH';

export default function ReportIssueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<Severity>('MEDIUM');
  const [photo, setPhoto] = useState<{ uri: string; type: string } | null>(null);
  const [video, setVideo] = useState<{ uri: string; type: string; duration?: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  async function requestPermission() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to media library in Settings.');
      return false;
    }
    return true;
  }

  async function pickPhoto() {
    if (!(await requestPermission())) return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPhoto({ uri: asset.uri, type: asset.mimeType ?? 'image/jpeg' });
    }
  }

  async function recordVideo() {
    const camPerm = await ImagePicker.requestCameraPermissionsAsync();
    if (camPerm.status !== 'granted') {
      Alert.alert('Permission required', 'Please allow camera access in Settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: 60,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setVideo({ uri: asset.uri, type: asset.mimeType ?? 'video/mp4', duration: asset.duration ?? undefined });
    }
  }

  async function pickVideoFromLibrary() {
    if (!(await requestPermission())) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setVideo({ uri: asset.uri, type: asset.mimeType ?? 'video/mp4', duration: asset.duration ?? undefined });
    }
  }

  async function handleSubmit() {
    if (!description.trim()) {
      Alert.alert('Required', 'Please describe the issue.');
      return;
    }
    setLoading(true);
    try {
      let videoUrl: string | undefined;
      if (video) {
        setUploading(true);
        const result = await api.upload.file(video.uri, video.type);
        videoUrl = result.url;
        setUploading(false);
      }

      await api.jobs.reportIssue(id, {
        description: description.trim(),
        severity,
        videoUrl,
      });

      Alert.alert('Issue Reported', 'The host has been notified.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      setUploading(false);
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  const durationLabel = video?.duration
    ? `${Math.round(video.duration)}s`
    : null;

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
        {/* Severity */}
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

        {/* Description */}
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={styles.textarea}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe the issue in detail..."
          placeholderTextColor="#475569"
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />

        {/* Photo */}
        <Text style={styles.label}>Photo</Text>
        {photo ? (
          <View style={styles.mediaPreview}>
            <Image source={{ uri: photo.uri }} style={styles.imagePreview} resizeMode="cover" />
            <TouchableOpacity style={styles.removeButton} onPress={() => setPhoto(null)}>
              <Text style={styles.removeText}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.mediaButton} onPress={pickPhoto}>
            <Text style={styles.mediaButtonText}>📷 Take Photo</Text>
          </TouchableOpacity>
        )}

        {/* Video */}
        <Text style={styles.label}>Video</Text>
        {video ? (
          <View style={styles.videoPreview}>
            <View style={styles.videoThumb}>
              <Text style={styles.videoIcon}>🎥</Text>
              <View>
                <Text style={styles.videoLabel}>Video recorded</Text>
                {durationLabel && (
                  <Text style={styles.videoDuration}>{durationLabel}</Text>
                )}
              </View>
            </View>
            <TouchableOpacity style={styles.removeButton} onPress={() => setVideo(null)}>
              <Text style={styles.removeText}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.videoButtons}>
            <TouchableOpacity style={[styles.mediaButton, { flex: 1 }]} onPress={recordVideo}>
              <Text style={styles.mediaButtonText}>🎥 Record</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.mediaButton, { flex: 1 }]} onPress={pickVideoFromLibrary}>
              <Text style={styles.mediaButtonText}>📁 Library</Text>
            </TouchableOpacity>
          </View>
        )}

        {uploading && (
          <View style={styles.uploadingBanner}>
            <ActivityIndicator color="#3b82f6" size="small" />
            <Text style={styles.uploadingText}>Uploading video…</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitButton, (loading || uploading) && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={loading || uploading}
        >
          {loading || uploading
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
    fontSize: 13, color: '#94a3b8', fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8,
  },
  severityRow: { gap: 10 },
  severityOption: {
    borderWidth: 1.5, borderColor: '#334155',
    borderRadius: 12, padding: 14, backgroundColor: '#1e293b',
  },
  severityLabel: { fontSize: 15, fontWeight: '700', color: '#94a3b8' },
  severityDesc: { fontSize: 12, color: '#64748b', marginTop: 2 },
  textarea: {
    backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155',
    borderRadius: 12, padding: 14, color: '#f8fafc', fontSize: 15, minHeight: 130,
  },
  mediaButton: {
    backgroundColor: '#1e293b', borderWidth: 1.5, borderColor: '#334155',
    borderStyle: 'dashed', borderRadius: 12, paddingVertical: 18,
    alignItems: 'center',
  },
  mediaButtonText: { color: '#94a3b8', fontSize: 15, fontWeight: '600' },
  mediaPreview: { position: 'relative' },
  imagePreview: { width: '100%', height: 200, borderRadius: 12, backgroundColor: '#1e293b' },
  videoButtons: { flexDirection: 'row', gap: 10 },
  videoPreview: {
    backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155',
    borderRadius: 12, padding: 14, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  videoThumb: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  videoIcon: { fontSize: 32 },
  videoLabel: { color: '#f8fafc', fontSize: 14, fontWeight: '600' },
  videoDuration: { color: '#64748b', fontSize: 12, marginTop: 2 },
  removeButton: {
    backgroundColor: '#334155', borderRadius: 20,
    width: 28, height: 28, alignItems: 'center', justifyContent: 'center',
  },
  removeText: { color: '#f8fafc', fontSize: 13, fontWeight: '700' },
  uploadingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1e3a5f', borderRadius: 12, padding: 14,
  },
  uploadingText: { color: '#93c5fd', fontSize: 14, fontWeight: '600' },
  submitButton: {
    backgroundColor: '#ef4444', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 12,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
