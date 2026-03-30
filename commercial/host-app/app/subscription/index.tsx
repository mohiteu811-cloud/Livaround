import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { api } from '../../src/lib/api';

export default function SubscriptionScreen() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.billing.status().then(setStatus).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function manageBilling() {
    // On iOS, direct to web to avoid Apple IAP requirements
    // On Android, could use WebView but for now also direct to web
    Linking.openURL('https://livarounddashboard-production.up.railway.app/settings/billing');
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#3b82f6" size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subscription</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.planCard}>
          <Text style={styles.currentLabel}>Current Plan</Text>
          <Text style={styles.planName}>
            {(status?.plan || 'Community').charAt(0).toUpperCase() + (status?.plan || 'community').slice(1)}
          </Text>
          <Text style={styles.planStatus}>
            Status: {status?.status || 'Active'}
          </Text>
        </View>

        <View style={styles.tiers}>
          <View style={styles.tierCard}>
            <Text style={styles.tierName}>Community</Text>
            <Text style={styles.tierPrice}>Free</Text>
            <Text style={styles.tierDesc}>Basic property management, worker app, guest portal</Text>
          </View>
          <View style={[styles.tierCard, styles.proBorder]}>
            <Text style={styles.tierName}>Pro</Text>
            <Text style={styles.tierPrice}>$10/property/mo</Text>
            <Text style={styles.tierDesc}>Guest messaging, owner reports, shift marketplace, API access</Text>
          </View>
          <View style={styles.tierCard}>
            <Text style={styles.tierName}>Agency</Text>
            <Text style={styles.tierPrice}>$100/mo flat</Text>
            <Text style={styles.tierDesc}>Everything in Pro + white-label, multi-org</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.manageButton} onPress={manageBilling}>
          <Text style={styles.manageText}>
            {Platform.OS === 'ios' ? 'Manage at livaround.com' : 'Manage Subscription'}
          </Text>
        </TouchableOpacity>

        {Platform.OS === 'ios' && (
          <Text style={styles.iosNote}>
            Subscriptions are managed through the web dashboard via PayPal.
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  backText: { color: '#3b82f6', fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#f8fafc' },
  content: { flex: 1, paddingHorizontal: 16 },
  planCard: { backgroundColor: '#1e3a8a', borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 24 },
  currentLabel: { fontSize: 12, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  planName: { fontSize: 28, fontWeight: '700', color: '#fff' },
  planStatus: { fontSize: 14, color: '#bfdbfe', marginTop: 4 },
  tiers: { gap: 10, marginBottom: 24 },
  tierCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#334155' },
  proBorder: { borderColor: '#3b82f6' },
  tierName: { fontSize: 16, fontWeight: '700', color: '#f8fafc' },
  tierPrice: { fontSize: 14, color: '#3b82f6', fontWeight: '600', marginTop: 2 },
  tierDesc: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
  manageButton: { backgroundColor: '#3b82f6', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  manageText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  iosNote: { color: '#64748b', fontSize: 12, textAlign: 'center', marginTop: 12 },
});
