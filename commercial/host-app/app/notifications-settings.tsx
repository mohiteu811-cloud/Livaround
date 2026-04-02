import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { api, NotificationPrefs } from '../src/lib/api';

const ISSUE_ALERT_OPTIONS: { value: NotificationPrefs['aiIssueAlerts']; label: string; description: string }[] = [
  { value: 'all', label: 'All Issues', description: 'Get notified for every issue regardless of urgency' },
  { value: 'high_critical', label: 'High & Critical Only', description: 'Only get notified for high or critical urgency issues' },
  { value: 'none', label: 'Off', description: 'No push notifications for AI issue alerts' },
];

const DEFAULT_PREFS: NotificationPrefs = {
  guestMessages: true,
  workerMessages: true,
  aiConversationAlerts: true,
  aiIssueAlerts: 'all',
};

export default function NotificationsSettingsScreen() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.hostApp.getSettings()
      .then(s => setPrefs({ ...DEFAULT_PREFS, ...s.notificationPrefs }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function updatePref(update: Partial<NotificationPrefs>) {
    const updated = { ...prefs, ...update };
    setPrefs(updated);
    setSaving(true);
    try {
      await api.hostApp.updateSettings({ notificationPrefs: updated });
    } catch {
      setPrefs(prefs);
      Alert.alert('Error', 'Failed to update notification settings');
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
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {saving && <ActivityIndicator color="#3b82f6" size="small" />}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Messages Section */}
        <Text style={styles.sectionTitle}>Messages</Text>
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Guest Messages</Text>
              <Text style={styles.toggleDescription}>Notifications when guests send you a message</Text>
            </View>
            <Switch
              value={prefs.guestMessages}
              onValueChange={(val) => updatePref({ guestMessages: val })}
              trackColor={{ false: '#334155', true: '#1d4ed8' }}
              thumbColor={prefs.guestMessages ? '#3b82f6' : '#94a3b8'}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Team Messages</Text>
              <Text style={styles.toggleDescription}>Notifications when workers send you a message</Text>
            </View>
            <Switch
              value={prefs.workerMessages}
              onValueChange={(val) => updatePref({ workerMessages: val })}
              trackColor={{ false: '#334155', true: '#1d4ed8' }}
              thumbColor={prefs.workerMessages ? '#3b82f6' : '#94a3b8'}
            />
          </View>
        </View>

        {/* AI Alerts Section */}
        <Text style={styles.sectionTitle}>AI Alerts</Text>
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Conversation Alerts</Text>
              <Text style={styles.toggleDescription}>AI detects urgent issues in guest or team conversations</Text>
            </View>
            <Switch
              value={prefs.aiConversationAlerts}
              onValueChange={(val) => updatePref({ aiConversationAlerts: val })}
              trackColor={{ false: '#334155', true: '#1d4ed8' }}
              thumbColor={prefs.aiConversationAlerts ? '#3b82f6' : '#94a3b8'}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.issueAlertSection}>
            <Text style={styles.toggleLabel}>Issue Alerts</Text>
            <Text style={styles.toggleDescription}>When AI analyzes worker-reported issues</Text>
            <View style={styles.optionsRow}>
              {ISSUE_ALERT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.optionBtn,
                    prefs.aiIssueAlerts === opt.value && styles.optionBtnActive,
                  ]}
                  onPress={() => updatePref({ aiIssueAlerts: opt.value })}
                >
                  <Text
                    style={[
                      styles.optionBtnText,
                      prefs.aiIssueAlerts === opt.value && styles.optionBtnTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.optionDescription}>
              {ISSUE_ALERT_OPTIONS.find((o) => o.value === prefs.aiIssueAlerts)?.description}
            </Text>
          </View>
        </View>
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
  content: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 16, paddingHorizontal: 4 },
  card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#334155' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  toggleInfo: { flex: 1, marginRight: 12 },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: '#f8fafc' },
  toggleDescription: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#334155', marginVertical: 12 },
  issueAlertSection: { paddingVertical: 4 },
  optionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  optionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  optionBtnActive: {
    backgroundColor: '#1e3a8a',
    borderColor: '#3b82f6',
  },
  optionBtnText: { fontSize: 12, fontWeight: '600', color: '#94a3b8' },
  optionBtnTextActive: { color: '#93c5fd' },
  optionDescription: { fontSize: 11, color: '#64748b', marginTop: 8, fontStyle: 'italic' },
});
