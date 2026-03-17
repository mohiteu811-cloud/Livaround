import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { api, Job } from '../../src/lib/api';

const STATUS_COLOR: Record<string, string> = {
  DISPATCHED: '#f59e0b',
  ACCEPTED: '#3b82f6',
  IN_PROGRESS: '#8b5cf6',
  COMPLETED: '#10b981',
  CANCELLED: '#ef4444',
};

const JOB_ICON: Record<string, string> = {
  CLEANING: '🧹',
  COOKING: '🍳',
  DRIVING: '🚗',
  MAINTENANCE: '🔨',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [checklist, setChecklist] = useState<{ item: string; done: boolean }[]>([]);
  const [completionPhoto, setCompletionPhoto] = useState<{ uri: string; type: string } | null>(null);
  const [completionVideo, setCompletionVideo] = useState<{ uri: string; type: string; duration?: number } | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadJob();
  }, [id]);

  async function loadJob() {
    try {
      const data = await api.jobs.get(id);
      setJob(data);
      setChecklist(data.checklist ?? []);
    } catch (err: any) {
      Alert.alert('Error', err.message);
      router.back();
    } finally {
      setLoading(false);
    }
  }

  function toggleChecklist(index: number) {
    setChecklist(prev =>
      prev.map((item, i) => i === index ? { ...item, done: !item.done } : item)
    );
  }

  async function handleAction(action: 'accept' | 'start' | 'complete') {
    if (action === 'complete') {
      const undone = checklist.filter(c => !c.done);
      if (undone.length > 0) {
        Alert.alert(
          'Incomplete Checklist',
          `${undone.length} item(s) not checked off. Complete anyway?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Complete', style: 'destructive', onPress: () => doAction(action) },
          ]
        );
        return;
      }
    }
    doAction(action);
  }

  async function takeCompletionPhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow camera access in Settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setCompletionPhoto({ uri: asset.uri, type: asset.mimeType ?? 'image/jpeg' });
    }
  }

  async function recordCompletionVideo() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
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
      setCompletionVideo({ uri: asset.uri, type: asset.mimeType ?? 'video/mp4', duration: asset.duration ?? undefined });
    }
  }

  async function pickCompletionVideoFromLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to media library in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setCompletionVideo({ uri: asset.uri, type: asset.mimeType ?? 'video/mp4', duration: asset.duration ?? undefined });
    }
  }

  async function doAction(action: 'accept' | 'start' | 'complete') {
    setActionLoading(true);
    try {
      if (action === 'complete') {
        let completionPhotoUrl: string | undefined;
        let completionVideoUrl: string | undefined;
        if (completionPhoto) {
          setUploading(true);
          const res = await api.upload.file(completionPhoto.uri, completionPhoto.type);
          completionPhotoUrl = res.url;
        }
        if (completionVideo) {
          setUploading(true);
          const res = await api.upload.file(completionVideo.uri, completionVideo.type);
          completionVideoUrl = res.url;
        }
        setUploading(false);
        const updated = await api.jobs.complete(id, { completionPhotoUrl, completionVideoUrl });
        setJob(updated);
        Alert.alert('✅ Job Complete!', 'Great work! The job has been marked as completed.', [
          { text: 'Back to Jobs', onPress: () => router.replace('/(tabs)') },
        ]);
      } else {
        const updated = await api.jobs[action](id);
        setJob(updated);
      }
    } catch (err: any) {
      setUploading(false);
      Alert.alert('Error', err.message);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#3b82f6" size="large" />
      </View>
    );
  }

  if (!job) return null;

  const color = STATUS_COLOR[job.status] ?? '#64748b';
  const checklistDone = checklist.filter(c => c.done).length;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={[styles.statusBadge, { backgroundColor: color + '22', borderColor: color }]}>
          <Text style={[styles.statusText, { color }]}>{job.status.replace('_', ' ')}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Job Title */}
        <View style={styles.titleRow}>
          <Text style={styles.jobIcon}>{JOB_ICON[job.type] ?? '🔧'}</Text>
          <View>
            <Text style={styles.jobType}>{job.type}</Text>
            <Text style={styles.propertyName}>{job.property?.name}</Text>
            <Text style={styles.propertyCity}>{job.property?.city}</Text>
          </View>
        </View>

        {/* Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <InfoRow icon="📅" label="Scheduled" value={formatDate(job.scheduledAt)} />
          {job.booking && (
            <>
              <InfoRow icon="👤" label="Guest" value={job.booking.guestName} />
              <InfoRow icon="🗓" label="Check-in" value={formatDate(job.booking.checkIn)} />
              <InfoRow icon="🗓" label="Check-out" value={formatDate(job.booking.checkOut)} />
            </>
          )}
          {job.notes && <InfoRow icon="📝" label="Notes" value={job.notes} />}
        </View>

        {/* Property Briefing — shown once accepted */}
        {job.property && ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(job.status) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Property Briefing</Text>
            {job.property.address && (
              <InfoRow icon="📍" label="Address" value={job.property.address} />
            )}
            {job.property.wifiName && (
              <InfoRow icon="📶" label="Wi-Fi Network" value={job.property.wifiName} />
            )}
            {job.property.wifiPassword && (
              <InfoRow icon="🔑" label="Wi-Fi Password" value={job.property.wifiPassword} />
            )}
            {job.property.lockCode && (
              <InfoRow icon="🚪" label="Door Code" value={job.property.lockCode} />
            )}
          </View>
        )}

        {/* Checklist */}
        {checklist.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Checklist</Text>
              <Text style={styles.checklistProgress}>
                {checklistDone}/{checklist.length}
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${checklist.length ? (checklistDone / checklist.length) * 100 : 0}%` },
                ]}
              />
            </View>
            {checklist.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={styles.checklistItem}
                onPress={() => toggleChecklist(i)}
                activeOpacity={0.7}
                disabled={job.status === 'COMPLETED'}
              >
                <View style={[styles.checkbox, item.done && styles.checkboxDone]}>
                  {item.done && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={[styles.checklistText, item.done && styles.checklistTextDone]}>
                  {item.item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Actions */}
        {job.status !== 'COMPLETED' && job.status !== 'CANCELLED' && (
          <View style={styles.actionsSection}>
            {job.status === 'DISPATCHED' && (
              <ActionButton
                label="Accept Job"
                color="#3b82f6"
                loading={actionLoading}
                onPress={() => handleAction('accept')}
              />
            )}
            {job.status === 'ACCEPTED' && (
              <ActionButton
                label="Start Job"
                color="#8b5cf6"
                loading={actionLoading}
                onPress={() => handleAction('start')}
              />
            )}
            {job.status === 'IN_PROGRESS' && (
              <>
                {/* Completion Media */}
                <View style={styles.mediaSection}>
                  <Text style={styles.mediaSectionTitle}>Completion Evidence</Text>
                  <Text style={styles.mediaSectionHint}>Take a photo or video before marking complete</Text>

                  {/* Photo */}
                  {completionPhoto ? (
                    <View style={styles.mediaPreview}>
                      <Image source={{ uri: completionPhoto.uri }} style={styles.imagePreview} resizeMode="cover" />
                      <TouchableOpacity style={styles.removeMedia} onPress={() => setCompletionPhoto(null)}>
                        <Text style={styles.removeMediaText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.mediaCapture} onPress={takeCompletionPhoto}>
                      <Text style={styles.mediaCaptureText}>📷 Take Photo</Text>
                    </TouchableOpacity>
                  )}

                  {/* Video */}
                  {completionVideo ? (
                    <View style={styles.videoInfo}>
                      <View style={styles.videoInfoLeft}>
                        <Text style={styles.videoIcon}>🎥</Text>
                        <View>
                          <Text style={styles.videoLabel}>Video recorded</Text>
                          {completionVideo.duration != null && (
                            <Text style={styles.videoDuration}>{Math.round(completionVideo.duration)}s</Text>
                          )}
                        </View>
                      </View>
                      <TouchableOpacity style={styles.removeMedia} onPress={() => setCompletionVideo(null)}>
                        <Text style={styles.removeMediaText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.videoButtons}>
                      <TouchableOpacity style={[styles.mediaCapture, { flex: 1 }]} onPress={recordCompletionVideo}>
                        <Text style={styles.mediaCaptureText}>🎥 Record</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.mediaCapture, { flex: 1 }]} onPress={pickCompletionVideoFromLibrary}>
                        <Text style={styles.mediaCaptureText}>📁 Library</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {uploading && (
                  <View style={styles.uploadingBanner}>
                    <ActivityIndicator color="#3b82f6" size="small" />
                    <Text style={styles.uploadingText}>Uploading media…</Text>
                  </View>
                )}

                <ActionButton
                  label="Mark Complete ✅"
                  color="#10b981"
                  loading={actionLoading}
                  onPress={() => handleAction('complete')}
                />
              </>
            )}
            {(job.status === 'ACCEPTED' || job.status === 'IN_PROGRESS') && (
              <TouchableOpacity
                style={styles.issueButton}
                onPress={() => router.push(`/job/${id}/issue`)}
              >
                <Text style={styles.issueButtonText}>⚠️ Report an Issue</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function ActionButton({ label, color, loading, onPress }: {
  label: string; color: string; loading: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionButton, { backgroundColor: color }]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.8}
    >
      {loading
        ? <ActivityIndicator color="#fff" />
        : <Text style={styles.actionButtonText}>{label}</Text>
      }
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: { paddingVertical: 8 },
  backText: { color: '#3b82f6', fontSize: 16, fontWeight: '600' },
  statusBadge: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontSize: 12, fontWeight: '700' },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 8 },
  jobIcon: { fontSize: 48 },
  jobType: { fontSize: 24, fontWeight: '700', color: '#f8fafc' },
  propertyName: { fontSize: 16, color: '#94a3b8', marginTop: 4 },
  propertyCity: { fontSize: 13, color: '#64748b', marginTop: 2 },
  section: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 12,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#f8fafc' },
  checklistProgress: { fontSize: 14, fontWeight: '600', color: '#3b82f6' },
  progressBarBg: { height: 6, backgroundColor: '#334155', borderRadius: 3 },
  progressBarFill: { height: 6, backgroundColor: '#3b82f6', borderRadius: 3 },
  infoRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  infoIcon: { fontSize: 18, lineHeight: 24 },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 11, color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 14, color: '#e2e8f0', marginTop: 2 },
  checklistItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2,
    borderColor: '#475569', alignItems: 'center', justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: '#10b981', borderColor: '#10b981' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  checklistText: { flex: 1, fontSize: 14, color: '#e2e8f0' },
  checklistTextDone: { color: '#475569', textDecorationLine: 'line-through' },
  actionsSection: { gap: 12 },
  actionButton: {
    borderRadius: 14, paddingVertical: 16, alignItems: 'center',
  },
  actionButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  issueButton: {
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#ef4444',
  },
  issueButtonText: { color: '#ef4444', fontSize: 15, fontWeight: '600' },
  mediaSection: {
    backgroundColor: '#1e293b', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#334155', gap: 10,
  },
  mediaSectionTitle: { fontSize: 16, fontWeight: '700', color: '#f8fafc' },
  mediaSectionHint: { fontSize: 13, color: '#64748b' },
  mediaCapture: {
    backgroundColor: '#0f172a', borderWidth: 1.5, borderColor: '#334155',
    borderStyle: 'dashed', borderRadius: 12, paddingVertical: 18, alignItems: 'center',
  },
  mediaCaptureText: { color: '#94a3b8', fontSize: 15, fontWeight: '600' },
  mediaPreview: { position: 'relative' },
  imagePreview: { width: '100%', height: 200, borderRadius: 12, backgroundColor: '#0f172a' },
  removeMedia: {
    position: 'absolute', top: 8, right: 8, backgroundColor: '#334155',
    borderRadius: 20, width: 28, height: 28, alignItems: 'center', justifyContent: 'center',
  },
  removeMediaText: { color: '#f8fafc', fontSize: 13, fontWeight: '700' },
  videoButtons: { flexDirection: 'row', gap: 10 },
  videoInfo: {
    backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155',
    borderRadius: 12, padding: 14, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  videoInfoLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  videoIcon: { fontSize: 32 },
  videoLabel: { color: '#f8fafc', fontSize: 14, fontWeight: '600' },
  videoDuration: { color: '#64748b', fontSize: 12, marginTop: 2 },
  uploadingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1e3a5f', borderRadius: 12, padding: 14,
  },
  uploadingText: { color: '#93c5fd', fontSize: 14, fontWeight: '600' },
});
