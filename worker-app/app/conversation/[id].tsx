import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Image,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../src/lib/api';
import { joinConversation, leaveConversation, getSocket } from '../../src/lib/socket';

interface Message {
  id: string;
  conversationId: string;
  senderType: string;
  senderName: string;
  content: string;
  imageUrl?: string;
  createdAt: string;
  aiSuggestion?: AiSuggestion;
}

interface AiSuggestion {
  id: string;
  category: string;
  urgency: string;
  summary: string;
  suggestedAction: string;
  status: string;
}

interface Conversation {
  id: string;
  channelType: string;
  host?: { id: string; name: string };
  worker?: { id: string; user: { name: string } };
  property?: { id: string; name: string };
}

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<{ uri: string; type: string } | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.internalConversations.get(id);
      setConversation(data.conversation);
      setMessages(data.messages);
      setHasMore(data.hasMore);
      api.internalConversations.markRead(id).catch(() => {});
    } catch {}
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
    joinConversation(id);

    const socket = getSocket();
    const handleNewMessage = (msg: Message) => {
      if (msg.conversationId === id) {
        setMessages((prev) => [...prev, msg]);
        api.internalConversations.markRead(id).catch(() => {});
      }
    };

    socket?.on('new_message', handleNewMessage);

    return () => {
      leaveConversation(id);
      socket?.off('new_message', handleNewMessage);
    };
  }, [id, load]);

  async function handleSend() {
    const text = input.trim();
    if ((!text && !mediaPreview) || sending) return;

    setSending(true);
    setInput('');

    try {
      let imageUrl: string | undefined;
      if (mediaPreview) {
        const uploaded = await api.upload.file(mediaPreview.uri, mediaPreview.type);
        imageUrl = uploaded.url;
        setMediaPreview(null);
      }
      const msg = await api.internalConversations.sendMessage(id, text, imageUrl);
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    } catch {
      setInput(text);
    }
    setSending(false);
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setMediaPreview({ uri: result.assets[0].uri, type: result.assets[0].mimeType || 'image/jpeg' });
    }
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setMediaPreview({ uri: result.assets[0].uri, type: result.assets[0].mimeType || 'image/jpeg' });
    }
  }

  function renderMessage({ item }: { item: Message }) {
    const isOwn = item.senderType === 'WORKER' || item.senderType === 'SUPERVISOR';
    const isSystem = item.senderType === 'SYSTEM' || item.senderType === 'AI';

    if (isSystem) {
      return (
        <View style={styles.systemMessage}>
          <Text style={styles.systemText}>{item.content}</Text>
        </View>
      );
    }

    return (
      <View>
        <View style={[styles.messageBubble, isOwn ? styles.ownBubble : styles.otherBubble]}>
          <Text style={styles.senderName}>{item.senderName}</Text>
          {item.imageUrl && (
            <Image source={{ uri: item.imageUrl }} style={styles.messageImage} resizeMode="cover" />
          )}
          {item.content ? (
            <Text style={[styles.messageText, isOwn ? styles.ownText : styles.otherText]}>
              {item.content}
            </Text>
          ) : null}
          <Text style={styles.messageTime}>
            {new Date(item.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        {item.aiSuggestion && item.aiSuggestion.status === 'PENDING' && (
          <View style={styles.aiCard}>
            <View style={styles.aiHeader}>
              <Text style={styles.aiIcon}>✨</Text>
              <Text style={styles.aiBadge}>{item.aiSuggestion.category}</Text>
              <Text style={[styles.aiUrgency, { color: urgencyColor(item.aiSuggestion.urgency) }]}>
                {item.aiSuggestion.urgency}
              </Text>
            </View>
            <Text style={styles.aiSummary}>{item.aiSuggestion.summary}</Text>
            <Text style={styles.aiNote}>Host will review this suggestion</Text>
          </View>
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ActivityIndicator color="#3b82f6" size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  const headerName = conversation?.host?.name || 'Host';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{headerName}</Text>
          {conversation?.property && (
            <Text style={styles.headerProperty}>{conversation.property.name}</Text>
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.chatArea}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatText}>No messages yet. Start the conversation!</Text>
            </View>
          }
        />

        {mediaPreview && (
          <View style={styles.mediaPreview}>
            <Image source={{ uri: mediaPreview.uri }} style={styles.previewImage} />
            <TouchableOpacity onPress={() => setMediaPreview(null)} style={styles.cancelMedia}>
              <Text style={styles.cancelMediaText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.inputBar}>
          <TouchableOpacity onPress={takePhoto} style={styles.mediaButton}>
            <Text style={styles.mediaButtonText}>📷</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={pickImage} style={styles.mediaButton}>
            <Text style={styles.mediaButtonText}>🖼</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Type a message..."
            placeholderTextColor="#64748b"
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!input.trim() && !mediaPreview || sending) && styles.sendDisabled]}
            onPress={handleSend}
            disabled={(!input.trim() && !mediaPreview) || sending}
          >
            <Text style={styles.sendText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function urgencyColor(urgency: string): string {
  switch (urgency) {
    case 'CRITICAL': return '#ef4444';
    case 'HIGH': return '#f97316';
    case 'MEDIUM': return '#eab308';
    default: return '#94a3b8';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  backButton: { marginRight: 12 },
  backText: { color: '#3b82f6', fontSize: 16, fontWeight: '600' },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 17, fontWeight: '700', color: '#f8fafc' },
  headerProperty: { fontSize: 12, color: '#94a3b8', marginTop: 1 },
  chatArea: { flex: 1 },
  messagesList: { paddingHorizontal: 16, paddingVertical: 12 },
  messageBubble: { maxWidth: '80%', borderRadius: 16, padding: 12, marginBottom: 8 },
  ownBubble: { backgroundColor: '#1e40af', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  otherBubble: { backgroundColor: '#1e293b', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  senderName: { fontSize: 11, color: '#94a3b8', marginBottom: 2, fontWeight: '600' },
  messageText: { fontSize: 15, lineHeight: 20 },
  ownText: { color: '#fff' },
  otherText: { color: '#e2e8f0' },
  messageTime: { fontSize: 10, color: '#64748b', marginTop: 4, alignSelf: 'flex-end' },
  messageImage: { width: 200, height: 150, borderRadius: 8, marginBottom: 4 },
  systemMessage: { alignSelf: 'center', backgroundColor: '#334155', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 8 },
  systemText: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic' },
  emptyChat: { alignItems: 'center', marginTop: 40 },
  emptyChatText: { color: '#64748b', fontSize: 14 },
  // AI suggestion card (read-only for workers)
  aiCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 12, marginBottom: 8, marginLeft: 8, borderLeftWidth: 3, borderLeftColor: '#3b82f6' },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  aiIcon: { fontSize: 14 },
  aiBadge: { backgroundColor: '#334155', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, fontSize: 10, color: '#94a3b8', fontWeight: '600', overflow: 'hidden' },
  aiUrgency: { fontSize: 10, fontWeight: '700' },
  aiSummary: { fontSize: 13, color: '#e2e8f0', marginBottom: 4 },
  aiNote: { fontSize: 11, color: '#64748b', fontStyle: 'italic' },
  // Media
  mediaPreview: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#1e293b' },
  previewImage: { width: 60, height: 60, borderRadius: 8 },
  cancelMedia: { marginLeft: 8, backgroundColor: '#334155', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  cancelMediaText: { color: '#f8fafc', fontSize: 12, fontWeight: '700' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#1e293b', backgroundColor: '#0f172a' },
  mediaButton: { padding: 8 },
  mediaButtonText: { fontSize: 20 },
  textInput: { flex: 1, backgroundColor: '#1e293b', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: '#f8fafc', fontSize: 15, maxHeight: 100, borderWidth: 1, borderColor: '#334155' },
  sendButton: { backgroundColor: '#3b82f6', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10, marginLeft: 8 },
  sendDisabled: { opacity: 0.4 },
  sendText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
