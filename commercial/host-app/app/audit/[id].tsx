import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { api } from '../../src/lib/api';

interface Finding {
  id: string;
  type: 'MISSING' | 'DAMAGED' | 'LOW_STOCK' | 'NEW_ITEM';
  roomLabel: string;
  itemName: string;
  category: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  dismissed: boolean;
  baselineItem?: { name: string; condition: string; quantity: number };
  auditItem?: { name: string; condition: string; quantity: number };
}

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  MISSING: { label: 'Missing', color: '#fca5a5', bg: '#7f1d1d' },
  DAMAGED: { label: 'Damaged', color: '#fdba74', bg: '#7c2d12' },
  LOW_STOCK: { label: 'Low Stock', color: '#fcd34d', bg: '#713f12' },
  NEW_ITEM: { label: 'New Item', color: '#86efac', bg: '#14532d' },
};

const SEVERITY_COLOR: Record<string, string> = {
  LOW: '#94a3b8',
  MEDIUM: '#f59e0b',
  HIGH: '#f97316',
  CRITICAL: '#ef4444',
};

export default function AuditDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [audit, setAudit] = useState<any>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [unchangedCount, setUnchangedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [auditData, findingsData] = await Promise.all([
        api.audits.get(id),
        api.audits.getFindings(id),
      ]);
      setAudit(auditData);
      setFindings(findingsData.findings || []);
      setUnchangedCount(findingsData.unchanged || 0);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  async function dismissFinding(findingId: string) {
    try {
      await api.audits.updateFinding(id, findingId, { dismissed: true });
      setFindings(prev => prev.map(f =>
        f.id === findingId ? { ...f, dismissed: true } : f
      ));
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  }

  async function approveFinding(findingId: string) {
    try {
      await api.audits.updateFinding(id, findingId, { dismissed: false });
      setFindings(prev => prev.map(f =>
        f.id === findingId ? { ...f, dismissed: false } : f
      ));
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  }

  async function confirmAudit() {
    Alert.alert(
      'Confirm Audit',
      'This will finalize the audit and create issues for all non-dismissed findings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Audit',
          onPress: async () => {
            setConfirming(true);
            try {
              const result = await api.audits.confirm(id);
              Alert.alert('Audit Confirmed', `${result.issuesCreated} issue(s) created.`);
              loadData();
            } catch (err: any) {
              Alert.alert('Error', err.message);
            } finally {
              setConfirming(false);
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ActivityIndicator color="#3b82f6" size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!audit) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Text style={styles.errorText}>Audit not found</Text>
      </SafeAreaView>
    );
  }

  const activeFindings = findings.filter(f => !f.dismissed);
  const dismissedFindings = findings.filter(f => f.dismissed);
  const isCompleted = audit.status === 'completed';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Checkout Audit</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor="#3b82f6" />
        }
      >
        {/* Audit header */}
        <View style={styles.card}>
          <Text style={styles.propertyName}>{audit.property?.name || 'Property'}</Text>
          <Text style={styles.meta}>Guest: {audit.booking?.guestName || 'Unknown'}</Text>
          {audit.booking?.checkOut && (
            <Text style={styles.meta}>
              Checkout: {new Date(audit.booking.checkOut).toLocaleDateString()}
            </Text>
          )}
          {isCompleted && (
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>Completed</Text>
            </View>
          )}
        </View>

        {/* Summary */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderColor: '#4ade80' }]}>
            <Text style={[styles.summaryValue, { color: '#4ade80' }]}>{audit.itemsOk}</Text>
            <Text style={styles.summaryLabel}>OK</Text>
          </View>
          <View style={[styles.summaryCard, { borderColor: '#fca5a5' }]}>
            <Text style={[styles.summaryValue, { color: '#fca5a5' }]}>{audit.itemsMissing}</Text>
            <Text style={styles.summaryLabel}>Missing</Text>
          </View>
          <View style={[styles.summaryCard, { borderColor: '#fdba74' }]}>
            <Text style={[styles.summaryValue, { color: '#fdba74' }]}>{audit.itemsDamaged}</Text>
            <Text style={styles.summaryLabel}>Damaged</Text>
          </View>
        </View>

        {/* Score */}
        {audit.overallScore != null && (
          <View style={styles.card}>
            <Text style={styles.scoreLabel}>Overall Score</Text>
            <Text style={[styles.scoreValue, {
              color: audit.overallScore >= 4 ? '#4ade80' :
                     audit.overallScore >= 3 ? '#fcd34d' :
                     audit.overallScore >= 2 ? '#f97316' : '#ef4444',
            }]}>
              {audit.overallScore.toFixed(1)} / 5.0
            </Text>
          </View>
        )}

        {/* Active findings with approve/dismiss */}
        {activeFindings.length > 0 && (
          <Text style={styles.sectionTitle}>Findings ({activeFindings.length})</Text>
        )}
        {activeFindings.map((finding) => {
          const config = TYPE_CONFIG[finding.type] || TYPE_CONFIG.MISSING;
          return (
            <View key={finding.id} style={styles.findingCard}>
              <View style={styles.findingHeader}>
                <View style={[styles.typeBadge, { backgroundColor: config.bg }]}>
                  <Text style={[styles.typeBadgeText, { color: config.color }]}>{config.label}</Text>
                </View>
                <Text style={[styles.severityText, { color: SEVERITY_COLOR[finding.severity] }]}>
                  {finding.severity}
                </Text>
              </View>
              <Text style={styles.findingName}>{finding.itemName}</Text>
              <Text style={styles.findingRoom}>{finding.roomLabel} - {finding.category}</Text>
              <Text style={styles.findingDesc}>{finding.description}</Text>

              {finding.baselineItem && finding.auditItem && (
                <View style={styles.comparisonRow}>
                  <View style={styles.comparisonCol}>
                    <Text style={styles.comparisonLabel}>Before</Text>
                    <Text style={styles.comparisonValue}>
                      {finding.baselineItem.condition} (qty: {finding.baselineItem.quantity})
                    </Text>
                  </View>
                  <Text style={styles.comparisonArrow}>→</Text>
                  <View style={styles.comparisonCol}>
                    <Text style={styles.comparisonLabel}>After</Text>
                    <Text style={styles.comparisonValue}>
                      {finding.auditItem.condition} (qty: {finding.auditItem.quantity})
                    </Text>
                  </View>
                </View>
              )}

              {!isCompleted && (
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.approveBtn} onPress={() => approveFinding(finding.id)}>
                    <Text style={styles.approveBtnText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.dismissBtn} onPress={() => dismissFinding(finding.id)}>
                    <Text style={styles.dismissBtnText}>Dismiss</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}

        {/* Unchanged count */}
        {unchangedCount > 0 && (
          <View style={styles.card}>
            <Text style={styles.unchangedText}>{unchangedCount} items unchanged</Text>
          </View>
        )}

        {/* Dismissed */}
        {dismissedFindings.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: '#64748b' }]}>
              Dismissed ({dismissedFindings.length})
            </Text>
            {dismissedFindings.map((finding) => (
              <View key={finding.id} style={[styles.findingCard, styles.dismissedCard]}>
                <Text style={styles.dismissedName}>{finding.itemName}</Text>
                <Text style={styles.dismissedDesc}>{finding.description}</Text>
                {!isCompleted && (
                  <TouchableOpacity onPress={() => approveFinding(finding.id)}>
                    <Text style={styles.restoreText}>Restore</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </>
        )}

        {/* Confirm button */}
        {!isCompleted && (
          <TouchableOpacity
            style={[styles.confirmBtn, confirming && { opacity: 0.6 }]}
            onPress={confirmAudit}
            disabled={confirming}
          >
            {confirming ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.confirmBtnText}>Confirm Audit</Text>
            )}
          </TouchableOpacity>
        )}
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
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#334155' },
  propertyName: { fontSize: 18, fontWeight: '700', color: '#f8fafc', marginBottom: 4 },
  meta: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  statusBadge: {
    alignSelf: 'flex-start', marginTop: 8,
    backgroundColor: '#14532d', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
  },
  statusText: { color: '#4ade80', fontSize: 12, fontWeight: '600' },
  summaryRow: { flexDirection: 'row', gap: 8 },
  summaryCard: {
    flex: 1, backgroundColor: '#1e293b', borderRadius: 12, padding: 12,
    alignItems: 'center', borderWidth: 1,
  },
  summaryValue: { fontSize: 28, fontWeight: '800' },
  summaryLabel: { fontSize: 11, color: '#94a3b8', marginTop: 2, textTransform: 'uppercase' },
  scoreLabel: { fontSize: 12, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 },
  scoreValue: { fontSize: 24, fontWeight: '700' },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#94a3b8', marginTop: 8, textTransform: 'uppercase' },
  findingCard: {
    backgroundColor: '#1e293b', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#334155',
  },
  findingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  severityText: { fontSize: 11, fontWeight: '600' },
  findingName: { fontSize: 15, fontWeight: '600', color: '#f8fafc', marginBottom: 2 },
  findingRoom: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  findingDesc: { fontSize: 13, color: '#94a3b8', lineHeight: 18 },
  comparisonRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: 10,
    backgroundColor: '#0f172a', borderRadius: 8, padding: 10, gap: 8,
  },
  comparisonCol: { flex: 1 },
  comparisonLabel: { fontSize: 10, color: '#64748b', textTransform: 'uppercase', marginBottom: 2 },
  comparisonValue: { fontSize: 13, color: '#e2e8f0' },
  comparisonArrow: { fontSize: 16, color: '#475569' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  approveBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#1d4ed8', alignItems: 'center',
  },
  approveBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  dismissBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#475569', alignItems: 'center',
  },
  dismissBtnText: { color: '#94a3b8', fontSize: 13, fontWeight: '500' },
  dismissedCard: { opacity: 0.5, borderStyle: 'dashed' as any },
  dismissedName: { fontSize: 14, color: '#64748b', textDecorationLine: 'line-through' },
  dismissedDesc: { fontSize: 12, color: '#475569', marginTop: 2 },
  restoreText: { color: '#3b82f6', fontSize: 12, fontWeight: '500', marginTop: 8 },
  unchangedText: { fontSize: 14, color: '#4ade80', textAlign: 'center' },
  confirmBtn: {
    backgroundColor: '#3b82f6', borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', marginTop: 8,
  },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  errorText: { color: '#fca5a5', textAlign: 'center', marginTop: 40, fontSize: 16 },
});
