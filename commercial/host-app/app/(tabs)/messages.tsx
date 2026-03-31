import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { api, Conversation } from '../../src/lib/api';

type Tab = 'guest' | 'team';

interface InternalConversation {
  id: string;
  channelType: string;
  worker?: { id: string; user: { name: string; email?: string } };
  property?: { id: string; name: string };
  lastMessageAt?: string;
  lastMessagePreview?: string;
  unreadByHost: number;
}

interface Worker {
  id: string;
  user: { name: string };
}

export default function MessagesScreen() {
  const [tab, setTab] = useState<Tab>('guest');
  const [guestConvos, setGuestConvos] = useState<Conversation[]>([]);
  const [teamConvos, setTeamConvos] = useState<InternalConversation[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showWorkerPicker, setShowWorkerPicker] = useState(false);
  const [workers, setWorkers] = useState<Worker[]>([]);

  const loadGuest = useCallback(async () => {
    try {
      const data = await api.conversations.list();
      setGuestConvos(data);
    } catch (err: any) {
      console.error('Failed to load guest conversations:', err);
    }
  }, []);

  const loadTeam = useCallback(async () => {
    try {
      const data = await api.internalConversations.list();
      setTeamConvos(data);
    } catch (err: any) {
      console.error('Failed to load team conversations:', err);
    }
  }, []);

  const load = useCallback(async () => {
    await Promise.all([loadGuest(), loadTeam()]);
    setLoading(false);
  }, [loadGuest, loadTeam]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  async function openNewTeamChat() {
    try {
      const w = await api.workers.list();
      setWorkers(w);
      setShowWorkerPicker(true);
    } catch (err: any) {
      console.error('Failed to load workers:', err);
      Alert.alert('Error', 'Failed to load workers. Please try again.');
    }
  }

  async function startChatWithWorker(workerId: string) {
    setShowWorkerPicker(false);
    try {
      const conv = await api.internalConversations.create(workerId);
      router.push(`/conversation/${conv.id}?type=internal`);
    } catch (err: any) {
      console.error('Failed to create conversation:', err);
      Alert.alert('Error', 'Failed to start conversation. Please try again.');
    }
  }

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

  const data = tab === 'guest' ? guestConvos : teamConvos;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.header}>Messages</Text>

      {/* Tab Switcher */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, tab === 'guest' && styles.activeTab]}
          onPress={() => setTab('guest')}
        >
          <Text style={[styles.tabText, tab === 'guest' && styles.activeTabText]}>Guest</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'team' && styles.activeTab]}
          onPress={() => setTab('team')}
        >
          <Text style={[styles.tabText, tab === 'team' && styles.activeTabText]}>Team</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          if (tab === 'guest') {
            const guest = item as Conversation;
            return (
              <TouchableOpacity
                style={[styles.card, guest.unreadByHost > 0 && styles.unreadCard]}
                onPress={() => router.push(`/conversation/${guest.id}`)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.nameRow}>
                    <Text style={styles.contactName}>{guest.guestName}</Text>
                    {guest.unreadByHost > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>{guest.unreadByHost}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.time}>{timeAgo(guest.lastMessageAt)}</Text>
                </View>
                {guest.booking?.property && <Text style={styles.propertyName}>{guest.booking.property.name}</Text>}
                {guest.lastMessagePreview && <Text style={styles.preview} numberOfLines={1}>{guest.lastMessagePreview}</Text>}
              </TouchableOpacity>
            );
          }

          const team = item as InternalConversation;
          return (
            <TouchableOpacity
              style={[styles.card, team.unreadByHost > 0 && styles.unreadCard]}
              onPress={() => router.push(`/conversation/${team.id}?type=internal`)}
            >
              <View style={styles.cardHeader}>
                <View style={styles.nameRow}>
                  <Text style={styles.contactName}>{team.worker?.user?.name || 'Worker'}</Text>
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeBadgeText}>
                      {team.channelType === 'HOST_WORKER' ? 'Worker' : 'Supervisor'}
                    </Text>
                  </View>
                  {team.unreadByHost > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{team.unreadByHost}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.time}>{timeAgo(team.lastMessageAt)}</Text>
              </View>
              {team.property && <Text style={styles.propertyName}>{team.property.name}</Text>}
              {team.lastMessagePreview && <Text style={styles.preview} numberOfLines={1}>{team.lastMessagePreview}</Text>}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySubtitle}>
                {tab === 'guest' ? 'Guest messages will appear here' : 'Team messages will appear here'}
              </Text>
            </View>
          ) : null
        }
      />

      {/* FAB for new team chat */}
      {tab === 'team' && (
        <TouchableOpacity style={styles.fab} onPress={openNewTeamChat}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      {/* Worker Picker Modal */}
      <Modal visible={showWorkerPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Chat</Text>
            <Text style={styles.modalSubtitle}>Select a worker</Text>
            <FlatList
              data={workers}
              keyExtractor={(w) => w.id}
              renderItem={({ item: w }) => (
                <TouchableOpacity style={styles.workerRow} onPress={() => startChatWithWorker(w.id)}>
                  <Text style={styles.workerName}>{w.user?.name || w.id}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.emptyModal}>No workers found</Text>}
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowWorkerPicker(false)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { fontSize: 24, fontWeight: '700', color: '#f8fafc', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  tabBar: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8, gap: 8 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#1e293b', alignItems: 'center' },
  activeTab: { backgroundColor: '#3b82f6' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#94a3b8' },
  activeTabText: { color: '#fff' },
  list: { paddingHorizontal: 16, paddingBottom: 80 },
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
  fab: { position: 'absolute', right: 20, bottom: 20, backgroundColor: '#3b82f6', borderRadius: 28, width: 56, height: 56, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '400', marginTop: -2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1e293b', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '60%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#f8fafc', marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: '#94a3b8', marginBottom: 16 },
  workerRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#334155' },
  workerName: { fontSize: 15, color: '#f8fafc', fontWeight: '500' },
  emptyModal: { color: '#64748b', textAlign: 'center', paddingVertical: 20 },
  modalClose: { marginTop: 12, paddingVertical: 12, alignItems: 'center' },
  modalCloseText: { color: '#3b82f6', fontSize: 15, fontWeight: '600' },
});
