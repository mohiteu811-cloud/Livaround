import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Image,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Audio, Video, ResizeMode } from 'expo-av';
import { api, Message, Conversation } from '../../src/lib/api';
import { joinConversation, leaveConversation, getSocket } from '../../src/lib/socket';

interface AiSuggestion {
  id: string;
  messageId?: string;
  category: string;
  urgency: string;
  sentiment: string;
  summary: string;
  suggestedAction: string;
  suggestedReply?: string;
  status: string;
  createdIssueId?: string;
  createdJobId?: string;
}

interface MessageWithAi extends Message {
  aiSuggestion?: AiSuggestion;
}

export default function ConversationScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type?: string }>();
  const isInternal = type === 'internal';
  const [conversation, setConversation] = useState<any>(null);
  const [messages, setMessages] = useState<MessageWithAi[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<{ uri: string; type: string } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceSoundRef = useRef<Audio.Sound | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    try {
      const data = isInternal
        ? await api.internalConversations.get(id)
        : await api.conversations.get(id);
      setConversation(data.conversation);
      setMessages(data.messages);
      setHasMore(data.hasMore);
      if (isInternal) {
        api.internalConversations.markRead(id).catch(() => {});
      } else {
        api.conversations.markRead(id).catch(() => {});
      }
    } catch {}
    setLoading(false);
  }, [id, isInternal]);

  useEffect(() => {
    load();
    joinConversation(id);

    const socket = getSocket();
    const handleNewMessage = (msg: MessageWithAi) => {
      if (msg.conversationId === id) {
        setMessages((prev) => [...prev, msg]);
        if (isInternal) {
          api.internalConversations.markRead(id).catch(() => {});
        } else {
          api.conversations.markRead(id).catch(() => {});
        }
      }
    };

    const handleAiSuggestion = (suggestion: AiSuggestion) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === suggestion.messageId ? { ...m, aiSuggestion: suggestion } : m
        )
      );
    };

    const handleVoiceTranslated = (data: any) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId
            ? { ...m, voiceTranscript: data.voiceTranscript, voiceTranslation: data.voiceTranslation, voiceLanguage: data.voiceLanguage }
            : m
        )
      );
    };

    socket?.on('new_message', handleNewMessage);
    socket?.on('ai_suggestion', handleAiSuggestion);
    socket?.on('voice_translated', handleVoiceTranslated);

    return () => {
      leaveConversation(id);
      socket?.off('new_message', handleNewMessage);
      socket?.off('ai_suggestion', handleAiSuggestion);
      socket?.off('voice_translated', handleVoiceTranslated);
    };
  }, [id, load, isInternal]);

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
      const msg = isInternal
        ? await api.internalConversations.sendMessage(id, text, imageUrl)
        : await api.conversations.sendMessage(id, text, imageUrl);
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

  async function startRecording() {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch {}
  }

  async function stopRecording() {
    if (!recordingRef.current) return;
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    try {
      await recordingRef.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (!uri) return;
      const duration = recordingDuration;

      setSending(true);
      const uploaded = await api.upload.file(uri, 'audio/mp4');
      const msg = isInternal
        ? await api.internalConversations.sendMessage(id, '', undefined, uploaded.url, duration)
        : await api.conversations.sendMessage(id, '', undefined, uploaded.url, duration);
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setSending(false);
    } catch {
      recordingRef.current = null;
      setSending(false);
    }
  }

  async function playVoice(messageId: string, voiceUrl: string) {
    try {
      if (voiceSoundRef.current) {
        await voiceSoundRef.current.unloadAsync();
        voiceSoundRef.current = null;
      }
      if (playingVoiceId === messageId) {
        setPlayingVoiceId(null);
        return;
      }
      const { sound } = await Audio.Sound.createAsync({ uri: voiceUrl });
      voiceSoundRef.current = sound;
      setPlayingVoiceId(messageId);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingVoiceId(null);
          sound.unloadAsync();
          voiceSoundRef.current = null;
        }
      });
      await sound.playAsync();
    } catch {
      setPlayingVoiceId(null);
    }
  }

  function isVideoUrl(url: string): boolean {
    return /\.(mp4|mov|webm|avi)(\?.*)?$/i.test(url);
  }

  function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  async function approveSuggestion(suggestion: AiSuggestion) {
    try {
      await api.aiSuggestions.approve(suggestion.id);
      setMessages((prev) =>
        prev.map((m) =>
          m.aiSuggestion?.id === suggestion.id
            ? { ...m, aiSuggestion: { ...m.aiSuggestion!, status: 'APPROVED' } }
            : m
        )
      );
    } catch {}
  }

  async function dismissSuggestion(suggestion: AiSuggestion) {
    try {
      await api.aiSuggestions.dismiss(suggestion.id);
      setMessages((prev) =>
        prev.map((m) =>
          m.aiSuggestion?.id === suggestion.id
            ? { ...m, aiSuggestion: { ...m.aiSuggestion!, status: 'DISMISSED' } }
            : m
        )
      );
    } catch {}
  }

  function renderMessage({ item }: { item: MessageWithAi }) {
    const isHost = item.senderType === 'HOST';
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
        <View style={[styles.messageBubble, isHost ? styles.hostBubble : styles.otherBubble]}>
          <View style={styles.senderRow}>
            <Text style={styles.senderName}>{item.senderName}</Text>
            {!isInternal && item.senderType === 'WORKER' && (
              <View style={styles.workerBadge}>
                <Text style={styles.workerBadgeText}>Worker</Text>
              </View>
            )}
          </View>
          {item.imageUrl && !isVideoUrl(item.imageUrl) && (
            <Image source={{ uri: item.imageUrl }} style={styles.messageImage} resizeMode="cover" />
          )}
          {item.imageUrl && isVideoUrl(item.imageUrl) && (
            <Video
              source={{ uri: item.imageUrl }}
              style={styles.messageVideo}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
              isLooping={false}
            />
          )}
          {item.voiceUrl ? (
            <View style={styles.voicePlayer}>
              <TouchableOpacity onPress={() => playVoice(item.id, item.voiceUrl!)} style={styles.voicePlayBtn}>
                <Text style={styles.voicePlayBtnText}>{playingVoiceId === item.id ? '⏸' : '▶'}</Text>
              </TouchableOpacity>
              <View style={styles.voiceInfo}>
                <View style={styles.voiceWaveform} />
                <Text style={styles.voiceDurationText}>
                  {item.voiceDuration ? formatDuration(item.voiceDuration) : '0:00'}
                </Text>
              </View>
            </View>
          ) : null}
          {item.voiceUrl && item.voiceTranslation ? (
            <View style={styles.voiceTranscriptContainer}>
              <Text style={styles.voiceTranslationText}>Translation: {item.voiceTranslation}</Text>
              {item.voiceTranscript ? (
                <Text style={styles.voiceTranscriptText}>{item.voiceTranscript}</Text>
              ) : null}
            </View>
          ) : item.voiceUrl && item.voiceTranscript ? (
            <Text style={styles.voiceTranscriptText}>{item.voiceTranscript}</Text>
          ) : null}
          {!item.voiceUrl && item.content ? (
            <Text style={[styles.messageText, isHost ? styles.hostText : styles.otherText]}>
              {item.content}
            </Text>
          ) : null}
          <Text style={styles.messageTime}>
            {new Date(item.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        {item.aiSuggestion && renderAiCard(item.aiSuggestion)}
      </View>
    );
  }

  function renderAiCard(suggestion: AiSuggestion) {
    if (suggestion.status === 'DISMISSED') return null;

    const isApproved = suggestion.status === 'APPROVED';
    const isPending = suggestion.status === 'PENDING';

    return (
      <View style={[styles.aiCard, isPending && styles.aiCardPending, isApproved && styles.aiCardApproved]}>
        <View style={styles.aiHeader}>
          <Text style={styles.aiIcon}>{isApproved ? '✓' : '✨'}</Text>
          <Text style={styles.aiBadgeText}>{suggestion.category}</Text>
          <Text style={[styles.aiUrgency, { color: urgencyColor(suggestion.urgency) }]}>
            {suggestion.urgency}
          </Text>
        </View>
        <Text style={styles.aiSummary}>{suggestion.summary}</Text>
        {suggestion.suggestedReply && isPending && (
          <Text style={styles.aiReply}>Suggested reply: "{suggestion.suggestedReply}"</Text>
        )}
        {isPending && (
          <View style={styles.aiActions}>
            <TouchableOpacity style={styles.aiApproveBtn} onPress={() => approveSuggestion(suggestion)}>
              <Text style={styles.aiApproveBtnText}>
                {suggestion.suggestedAction === 'CREATE_ISSUE' ? 'Create Issue' :
                 suggestion.suggestedAction === 'CREATE_JOB' ? 'Create Job' :
                 suggestion.suggestedAction === 'DISPATCH_WORKER' ? 'Dispatch Worker' :
                 suggestion.suggestedAction === 'AUTO_REPLY' ? 'Send Reply' : 'Approve'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.aiDismissBtn} onPress={() => dismissSuggestion(suggestion)}>
              <Text style={styles.aiDismissBtnText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        )}
        {isApproved && (
          <Text style={styles.aiApprovedText}>
            {suggestion.createdIssueId ? 'Issue created' : suggestion.createdJobId ? 'Job created' : 'Approved'}
          </Text>
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

  const headerName = isInternal
    ? (conversation?.worker?.user?.name || 'Worker')
    : (conversation?.guestName || 'Chat');
  const headerSub = isInternal
    ? (conversation?.property?.name || '')
    : (conversation?.booking?.property?.name || '');

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{headerName}</Text>
          {headerSub ? <Text style={styles.headerProperty}>{headerSub}</Text> : null}
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

        {isRecording && (
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>Recording... {formatDuration(recordingDuration)}</Text>
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
            style={[styles.micButton, isRecording && styles.micButtonActive]}
            onPressIn={startRecording}
            onPressOut={stopRecording}
          >
            <Text style={styles.micButtonText}>🎙</Text>
          </TouchableOpacity>
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
  hostBubble: { backgroundColor: '#1e40af', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  otherBubble: { backgroundColor: '#1e293b', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  senderName: { fontSize: 11, color: '#94a3b8', marginBottom: 2, fontWeight: '600' },
  messageText: { fontSize: 15, lineHeight: 20 },
  hostText: { color: '#fff' },
  otherText: { color: '#e2e8f0' },
  messageTime: { fontSize: 10, color: '#64748b', marginTop: 4, alignSelf: 'flex-end' },
  messageImage: { width: 200, height: 150, borderRadius: 8, marginBottom: 4 },
  systemMessage: { alignSelf: 'center', backgroundColor: '#334155', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 8 },
  systemText: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic' },
  emptyChat: { alignItems: 'center', marginTop: 40 },
  emptyChatText: { color: '#64748b', fontSize: 14 },
  // AI cards
  aiCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 12, marginBottom: 8, marginLeft: 8, borderLeftWidth: 3, borderLeftColor: '#3b82f6' },
  aiCardPending: { borderLeftColor: '#3b82f6' },
  aiCardApproved: { borderLeftColor: '#22c55e' },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  aiIcon: { fontSize: 14 },
  aiBadgeText: { backgroundColor: '#334155', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, fontSize: 10, color: '#94a3b8', fontWeight: '600', overflow: 'hidden' },
  aiUrgency: { fontSize: 10, fontWeight: '700' },
  aiSummary: { fontSize: 13, color: '#e2e8f0', marginBottom: 4 },
  aiReply: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic', marginBottom: 8 },
  aiActions: { flexDirection: 'row', gap: 8 },
  aiApproveBtn: { backgroundColor: '#3b82f6', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  aiApproveBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  aiDismissBtn: { backgroundColor: '#334155', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  aiDismissBtnText: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  aiApprovedText: { fontSize: 11, color: '#22c55e', fontWeight: '600' },
  // Sender row & Worker badge
  senderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  workerBadge: { backgroundColor: '#f59e0b', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  workerBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  // Voice player
  voicePlayer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 },
  voicePlayBtn: { backgroundColor: '#3b82f6', borderRadius: 16, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  voicePlayBtnText: { color: '#fff', fontSize: 14 },
  voiceInfo: { flex: 1, gap: 2 },
  voiceWaveform: { height: 4, backgroundColor: '#475569', borderRadius: 2 },
  voiceDurationText: { fontSize: 11, color: '#94a3b8' },
  voiceTranscriptContainer: { marginTop: 4 },
  voiceTranslationText: { fontSize: 14, color: '#e2e8f0', fontWeight: '600', marginBottom: 2 },
  voiceTranscriptText: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic' },
  // Video
  messageVideo: { width: 200, height: 150, borderRadius: 8, marginBottom: 4, backgroundColor: '#000' },
  // Recording indicator
  recordingIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, backgroundColor: '#1e293b', gap: 8 },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444' },
  recordingText: { color: '#ef4444', fontSize: 13, fontWeight: '600' },
  // Mic button
  micButton: { padding: 8 },
  micButtonActive: { backgroundColor: '#ef4444', borderRadius: 20 },
  micButtonText: { fontSize: 20 },
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
