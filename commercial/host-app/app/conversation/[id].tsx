import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  Image, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { api, Message, Conversation } from '../../src/lib/api';
import { joinConversation, leaveConversation, getSocket } from '../../src/lib/socket';

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<{ uri: string; mimeType: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.conversations.get(id);
      setConversation(data.conversation);
      setMessages(data.messages);
      setHasMore(data.hasMore);
      // Mark as read
      api.conversations.markRead(id).catch(() => {});
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
        // Mark read if we're viewing this conversation
        api.conversations.markRead(id).catch(() => {});
      }
    };

    socket?.on('new_message', handleNewMessage);

    return () => {
      leaveConversation(id);
      socket?.off('new_message', handleNewMessage);
    };
  }, [id, load]);

  async function pickFromGallery() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      const mimeType = asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
      setMediaPreview({ uri: asset.uri, mimeType });
    }
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please allow access to your camera.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      const mimeType = asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
      setMediaPreview({ uri: asset.uri, mimeType });
    }
  }

  function clearMediaPreview() {
    setMediaPreview(null);
  }

  async function handleSend() {
    const text = input.trim();
    if ((!text && !mediaPreview) || sending || uploading) return;

    setSending(true);
    setInput('');

    let imageUrl: string | undefined;

    // Upload media if selected
    if (mediaPreview) {
      setUploading(true);
      try {
        imageUrl = await api.upload.file(mediaPreview.uri, mediaPreview.mimeType);
      } catch {
        Alert.alert('Upload failed', 'Could not upload the file. Please try again.');
        setInput(text);
        setSending(false);
        setUploading(false);
        return;
      }
      setUploading(false);
      setMediaPreview(null);
    }

    try {
      const msg = await api.conversations.sendMessage(id, text || '', imageUrl);
      // Message will arrive via socket, but add optimistically
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    } catch {
      setInput(text); // Restore on failure
    }
    setSending(false);
  }

  async function loadMore() {
    if (!hasMore || messages.length === 0) return;
    const oldest = messages[0];
    try {
      const data = await api.conversations.get(id, oldest.createdAt);
      setMessages((prev) => [...data.messages, ...prev]);
      setHasMore(data.hasMore);
    } catch {}
  }

  function isVideoUrl(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm');
  }

  function renderMessage({ item }: { item: Message }) {
    const isHost = item.senderType === 'HOST';
    const isSystem = item.senderType === 'SYSTEM';

    if (isSystem) {
      return (
        <View style={styles.systemMessage}>
          <Text style={styles.systemText}>{item.content}</Text>
        </View>
      );
    }

    return (
      <View style={[styles.messageBubble, isHost ? styles.hostBubble : styles.guestBubble]}>
        <Text style={styles.senderName}>{item.senderName}</Text>

        {item.imageUrl && (
          isVideoUrl(item.imageUrl) ? (
            <TouchableOpacity
              style={styles.mediaContainer}
              onPress={() => Linking.openURL(item.imageUrl!)}
              activeOpacity={0.8}
            >
              <View style={styles.videoPlaceholder}>
                <Text style={styles.videoPlayIcon}>▶</Text>
                <Text style={styles.videoLabel}>Video</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.mediaContainer}
              onPress={() => Linking.openURL(item.imageUrl!)}
              activeOpacity={0.8}
            >
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.messageImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          )
        )}

        {item.content ? (
          <Text style={[styles.messageText, isHost ? styles.hostText : styles.guestText]}>
            {item.content}
          </Text>
        ) : null}

        <Text style={styles.messageTime}>
          {new Date(item.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </Text>
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

  const canSend = (input.trim() || mediaPreview) && !sending && !uploading;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{conversation?.guestName || 'Chat'}</Text>
          {conversation?.booking?.property && (
            <Text style={styles.headerProperty}>{conversation.booking.property.name}</Text>
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
          onStartReached={loadMore}
          onStartReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatText}>No messages yet. Start the conversation!</Text>
            </View>
          }
        />

        {/* Media preview bar */}
        {mediaPreview && (
          <View style={styles.mediaPreviewBar}>
            {mediaPreview.mimeType.startsWith('video') ? (
              <View style={styles.mediaPreviewVideoThumb}>
                <Text style={styles.mediaPreviewVideoIcon}>▶</Text>
              </View>
            ) : (
              <Image source={{ uri: mediaPreview.uri }} style={styles.mediaPreviewImage} resizeMode="cover" />
            )}
            {uploading && (
              <ActivityIndicator color="#3b82f6" size="small" style={styles.uploadingIndicator} />
            )}
            <TouchableOpacity style={styles.mediaPreviewCancel} onPress={clearMediaPreview}>
              <Text style={styles.mediaPreviewCancelText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.inputBar}>
          <TouchableOpacity style={styles.mediaButton} onPress={takePhoto}>
            <Text style={styles.mediaButtonText}>📷</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mediaButton} onPress={pickFromGallery}>
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
            style={[styles.sendButton, !canSend && styles.sendDisabled]}
            onPress={handleSend}
            disabled={!canSend}
          >
            {sending || uploading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.sendText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
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
  hostBubble: { backgroundColor: '#1e40af', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  guestBubble: { backgroundColor: '#1e293b', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  senderName: { fontSize: 11, color: '#94a3b8', marginBottom: 2, fontWeight: '600' },
  messageText: { fontSize: 15, lineHeight: 20 },
  hostText: { color: '#fff' },
  guestText: { color: '#e2e8f0' },
  messageTime: { fontSize: 10, color: '#64748b', marginTop: 4, alignSelf: 'flex-end' },
  systemMessage: { alignSelf: 'center', backgroundColor: '#334155', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 8 },
  systemText: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic' },
  emptyChat: { alignItems: 'center', marginTop: 40 },
  emptyChatText: { color: '#64748b', fontSize: 14 },

  // Media in message bubbles
  mediaContainer: { marginVertical: 6, borderRadius: 12, overflow: 'hidden' },
  messageImage: { width: 250, aspectRatio: 4 / 3, borderRadius: 12 },
  videoPlaceholder: { width: 250, aspectRatio: 4 / 3, backgroundColor: '#334155', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  videoPlayIcon: { fontSize: 36, color: '#fff', marginBottom: 4 },
  videoLabel: { fontSize: 13, color: '#94a3b8', fontWeight: '600' },

  // Media preview bar
  mediaPreviewBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#1e293b', backgroundColor: '#1e293b' },
  mediaPreviewImage: { width: 60, height: 60, borderRadius: 8 },
  mediaPreviewVideoThumb: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center' },
  mediaPreviewVideoIcon: { fontSize: 22, color: '#fff' },
  uploadingIndicator: { marginLeft: 12 },
  mediaPreviewCancel: { marginLeft: 'auto', backgroundColor: '#475569', borderRadius: 14, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  mediaPreviewCancelText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Input bar
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#1e293b', backgroundColor: '#0f172a' },
  mediaButton: { padding: 8, marginBottom: 2 },
  mediaButtonText: { fontSize: 22 },
  textInput: { flex: 1, backgroundColor: '#1e293b', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: '#f8fafc', fontSize: 15, maxHeight: 100, borderWidth: 1, borderColor: '#334155' },
  sendButton: { backgroundColor: '#3b82f6', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10, marginLeft: 8, minWidth: 56, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.4 },
  sendText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
