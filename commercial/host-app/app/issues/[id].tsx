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
const URGENCY_COLORS: Record<string, string> = { CRITICAL: '#dc2626', HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#3b82f6' };
const SUGGESTION_STATUS_COLORS: Record<string, string> = { PENDING: '#f59e0b', APPROVED: '#10b981', DISMISSED: '#64748b' };

export default function IssueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [issue, setIssue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [tradesmenModal, setTradesmenModal] = useState(false);
  const [tradesmen, setTradesmen] = useState<any[]>([]);
  const [loadingTradesmen, setLoadingTradesmen] = useState(false);
  const [expandedSuggestions, setExpandedSuggestions] = useState<Record<string, boolean>>({});
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [fullScreenIndex, setFullScreenIndex] = useState(0);

  const loadIssue = useCallback(async () => {
    try {
      const data = await api.issues.get(id);
      setIssue(data);
      // Auto-expand pending suggestions
      const expanded: Record<string, boolean> = {};
      (data.aiSuggestions || []).forEach((s: any) => {
        if (s.status === 'PENDING') expanded[s.id] = true;
      });
      setExpandedSuggestions(expanded);
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

  const toggleSuggestion = (suggestionId: string) => {
    setExpandedSuggestions(prev => ({ ...prev, [suggestionId]: !prev[suggestionId] }));
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

  const allSuggestions = issue.aiSuggestions || [];

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
        {(() => {
          // Build unified media list from mediaUrls array (new) or legacy fields
          const mediaList: { url: string; type: 'image' | 'video' }[] =
            issue.mediaUrls && issue.mediaUrls.length > 0
              ? issue.mediaUrls
              : [
                  ...(issue.photoUrl ? [{ url: issue.photoUrl, type: 'image' as const }] : []),
                  ...(issue.videoUrl ? [{ url: issue.videoUrl, type: 'video' as const }] : []),
                ];
          if (mediaList.length === 0) return null;
          const imageItems = mediaList.filter(m => m.type === 'image');
          return (
            <View style={styles.card}>
              <Text style={styles.label}>Media ({mediaList.length})</Text>
              <FlatList
                data={mediaList}
                horizontal
                keyExtractor={(_, i) => i.toString()}
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 8 }}
                renderItem={({ item, index }) => (
                  item.type === 'image' ? (
                    <TouchableOpacity
                      onPress={() => {
                        const imgIdx = imageItems.findIndex(img => img.url === item.url);
                        setFullScreenIndex(imgIdx >= 0 ? imgIdx : 0);
                        setFullScreenImage(item.url);
                      }}
                      style={styles.galleryThumb}
                    >
                      <Image source={{ uri: item.url }} style={styles.galleryImage} resizeMode="cover" />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={() => Linking.openURL(item.url)}
                      style={styles.galleryThumb}
                    >
                      <View style={styles.galleryVideoThumb}>
                        <Text style={{ fontSize: 28 }}>🎥</Text>
                        <Text style={styles.galleryVideoLabel}>Play Video</Text>
                      </View>
                    </TouchableOpacity>
                  )
                )}
              />
              {mediaList.length > 1 && (
                <Text style={styles.tapHint}>Swipe for more · Tap to view</Text>
              )}
              {mediaList.length === 1 && imageItems.length > 0 && (
                <Text style={styles.tapHint}>Tap to view full screen</Text>
              )}
            </View>
          );
        })()}

        {/* AI Analysis */}
        {allSuggestions.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>AI Analysis</Text>
            {allSuggestions.map((s: any) => {
              const isExpanded = expandedSuggestions[s.id];
              const isPending = s.status === 'PENDING';
              const payload = s.actionPayload || {};

              return (
                <View key={s.id} style={styles.suggestionItem}>
                  {/* Header row — tap to expand/collapse */}
                  <TouchableOpacity onPress={() => toggleSuggestion(s.id)} style={styles.suggestionHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.suggestionSummary}>{s.summary}</Text>
                      <View style={styles.badgeRow}>
                        <View style={[styles.smallBadge, { backgroundColor: '#334155' }]}>
                          <Text style={styles.smallBadgeText}>{s.category}</Text>
                        </View>
                        <View style={[styles.smallBadge, { backgroundColor: URGENCY_COLORS[s.urgency] || '#64748b' }]}>
                          <Text style={styles.smallBadgeText}>{s.urgency}</Text>
                        </View>
                        <View style={[styles.smallBadge, { backgroundColor: SUGGESTION_STATUS_COLORS[s.status] || '#64748b' }]}>
                          <Text style={styles.smallBadgeText}>{s.status}</Text>
                        </View>
                      </View>
                    </View>
                    <Text style={styles.expandIcon}>{isExpanded ? '▾' : '▸'}</Text>
                  </TouchableOpacity>

                  {/* Expanded details */}
                  {isExpanded && (
                    <View style={styles.suggestionDetails}>
                      {/* Sentiment */}
                      {s.sentiment && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Sentiment</Text>
                          <Text style={styles.detailValue}>{s.sentiment}</Text>
                        </View>
                      )}

                      {/* Suggested Action */}
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Recommended Action</Text>
                        <Text style={styles.detailValue}>{s.suggestedAction.replace(/_/g, ' ')}</Text>
                      </View>

                      {/* Next Steps / Suggested Reply */}
                      {s.suggestedReply && (
                        <View style={styles.detailBlock}>
                          <Text style={styles.detailLabel}>Next Steps</Text>
                          <Text style={styles.detailText}>{s.suggestedReply}</Text>
                        </View>
                      )}

                      {/* Dispatch details */}
                      {payload.dispatchData && (
                        <View style={styles.detailBlock}>
                          <Text style={styles.detailLabel}>Dispatch Details</Text>
                          <Text style={styles.detailText}>
                            Role needed: {payload.dispatchData.suggestedRole}
                            {payload.dispatchData.reason ? `\n${payload.dispatchData.reason}` : ''}
                          </Text>
                        </View>
                      )}

                      {/* Tradesman details */}
                      {payload.tradesmanData && (
                        <View style={styles.detailBlock}>
                          <Text style={styles.detailLabel}>Tradesman Details</Text>
                          <Text style={styles.detailText}>
                            Trade needed: {payload.tradesmanData.suggestedTrade}
                            {payload.tradesmanData.reason ? `\n${payload.tradesmanData.reason}` : ''}
                          </Text>
                        </View>
                      )}

                      {/* Job details */}
                      {payload.jobData && (
                        <View style={styles.detailBlock}>
                          <Text style={styles.detailLabel}>Job Details</Text>
                          <Text style={styles.detailText}>
                            Type: {payload.jobData.type}
                            {payload.jobData.notes ? `\nNotes: ${payload.jobData.notes}` : ''}
                          </Text>
                        </View>
                      )}

                      {/* Action buttons for pending suggestions */}
                      {isPending && (
                        <View style={styles.actionSection}>
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
                          {payload.tradesmanData?.suggestedTrade && (
                            <TouchableOpacity
                              style={styles.tradeBtn}
                              onPress={() => openTradesmen(payload.tradesmanData.suggestedTrade)}
                              disabled={acting}
                            >
                              <Text style={styles.tradeBtnText}>Find {payload.tradesmanData.suggestedTrade}</Text>
                            </TouchableOpacity>
                          )}
                          {payload.dispatchData?.suggestedRole && (
                            <TouchableOpacity
                              style={styles.tradeBtn}
                              onPress={() => openTradesmen()}
                              disabled={acting}
                            >
                              <Text style={styles.tradeBtnText}>Dispatch {payload.dispatchData.suggestedRole}</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
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

      {/* Full-screen image viewer with navigation */}
      <Modal visible={!!fullScreenImage} transparent animationType="fade">
        <View style={styles.fullScreenOverlay}>
          <TouchableOpacity style={styles.fullScreenClose} onPress={() => setFullScreenImage(null)}>
            <Text style={styles.fullScreenCloseText}>✕</Text>
          </TouchableOpacity>
          {fullScreenImage && (
            <Image source={{ uri: fullScreenImage }} style={styles.fullScreenImage} resizeMode="contain" />
          )}
          {/* Navigation arrows for multiple images */}
          {(() => {
            const allImages = (
              issue?.mediaUrls && issue.mediaUrls.length > 0
                ? issue.mediaUrls.filter((m: any) => m.type === 'image')
                : issue?.photoUrl ? [{ url: issue.photoUrl }] : []
            );
            if (allImages.length <= 1) return null;
            return (
              <View style={styles.fullScreenNav}>
                <TouchableOpacity
                  style={[styles.navArrow, fullScreenIndex === 0 && styles.navArrowDisabled]}
                  disabled={fullScreenIndex === 0}
                  onPress={() => {
                    const newIdx = fullScreenIndex - 1;
                    setFullScreenIndex(newIdx);
                    setFullScreenImage(allImages[newIdx].url);
                  }}
                >
                  <Text style={styles.navArrowText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.navCounter}>{fullScreenIndex + 1} / {allImages.length}</Text>
                <TouchableOpacity
                  style={[styles.navArrow, fullScreenIndex === allImages.length - 1 && styles.navArrowDisabled]}
                  disabled={fullScreenIndex === allImages.length - 1}
                  onPress={() => {
                    const newIdx = fullScreenIndex + 1;
                    setFullScreenIndex(newIdx);
                    setFullScreenImage(allImages[newIdx].url);
                  }}
                >
                  <Text style={styles.navArrowText}>›</Text>
                </TouchableOpacity>
              </View>
            );
          })()}
        </View>
      </Modal>

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
                      {item.company && <Text style={styles.tradesmanCompany}>{item.company}</Text>}
                    </View>
                    {item.phones && item.phones.length > 0 && (
                      <View style={{ gap: 6 }}>
                        {item.phones.map((phone: string, idx: number) => (
                          <TouchableOpacity key={idx} style={styles.phoneBtn} onPress={() => Linking.openURL(`tel:${phone}`)}>
                            <Text style={styles.phoneBtnText}>{phone}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
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
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 },
  badge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  smallBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  smallBadgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  label: { fontSize: 12, color: '#64748b', textTransform: 'uppercase', marginTop: 12, marginBottom: 2 },
  value: { fontSize: 15, color: '#e2e8f0' },
  errorText: { color: '#fca5a5', textAlign: 'center', marginTop: 40, fontSize: 16 },
  photo: { width: '100%', height: 200, borderRadius: 8, marginTop: 8 },
  tapHint: { color: '#64748b', fontSize: 11, marginTop: 4, textAlign: 'center' },
  linkText: { color: '#3b82f6', fontSize: 14, fontWeight: '600', marginTop: 8 },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#f8fafc', marginBottom: 8 },
  suggestionItem: { borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 10, marginTop: 6 },
  suggestionHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  suggestionSummary: { fontSize: 14, fontWeight: '600', color: '#f8fafc', marginBottom: 6 },
  expandIcon: { color: '#64748b', fontSize: 16, marginLeft: 8, marginTop: 2 },

  suggestionDetails: { marginTop: 10, paddingLeft: 4 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  detailLabel: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: '600', marginBottom: 4 },
  detailValue: { fontSize: 13, color: '#e2e8f0' },
  detailBlock: { marginBottom: 12 },
  detailText: { fontSize: 13, color: '#cbd5e1', lineHeight: 20 },

  actionSection: { marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#334155' },
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
  tradesmanCompany: { fontSize: 12, color: '#64748b', marginTop: 1 },
  phoneBtn: { backgroundColor: '#1e3a5f', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  phoneBtnText: { color: '#3b82f6', fontSize: 13, fontWeight: '600' },
  galleryThumb: { width: 140, height: 120, borderRadius: 10, marginRight: 10 },
  galleryImage: { width: 140, height: 120, borderRadius: 10, backgroundColor: '#1e293b' },
  galleryVideoThumb: { width: 140, height: 120, borderRadius: 10, backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', alignItems: 'center' as const, justifyContent: 'center' as const },
  galleryVideoLabel: { color: '#3b82f6', fontSize: 12, fontWeight: '600' as const, marginTop: 4 },
  fullScreenOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  fullScreenClose: { position: 'absolute' as const, top: 50, right: 20, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, width: 40, height: 40, alignItems: 'center' as const, justifyContent: 'center' as const },
  fullScreenCloseText: { color: '#fff', fontSize: 20, fontWeight: '600' as const },
  fullScreenImage: { width: '100%' as any, height: '80%' as any },
  fullScreenNav: { position: 'absolute' as const, bottom: 60, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 20 },
  navArrow: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, width: 44, height: 44, alignItems: 'center' as const, justifyContent: 'center' as const },
  navArrowDisabled: { opacity: 0.3 },
  navArrowText: { color: '#fff', fontSize: 24, fontWeight: '700' as const },
  navCounter: { color: '#fff', fontSize: 14, fontWeight: '600' as const },
  emptyList: { color: '#64748b', textAlign: 'center', marginVertical: 24, fontSize: 14 },
  modalCloseBtn: { marginTop: 16, paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#334155' },
  modalCloseBtnText: { color: '#94a3b8', fontSize: 15, fontWeight: '600' },
});
