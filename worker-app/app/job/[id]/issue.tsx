import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../../src/lib/api';
import { useLang, t } from '../../../src/lib/i18n';
import { useVoiceInput } from '../../../src/lib/useVoice';

type Severity = 'LOW' | 'MEDIUM' | 'HIGH';

export default function ReportIssueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [lang] = useLang();
  const tr = t(lang);

  const SEVERITIES = [
    { value: 'LOW' as Severity,    label: tr.low,    color: '#10b981', desc: tr.lowDesc },
    { value: 'MEDIUM' as Severity, label: tr.medium, color: '#f59e0b', desc: tr.mediumDesc },
    { value: 'HIGH' as Severity,   label: tr.high,   color: '#ef4444', desc: tr.highDesc },
  ];

  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<Severity>('MEDIUM');

  const { listening, supported: voiceSupported, start: startVoice, stop: stopVoice } =
    useVoiceInput(lang, (transcript) => {
      setDescription(prev => prev ? `${prev} ${transcript}` : transcript);
    });
  const [photo, setPhoto] = useState<{ uri: string; type: string } | null>(null);
  const [video, setVideo] = useState<{ uri: string; type: string; duration?: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  async function requestPermission() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(tr.permissionRequired, tr.allowMediaAccess);
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
      Alert.alert(tr.permissionRequired, tr.allowCameraAccess);
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
      Alert.alert(tr.required, tr.describeIssue);
      return;
    }
    setLoading(true);
    try {
      let photoUrl: string | undefined;
      let videoUrl: string | undefined;

      if (photo || video) setUploading(true);
      if (photo) {
        const result = await api.upload.file(photo.uri, photo.type);
        photoUrl = result.url;
      }
      if (video) {
        const result = await api.upload.file(video.uri, video.type);
        videoUrl = result.url;
      }
      setUploading(false);

      await api.jobs.reportIssue(id, {
        description: description.trim(),
        severity,
        photoUrl,
        videoUrl,
      });

      Alert.alert(tr.issueReported, tr.hostNotified, [
        { text: tr.ok, onPress: () => router.back() },
      ]);
    } catch (err: any) {
      setUploading(false);
      Alert.alert(tr.errorTitle, err.message);
    } finally {
      setLoading(false);
    }
  }

  const durationLabel = video?.duration
    ? `${Math.round(video.duration)}s`
    : null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>{tr.back}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{tr.reportIssueTitle}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Severity */}
        <Text style={styles.label}>{tr.severity}</Text>
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
        <View style={styles.labelRow}>
          <Text style={styles.label}>{tr.description}</Text>
          {voiceSupported && (
            <TouchableOpacity
              style={[styles.voiceButton, listening && styles.voiceButtonActive]}
              onPress={listening ? stopVoice : startVoice}
            >
              <Text style={styles.voiceButtonText}>
                {listening ? tr.listening : tr.tapToSpeak}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <TextInput
          style={styles.textarea}
          value={description}
          onChangeText={setDescription}
          placeholder={tr.descriptionPlaceholder}
          placeholderTextColor="#475569"
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />

        {/* Photo */}
        <Text style={styles.label}>{tr.photo}</Text>
        {photo ? (
          <View style={styles.mediaPreview}>
            <Image source={{ uri: photo.uri }} style={styles.imagePreview} resizeMode="cover" />
            <TouchableOpacity style={styles.removeButton} onPress={() => setPhoto(null)}>
              <Text style={styles.removeText}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.mediaButton} onPress={pickPhoto}>
            <Text style={styles.mediaButtonText}>{tr.takePhoto}</Text>
          </TouchableOpacity>
        )}

        {/* Video */}
        <Text style={styles.label}>{tr.video}</Text>
        {video ? (
          <View style={styles.videoPreview}>
            <View style={styles.videoThumb}>
              <Text style={styles.videoIcon}>🎥</Text>
              <View>
                <Text style={styles.videoLabel}>{tr.videoRecorded}</Text>
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
              <Text style={styles.mediaButtonText}>{tr.record}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.mediaButton, { flex: 1 }]} onPress={pickVideoFromLibrary}>
              <Text style={styles.mediaButtonText}>{tr.library}</Text>
            </TouchableOpacity>
          </View>
        )}

        {uploading && (
          <View style={styles.uploadingBanner}>
            <ActivityIndicator color="#3b82f6" size="small" />
            <Text style={styles.uploadingText}>{tr.uploadingMedia}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitButton, (loading || uploading) && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={loading || uploading}
        >
          {loading || uploading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitText}>{tr.submitIssue}</Text>
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
  labelRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: 8,
  },
  label: {
    fontSize: 13, color: '#94a3b8', fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  voiceButton: {
    backgroundColor: '#1e293b', borderWidth: 1.5, borderColor: '#334155',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
  },
  voiceButtonActive: {
    borderColor: '#3b82f6', backgroundColor: '#1e3a5f',
  },
  voiceButtonText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
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
