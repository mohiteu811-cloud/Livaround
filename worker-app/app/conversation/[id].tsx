import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Image,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Audio, Video, ResizeMode } from 'expo-av';
import { api } from '../../src/lib/api';
import { joinConversation, leaveConversation, getSocket } from '../../src/lib/socket';

interface Message {
  id: string;
  conversationId: string;
  senderType: string;
  senderName: string;
  content: string;
  imageUrl?: string;
  voiceUrl?: string;
  voiceDuration?: number;
  voiceTranscript?: string;
  voiceTranslation?: string;
  voiceLanguage?: string;
  visibility?: string;
  createdAt: string;
  aiSuggestion?: AiSuggestion;
  aiSuggestions?: AiSuggestion[];
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
  guest?: { id: string; name: string };
  guestName?: string;
  property?: { id: string; name: string };
}

export default function ConversationScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type?: string }>();
  const isGuest = type === 'guest';

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<{ uri: string; type: string } | null>(null);

  // Visibility toggle for guest conversations (internal notes)
  const [visibility, setVisibility] = useState<'ALL' | 'TEAM_ONLY'>('ALL');

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Voice playback state
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const flatListRef = useRef<FlatList>(null);

  // Select the right API based on conversation type
  const convApi = isGuest ? api.guestConversations : api.internalConversations;

  const load = useCallback(async () => {
    try {
      const data = await convApi.get(id);
      setConversation(data.conversation);
      setMessages(data.messages);
      setHasMore(data.hasMore);
      convApi.markRead(id).catch(() => {});
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load conversation');
    }
    setLoading(false);
  }, [id, isGuest]);

  useEffect(() => {
    load();
    joinConversation(id);

    const socket = getSocket();
    const handleNewMessage = (msg: Message) => {
      if (msg.conversationId === id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        convApi.markRead(id).catch(() => {});
      }
    };

    const handleVoiceTranslated = (data: { messageId: string; voiceTranscript?: string; voiceTranslation?: string; voiceLanguage?: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId
            ? { ...m, voiceTranscript: data.voiceTranscript, voiceTranslation: data.voiceTranslation, voiceLanguage: data.voiceLanguage }
            : m
        )
      );
    };

    socket?.on('new_message', handleNewMessage);
    socket?.on('voice_translated', handleVoiceTranslated);

    return () => {
      leaveConversation(id);
      socket?.off('new_message', handleNewMessage);
      socket?.off('voice_translated', handleVoiceTranslated);
      // Clean up audio
      soundRef.current?.unloadAsync();
      recordingRef.current?.stopAndUnloadAsync();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
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
      const msg = await convApi.sendMessage(id, text, imageUrl, undefined, undefined, visibility);
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    } catch (e: any) {
      setInput(text);
      Alert.alert('Error', e.message || 'Failed to send message');
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

  // Voice recording
  async function startRecording() {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Please grant microphone access to send voice messages.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();

      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to start recording');
    }
  }

  async function stopRecording() {
    if (!recordingRef.current) return;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    setIsRecording(false);

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      const status = await recordingRef.current.getStatusAsync();
      recordingRef.current = null;

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      if (!uri) return;

      const durationSec = Math.round((status.durationMillis || 0) / 1000);
      if (durationSec < 1) return; // Too short

      setSending(true);
      try {
        const uploaded = await api.upload.file(uri, 'audio/mp4');
        const msg = await convApi.sendMessage(id, '', undefined, uploaded.url, durationSec, visibility);
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Failed to send voice message');
      }
      setSending(false);
    } catch (e: any) {
      recordingRef.current = null;
      Alert.alert('Error', e.message || 'Failed to stop recording');
    }
  }

  // Voice playback
  async function togglePlayVoice(msg: Message) {
    if (playingMsgId === msg.id) {
      // Stop
      await soundRef.current?.stopAsync();
      await soundRef.current?.unloadAsync();
      soundRef.current = null;
      setPlayingMsgId(null);
      return;
    }

    // Stop any current playback
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }

    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri: msg.voiceUrl! });
      soundRef.current = sound;
      setPlayingMsgId(msg.id);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
          soundRef.current = null;
          setPlayingMsgId(null);
        }
      });

      await sound.playAsync();
    } catch (e: any) {
      setPlayingMsgId(null);
      Alert.alert('Error', e.message || 'Failed to play audio');
    }
  }

  function formatDuration(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function isVideoUrl(url: string): boolean {
    return /\.(mp4|mov|webm|3gpp)$/i.test(url);
  }

  function renderSenderBadge(item: Message) {
    if (!isGuest) return null;

    if (item.senderType === 'HOST') {
      return (
        <View style={[styles.senderBadge, { backgroundColor: '#1e40af' }]}>
          <Text style={styles.senderBadgeText}>Host</Text>
        </View>
      );
    }
    if (item.senderType === 'GUEST') {
      return (
        <View style={[styles.senderBadge, { backgroundColor: '#166534' }]}>
          <Text style={styles.senderBadgeText}>Guest</Text>
        </View>
      );
    }
    if (item.senderType === 'WORKER') {
      return (
        <View style={[styles.senderBadge, { backgroundColor: '#334155' }]}>
          <Text style={styles.senderBadgeText}>You</Text>
        </View>
      );
    }
    return null;
  }

  function renderVoicePlayer(item: Message) {
    const isPlaying = playingMsgId === item.id;
    return (
      <View style={styles.voiceContainer}>
        <TouchableOpacity style={styles.voicePlayBtn} onPress={() => togglePlayVoice(item)}>
          <Text style={styles.voicePlayIcon}>{isPlaying ? '⏸' : '▶️'}</Text>
        </TouchableOpacity>
        <View style={styles.voiceInfo}>
          <View style={styles.voiceWaveform}>
            {[...Array(12)].map((_, i) => (
              <View
                key={i}
                style={[styles.voiceBar, { height: 6 + Math.random() * 14 }]}
              />
            ))}
          </View>
          <Text style={styles.voiceDuration}>
            {formatDuration(item.voiceDuration || 0)}
          </Text>
        </View>
      </View>
    );
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

    const isTeamOnly = item.visibility === 'TEAM_ONLY';

    return (
      <View>
        <View style={[styles.messageBubble, isOwn ? styles.ownBubble : styles.otherBubble, isTeamOnly && styles.teamOnlyBubble]}>
          <View style={styles.senderRow}>
            <Text style={styles.senderName}>{item.senderName}</Text>
            {isTeamOnly && (
              <View style={styles.teamOnlyBadge}>
                <Text style={styles.teamOnlyBadgeText}>Team only</Text>
              </View>
            )}
            {renderSenderBadge(item)}
          </View>
          {item.voiceUrl ? (
            <>
              {renderVoicePlayer(item)}
              {item.voiceTranslation ? (
                <>
                  <Text style={styles.voiceTranslation}>Translation: {item.voiceTranslation}</Text>
                  {item.voiceTranscript && (
                    <Text style={styles.voiceTranscriptSmall}>{item.voiceTranscript}</Text>
                  )}
                </>
              ) : item.voiceTranscript ? (
                <Text style={styles.voiceTranscript}>{item.voiceTranscript}</Text>
              ) : null}
            </>
          ) : null}
          {item.imageUrl && (
            isVideoUrl(item.imageUrl) ? (
              <Video
                source={{ uri: item.imageUrl }}
                style={styles.messageVideo}
                resizeMode={ResizeMode.CONTAIN}
                useNativeControls
                isLooping={false}
              />
            ) : (
              <Image source={{ uri: item.imageUrl }} style={styles.messageImage} resizeMode="cover" />
            )
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
        {(() => {
          const suggestions = item.aiSuggestions || (item.aiSuggestion ? [item.aiSuggestion] : []);
          const pending = suggestions.filter(s => s.status === 'PENDING');
          if (pending.length === 0) return null;
          return (
            <View style={styles.aiCard}>
              {pending.length > 1 && (
                <Text style={styles.aiMultiTitle}>AI detected {pending.length} action items</Text>
              )}
              {pending.map((s) => (
                <View key={s.id} style={styles.aiItemRow}>
                  <View style={styles.aiHeader}>
                    <Text style={styles.aiIcon}>✨</Text>
                    <Text style={styles.aiBadge}>{s.category}</Text>
                    <Text style={[styles.aiUrgency, { color: urgencyColor(s.urgency) }]}>{s.urgency}</Text>
                  </View>
                  <Text style={styles.aiSummary}>{s.summary}</Text>
                </View>
              ))}
              <Text style={styles.aiNote}>Host will review {pending.length > 1 ? 'these suggestions' : 'this suggestion'}</Text>
            </View>
          );
        })()}
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

  const headerName = isGuest
    ? (conversation?.guestName || conversation?.guest?.name || 'Guest')
    : (conversation?.host?.name || 'Host');

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
        {isGuest && (
          <View style={styles.headerTypeBadge}>
            <Text style={styles.headerTypeBadgeText}>Guest Chat</Text>
          </View>
        )}
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

        {/* Recording overlay - WhatsApp style */}
        {isRecording && (
          <View style={styles.recordingOverlay}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>{formatDuration(recordingDuration)}</Text>
            <Text style={styles.recordingHint}>Release to send</Text>
          </View>
        )}

        {mediaPreview && (
          <View style={styles.mediaPreview}>
            <Image source={{ uri: mediaPreview.uri }} style={styles.previewImage} />
            <TouchableOpacity onPress={() => setMediaPreview(null)} style={styles.cancelMedia}>
              <Text style={styles.cancelMediaText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Visibility toggle — only for GUEST_HOST conversations */}
        {isGuest && (
          <TouchableOpacity
            style={[styles.visibilityToggle, visibility === 'TEAM_ONLY' && styles.visibilityToggleActive]}
            onPress={() => setVisibility((v) => v === 'ALL' ? 'TEAM_ONLY' : 'ALL')}
          >
            <Text style={styles.visibilityToggleText}>
              {visibility === 'TEAM_ONLY' ? '🔒 Team only — guest won\'t see this' : '🌐 Everyone'}
            </Text>
          </TouchableOpacity>
        )}

        <View style={[styles.inputBar, visibility === 'TEAM_ONLY' && styles.inputBarTeamOnly]}>
          <TouchableOpacity onPress={takePhoto} style={styles.mediaButton}>
            <Text style={styles.mediaButtonText}>📷</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={pickImage} style={styles.mediaButton}>
            <Text style={styles.mediaButtonText}>🖼</Text>
          </TouchableOpacity>
          <TextInput
            style={[styles.textInput, visibility === 'TEAM_ONLY' && styles.textInputTeamOnly]}
            value={input}
            onChangeText={setInput}
            placeholder={visibility === 'TEAM_ONLY' ? 'Internal note...' : 'Type a message...'}
            placeholderTextColor={visibility === 'TEAM_ONLY' ? '#92400e' : '#64748b'}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={styles.micButton}
            onPressIn={startRecording}
            onPressOut={stopRecording}
          >
            <Text style={[styles.micIcon, isRecording && styles.micRecording]}>🎙</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.sendButton,
              visibility === 'TEAM_ONLY' && styles.sendButtonTeamOnly,
              (!input.trim() && !mediaPreview || sending) && styles.sendDisabled,
            ]}
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
  headerTypeBadge: { backgroundColor: '#166534', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  headerTypeBadgeText: { fontSize: 11, color: '#4ade80', fontWeight: '600' },
  chatArea: { flex: 1 },
  messagesList: { paddingHorizontal: 16, paddingVertical: 12 },
  messageBubble: { maxWidth: '80%', borderRadius: 16, padding: 12, marginBottom: 8 },
  ownBubble: { backgroundColor: '#1e40af', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  otherBubble: { backgroundColor: '#1e293b', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  senderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  senderName: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  senderBadge: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  senderBadgeText: { fontSize: 9, color: '#fff', fontWeight: '700' },
  messageText: { fontSize: 15, lineHeight: 20 },
  ownText: { color: '#fff' },
  otherText: { color: '#e2e8f0' },
  messageTime: { fontSize: 10, color: '#64748b', marginTop: 4, alignSelf: 'flex-end' },
  messageImage: { width: 200, height: 150, borderRadius: 8, marginBottom: 4 },
  messageVideo: { width: 200, height: 150, borderRadius: 8, marginBottom: 4, backgroundColor: '#000' },
  systemMessage: { alignSelf: 'center', backgroundColor: '#334155', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 8 },
  systemText: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic' },
  emptyChat: { alignItems: 'center', marginTop: 40 },
  emptyChatText: { color: '#64748b', fontSize: 14 },
  // Voice recording
  voiceContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4, minWidth: 180 },
  voicePlayBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center' },
  voicePlayIcon: { fontSize: 18, color: '#fff' },
  voiceInfo: { flex: 1 },
  voiceWaveform: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 24, marginBottom: 2 },
  voiceBar: { width: 3, backgroundColor: '#94a3b8', borderRadius: 1.5 },
  voiceDuration: { fontSize: 12, color: '#94a3b8', fontVariant: ['tabular-nums'] },
  voiceTranscript: { fontSize: 13, color: '#cbd5e1', marginTop: 4, fontStyle: 'italic' },
  voiceTranscriptSmall: { fontSize: 11, color: '#94a3b8', marginTop: 2, fontStyle: 'italic' },
  voiceTranslation: { fontSize: 14, color: '#3b82f6', marginTop: 4, fontWeight: '600' },
  recordingOverlay: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#1c1917', borderTopWidth: 1, borderTopColor: '#ef4444' },
  recordingDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#ef4444' },
  recordingText: { fontSize: 16, color: '#ef4444', fontWeight: '700', fontVariant: ['tabular-nums'] },
  recordingHint: { flex: 1, textAlign: 'right', fontSize: 13, color: '#a1a1aa' },
  micButton: { padding: 8 },
  micIcon: { fontSize: 20 },
  micRecording: { opacity: 0.5 },
  // Team-only (internal notes) styles
  teamOnlyBubble: { borderWidth: 1, borderColor: '#d97706', backgroundColor: 'rgba(217, 119, 6, 0.1)' },
  teamOnlyBadge: { backgroundColor: '#d97706', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  teamOnlyBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  visibilityToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, backgroundColor: '#1e293b' },
  visibilityToggleActive: { backgroundColor: 'rgba(217, 119, 6, 0.15)' },
  visibilityToggleText: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
  inputBarTeamOnly: { borderTopColor: '#d97706' },
  textInputTeamOnly: { borderColor: '#d97706' },
  sendButtonTeamOnly: { backgroundColor: '#d97706' },
  // AI suggestion card (read-only for workers)
  aiCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 12, marginBottom: 8, marginLeft: 8, borderLeftWidth: 3, borderLeftColor: '#3b82f6', gap: 8 },
  aiMultiTitle: { fontSize: 14, fontWeight: '700', color: '#3b82f6', marginBottom: 2 },
  aiItemRow: { gap: 4 },
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
