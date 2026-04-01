import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, FlatList, Image, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { api } from '../../src/lib/api';

const SEVERITY_COLORS: Record<string, string> = { HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#3b82f6' };
const STATUS_COLORS: Record<string, string> = { OPEN: '#ef4444', IN_REVIEW: '#f59e0b', RESOLVED: '#10b981' };

export default function IssueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [issue, setIssue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [tradesmenModal, setTradesmenModal] = useState(false);
  const [tradesmen, setTradesmen] = useState<any[]>([]);
  const [loadingTradesmen, setLoadingTradesmen] = useState(false);

  const loadIssue = useCallback(async () => {
    try {
      const data = await api.issues.get(id);
      setIssue(data);
    } catch {}
    setLoading(false);
  }, [id]);

  useEffect(() => { loadIssue(); }, [loadIssue]);

  const runAction = async (action: () => Promise<any>) => {
    setActing(true);
    try {
      await action();
      await loadIssue();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Action failed');
    }
    setActing(false);
  };

  const openTradesmen = async (trade?: string) => {
    setLoadingTradesmen(true);
    setTradesmenModal(true);
    try {
      const params: any = {};
      if (trade) params.trade = trade;
      if (issue?.propertyId) params.propertyId = issue.propertyId;
      const data = await api.tradesmen.list(params);
      setTradesmen(data);
    } catch {
      Alert.alert('Error', 'Failed to load tradesmen');
      setTradesmenModal(false);
    }
    setLoadingTradesmen(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ActivityIndicator color="#3b82f6" size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!issue) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Text style={styles.errorText}>Issue not found</Text>
      </SafeAreaView>
    );
  }

  const pendingSuggestions = (issue.aiSuggestions || []).filter((s: any) => s.status === 'PENDING');

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Issue Detail</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Description & Status */}
        <View style={styles.card}>
          <Text style={styles.description}>{issue.description}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: SEVERITY_COLORS[issue.severity] || '#64748b' }]}>
              <Text style={styles.badgeText}>{issue.severity}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: STATUS_COLORS[issue.status] || '#64748b' }]}>
              <Text style={styles.badgeText}>{issue.status.replace('_', ' ')}</Text>
            </View>
          </View>
        </View>

        {/* Details */}
        <View style={styles.card}>
          {issue.property && (
            <>
              <Text style={styles.label}>Property</Text>
              <Text style={styles.value}>{issue.property.name}</Text>
            </>
          )}
          {issue.reportedBy?.user?.name && (
            <>
              <Text style={styles.label}>Reported By</Text>
              <Text style={styles.value}>{issue.reportedBy.user.name}</Text>
            </>
          )}
          <Text style={styles.label}>Created</Text>
          <Text style={styles.value}>{new Date(issue.createdAt).toLocaleString()}</Text>
        </View>

        {/* Media */}
        {(issue.photoUrl || issue.videoUrl) && (
          <View style={styles.card}>
            <Text style={styles.label}>Media</Text>
            {issue.photoUrl && (
              <Image source={{ uri: issue.photoUrl }} style={styles.photo} resizeMode="cover" />
            )}
            {issue.videoUrl && (
              <TouchableOpacity onPress={() => Linking.openURL(issue.videoUrl)}>
                <Text style={styles.linkText}>View Video</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* AI Suggestions */}
        {pendingSuggestions.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>AI Suggestions</Text>
            {pendingSuggestions.map((s: any) => (
              <View key={s.id} style={styles.suggestionItem}>
                <Text style={styles.suggestionText}>{s.summary || s.actionType}</Text>
                {s.actionLabel && <Text style={styles.suggestionAction}>{s.actionLabel}</Text>}
                <View style={styles.suggestionBtns}>
                  <TouchableOpacity
                    style={styles.approveBtn}
                    onPress={() => runAction(() => api.aiSuggestions.approve(s.id))}
                    disabled={acting}
                  >
                    <Text style={styles.approveBtnText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dismissBtn}
                    onPress={() => runAction(() => api.aiSuggestions.dismiss(s.id))}
                    disabled={acting}
                  >
                    <Text style={styles.dismissBtnText}>Dismiss</Text>
                  </TouchableOpacity>
                </View>
                {s.suggestedTrade && (
                  <TouchableOpacity
                    style={styles.tradeBtn}
                    onPress={() => openTradesmen(s.suggestedTrade)}
                    disabled={acting}
                  >
                    <Text style={styles.tradeBtnText}>Find {s.suggestedTrade}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Linked Job */}
        {issue.job && (
          <TouchableOpacity style={styles.card} onPress={() => router.push(`/job/${issue.job.id}`)}>
            <Text style={styles.label}>Linked Job</Text>
            <Text style={styles.value}>{issue.job.type} — {issue.job.status}</Text>
            {issue.job.worker?.user?.name && (
              <Text style={styles.value}>Worker: {issue.job.worker.user.name}</Text>
            )}
            <Text style={styles.linkText}>View Job ›</Text>
          </TouchableOpacity>
        )}

        {/* Status Actions */}
        <View style={styles.actionsCard}>
          {issue.status === 'OPEN' && (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => runAction(() => api.issues.updateStatus(id, 'IN_REVIEW'))}
              disabled={acting}
            >
              <Text style={styles.btnText}>Mark In Review</Text>
            </TouchableOpacity>
          )}
          {issue.status === 'IN_REVIEW' && (
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: '#166534' }]}
              onPress={() => runAction(() => api.issues.updateStatus(id, 'RESOLVED'))}
              disabled={acting}
            >
              <Text style={styles.btnText}>Resolve</Text>
            </TouchableOpacity>
          )}
          {issue.status === 'RESOLVED' && (
            <TouchableOpacity
              style={styles.reopenBtn}
              onPress={() => runAction(() => api.issues.updateStatus(id, 'OPEN'))}
              disabled={acting}
            >
              <Text style={styles.reopenBtnText}>Reopen</Text>
            </TouchableOpacity>
          )}
          {acting && <ActivityIndicator color="#3b82f6" style={{ marginTop: 12 }} />}
        </View>
      </ScrollView>

      {/* Tradesman picker modal */}
      <Modal visible={tradesmenModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Tradesmen</Text>
            {loadingTradesmen ? (
              <ActivityIndicator color="#3b82f6" style={{ marginVertical: 24 }} />
            ) : (
              <FlatList
                data={tradesmen}
                keyExtractor={(t) => t.id}
                style={{ maxHeight: 320 }}
                ListEmptyComponent={<Text style={styles.emptyList}>No tradesmen found</Text>}
                renderItem={({ item }) => (
                  <View style={styles.tradesmanRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tradesmanName}>{item.name || 'Unknown'}</Text>
                      {item.trade && <Text style={styles.tradesmanTrade}>{item.trade}</Text>}
                    </View>
                    {item.phone && (
                      <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.phone}`)}>
                        <Text style={styles.callBtn}>Call</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              />
            )}
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setTradesmenModal(false)}>
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  backText: { color: '#3b82f6', fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#f8fafc' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 24 },
  card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#334155' },
  description: { fontSize: 16, fontWeight: '600', color: '#f8fafc', marginBottom: 8 },
  badgeRow: { flexDirection: 'row', gap: 8 },
  badge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  label: { fontSize: 12, color: '#64748b', textTransform: 'uppercase', marginTop: 12, marginBottom: 2 },
  value: { fontSize: 15, color: '#e2e8f0' },
  errorText: { color: '#fca5a5', textAlign: 'center', marginTop: 40, fontSize: 16 },
  photo: { width: '100%', height: 200, borderRadius: 8, marginTop: 8 },
  linkText: { color: '#3b82f6', fontSize: 14, fontWeight: '600', marginTop: 8 },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#f8fafc', marginBottom: 12 },
  suggestionItem: { borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 12, marginTop: 8 },
  suggestionText: { fontSize: 14, color: '#e2e8f0', marginBottom: 4 },
  suggestionAction: { fontSize: 12, color: '#94a3b8', marginBottom: 8 },
  suggestionBtns: { flexDirection: 'row', gap: 10 },
  approveBtn: { backgroundColor: '#166534', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  approveBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  dismissBtn: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#475569' },
  dismissBtnText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  tradeBtn: { backgroundColor: '#1e3a5f', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, marginTop: 8, alignSelf: 'flex-start' },
  tradeBtnText: { color: '#3b82f6', fontSize: 13, fontWeight: '600' },

  actionsCard: { gap: 10, marginTop: 4 },
  primaryBtn: { backgroundColor: '#3b82f6', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  reopenBtn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#f59e0b', backgroundColor: 'transparent' },
  reopenBtnText: { color: '#f59e0b', fontSize: 15, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1e293b', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#f8fafc', marginBottom: 16 },
  tradesmanRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#334155' },
  tradesmanName: { fontSize: 15, color: '#e2e8f0', fontWeight: '600' },
  tradesmanTrade: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  callBtn: { color: '#3b82f6', fontSize: 14, fontWeight: '600', paddingHorizontal: 12 },
  emptyList: { color: '#64748b', textAlign: 'center', marginVertical: 24, fontSize: 14 },
  modalCloseBtn: { marginTop: 16, paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#334155' },
  modalCloseBtnText: { color: '#94a3b8', fontSize: 15, fontWeight: '600' },
});
