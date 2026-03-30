import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { api, Conversation } from '../../src/lib/api';

export default function MessagesScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.conversations.list();
      setConversations(data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

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
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Messages</Text>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, item.unreadByHost > 0 && styles.unreadCard]}
            onPress={() => router.push(`/conversation/${item.id}`)}
          >
            <View style={styles.cardHeader}>
              <View style={styles.nameRow}>
                <Text style={styles.guestName}>{item.guestName}</Text>
                {item.unreadByHost > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{item.unreadByHost}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.time}>{timeAgo(item.lastMessageAt)}</Text>
            </View>
            {item.booking?.property && (
              <Text style={styles.propertyName}>{item.booking.property.name}</Text>
            )}
            {item.lastMessagePreview && (
              <Text style={styles.preview} numberOfLines={1}>{item.lastMessagePreview}</Text>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySubtitle}>Guest messages will appear here</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { fontSize: 24, fontWeight: '700', color: '#f8fafc', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#334155' },
  unreadCard: { borderColor: '#3b82f6', borderWidth: 1.5 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  guestName: { fontSize: 15, fontWeight: '600', color: '#f8fafc' },
  unreadBadge: { backgroundColor: '#3b82f6', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  time: { fontSize: 12, color: '#64748b' },
  propertyName: { fontSize: 12, color: '#3b82f6', marginBottom: 4 },
  preview: { fontSize: 13, color: '#94a3b8' },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#64748b' },
  emptySubtitle: { fontSize: 14, color: '#475569', marginTop: 4 },
});
