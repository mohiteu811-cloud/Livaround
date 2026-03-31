import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Modal, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { api } from '../../src/lib/api';

type Tab = 'guests' | 'team';

interface Conversation {
  id: string;
  channelType?: string;
  hostId?: string;
  host?: { id: string; name: string };
  workerId?: string;
  worker?: { id: string; user?: { name: string } };
  guest?: { id: string; name: string };
  guestName?: string;
  property?: { id: string; name: string };
  lastMessageAt?: string;
  lastMessagePreview?: string;
  unreadByWorker: number;
}

export default function MessagesScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('guests');
  const [teamConversations, setTeamConversations] = useState<Conversation[]>([]);
  const [guestConversations, setGuestConversations] = useState<Conversation[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fabOpen, setFabOpen] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);
  const [guestPickerOpen, setGuestPickerOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [team, guests] = await Promise.all([
        api.internalConversations.list(),
        api.guestConversations.list(),
      ]);
      setTeamConversations(team);
      setGuestConversations(guests);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load conversations');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  function timeAgo(dateStr?: string) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  }

  async function handleMessageHost() {
    setFabOpen(false);
    setCreatingChat(true);
    try {
      const conv = await api.internalConversations.create();
      router.push(`/conversation/${conv.id}?type=internal`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create conversation');
    }
    setCreatingChat(false);
  }

  async function handleMessageGuest() {
    setFabOpen(false);
    if (guestConversations.length === 0) {
      try {
        const guests = await api.guestConversations.list();
        setGuestConversations(guests);
        if (guests.length === 0) {
          Alert.alert('No Guests', 'There are no active guest conversations available.');
          return;
        }
        setGuestPickerOpen(true);
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Failed to load guest conversations');
      }
    } else {
      setGuestPickerOpen(true);
    }
  }

  function selectGuest(conv: Conversation) {
    setGuestPickerOpen(false);
    router.push(`/conversation/${conv.id}?type=guest`);
  }

  const conversations = activeTab === 'team' ? teamConversations : guestConversations;

  function getDisplayName(item: Conversation): string {
    if (activeTab === 'guests') {
      return item.guestName || item.guest?.name || 'Guest';
    }
    return item.host?.name || 'Host';
  }

  function getBadgeLabel(item: Conversation): string {
    if (activeTab === 'guests') return 'Guest';
    return item.channelType === 'HOST_WORKER' ? 'Host' : 'Supervisor';
  }

  function navigateToConversation(item: Conversation) {
    const type = activeTab === 'guests' ? 'guest' : 'internal';
    router.push(`/conversation/${item.id}?type=${type}`);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.header}>Messages</Text>

      {/* Tab Switcher */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'guests' && styles.tabActive]}
          onPress={() => setActiveTab('guests')}
        >
          <Text style={[styles.tabText, activeTab === 'guests' && styles.tabTextActive]}>Guests</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'team' && styles.tabActive]}
          onPress={() => setActiveTab('team')}
        >
          <Text style={[styles.tabText, activeTab === 'team' && styles.tabTextActive]}>Team</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, item.unreadByWorker > 0 && styles.unreadCard]}
            onPress={() => navigateToConversation(item)}
          >
            <View style={styles.cardHeader}>
              <View style={styles.nameRow}>
                <Text style={styles.contactName}>{getDisplayName(item)}</Text>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>{getBadgeLabel(item)}</Text>
                </View>
                {item.unreadByWorker > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{item.unreadByWorker}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.time}>{timeAgo(item.lastMessageAt)}</Text>
            </View>
            {item.property && <Text style={styles.propertyName}>{item.property.name}</Text>}
            {item.lastMessagePreview && (
              <Text style={styles.preview} numberOfLines={1}>{item.lastMessagePreview}</Text>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyTitle}>No {activeTab === 'guests' ? 'guest' : 'team'} messages yet</Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'guests'
                  ? 'Guest conversations will appear here'
                  : 'Messages from your host will appear here'}
              </Text>
            </View>
          ) : null
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setFabOpen(true)}
        disabled={creatingChat}
      >
        {creatingChat ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.fabText}>+</Text>
        )}
      </TouchableOpacity>

      {/* FAB Modal */}
      <Modal visible={fabOpen} transparent animationType="fade" onRequestClose={() => setFabOpen(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setFabOpen(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Conversation</Text>
            <TouchableOpacity style={styles.modalOption} onPress={handleMessageHost}>
              <Text style={styles.modalOptionIcon}>👤</Text>
              <View>
                <Text style={styles.modalOptionText}>Message Host</Text>
                <Text style={styles.modalOptionSub}>Start a conversation with your host</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalOption} onPress={handleMessageGuest}>
              <Text style={styles.modalOptionIcon}>🏠</Text>
              <View>
                <Text style={styles.modalOptionText}>Message Guest</Text>
                <Text style={styles.modalOptionSub}>Message an active guest</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setFabOpen(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Guest Picker Modal */}
      <Modal visible={guestPickerOpen} transparent animationType="slide" onRequestClose={() => setGuestPickerOpen(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setGuestPickerOpen(false)}>
          <View style={styles.pickerContent}>
            <Text style={styles.modalTitle}>Select Guest</Text>
            <FlatList
              data={guestConversations}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.pickerItem} onPress={() => selectGuest(item)}>
                  <Text style={styles.pickerName}>{item.guestName || item.guest?.name || 'Guest'}</Text>
                  {item.property && <Text style={styles.pickerProperty}>{item.property.name}</Text>}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.pickerEmpty}>No active guest conversations</Text>
              }
            />
            <TouchableOpacity style={styles.modalCancel} onPress={() => setGuestPickerOpen(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { fontSize: 24, fontWeight: '700', color: '#f8fafc', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  tabBar: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, backgroundColor: '#1e293b', borderRadius: 10, padding: 3 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#3b82f6' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#94a3b8' },
  tabTextActive: { color: '#fff' },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#334155' },
  unreadCard: { borderColor: '#3b82f6', borderWidth: 1.5 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  contactName: { fontSize: 15, fontWeight: '600', color: '#f8fafc' },
  typeBadge: { backgroundColor: '#334155', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  typeBadgeText: { fontSize: 10, color: '#94a3b8', fontWeight: '600' },
  unreadBadge: { backgroundColor: '#3b82f6', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  time: { fontSize: 12, color: '#64748b' },
  propertyName: { fontSize: 12, color: '#3b82f6', marginBottom: 4 },
  preview: { fontSize: 13, color: '#94a3b8' },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#64748b' },
  emptySubtitle: { fontSize: 14, color: '#475569', marginTop: 4 },
  // FAB
  fab: { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 4 },
  fabText: { fontSize: 28, color: '#fff', fontWeight: '400', marginTop: -2 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1e293b', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#f8fafc', marginBottom: 16, textAlign: 'center' },
  modalOption: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#0f172a', borderRadius: 12, padding: 16, marginBottom: 10 },
  modalOptionIcon: { fontSize: 24 },
  modalOptionText: { fontSize: 15, fontWeight: '600', color: '#f8fafc' },
  modalOptionSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  modalCancel: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  modalCancelText: { fontSize: 15, color: '#64748b', fontWeight: '600' },
  // Guest Picker
  pickerContent: { backgroundColor: '#1e293b', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, maxHeight: '60%' },
  pickerItem: { backgroundColor: '#0f172a', borderRadius: 12, padding: 16, marginBottom: 8 },
  pickerName: { fontSize: 15, fontWeight: '600', color: '#f8fafc' },
  pickerProperty: { fontSize: 12, color: '#3b82f6', marginTop: 4 },
  pickerEmpty: { fontSize: 14, color: '#64748b', textAlign: 'center', marginVertical: 20 },
});
