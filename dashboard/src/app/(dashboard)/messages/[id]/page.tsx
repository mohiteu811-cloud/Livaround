'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, ConversationDetail, MessageItem } from '@/lib/api';
import { FeatureGate } from '@/components/FeatureGate';
import { ArrowLeft, Send, Sparkles, Check, X, Mic, Paperclip } from 'lucide-react';

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

interface MessageWithAi extends MessageItem {
  aiSuggestion?: AiSuggestion;
}

const urgencyColors: Record<string, string> = {
  CRITICAL: 'text-red-400 bg-red-500/10 border-red-500/30',
  HIGH: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  MEDIUM: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  LOW: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
};

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<MessageWithAi[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [mediaPreview, setMediaPreview] = useState<{ file: File; url: string; type: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadConversation();
    api.conversations.markRead(id).catch(() => {});

    pollRef.current = setInterval(() => {
      loadConversation(true);
    }, 5000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [id]);

  async function loadConversation(silent = false) {
    try {
      const data = await api.conversations.get(id);
      setConversation(data.conversation);
      if (!silent || data.messages.length > messages.length) {
        setMessages(data.messages);
        setHasMore(data.hasMore);
      }
      if (data.conversation.unreadByHost > 0) {
        api.conversations.markRead(id).catch(() => {});
      }
    } catch {}
    if (!silent) setLoading(false);
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setMediaPreview({ file, url, type: file.type.startsWith('video') ? 'video' : 'image' });
    e.target.value = '';
  }

  async function uploadFile(file: File): Promise<string> {
    const data = await api.upload.file(file);
    return data.url;
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
      });
      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: mediaRecorder.mimeType });
        stream.getTracks().forEach((t) => t.stop());
        const duration = recordingDuration;
        setRecordingDuration(0);
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

        try {
          setSending(true);
          const voiceFile = new File([blob], 'voice.webm', { type: blob.type });
          const { url: voiceUrl } = await api.upload.file(voiceFile);

          const msg = await api.conversations.sendMessage(id, {
            content: '',
            voiceUrl,
            voiceDuration: duration,
          });
          setMessages((prev) => [...prev, msg]);
        } catch {
          // Voice send failed silently
        }
        setSending(false);
      };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch {
      // Microphone access denied
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text && !mediaPreview) return;
    if (sending || uploading) return;

    setSending(true);
    setInput('');
    const currentMedia = mediaPreview;
    setMediaPreview(null);

    try {
      let imageUrl: string | undefined;
      if (currentMedia) {
        setUploading(true);
        imageUrl = await uploadFile(currentMedia.file);
        setUploading(false);
      }
      const msg = await api.conversations.sendMessage(id, {
        content: text || '',
        imageUrl,
      });
      setMessages((prev) => [...prev, msg]);
    } catch {
      setInput(text);
      setMediaPreview(currentMedia);
      setUploading(false);
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

  function renderAiCard(suggestion: AiSuggestion) {
    if (suggestion.status === 'DISMISSED') return null;
    const isPending = suggestion.status === 'PENDING';
    const isApproved = suggestion.status === 'APPROVED';
    const urgencyClass = urgencyColors[suggestion.urgency] || urgencyColors.LOW;

    return (
      <div className={`ml-2 mt-1 mb-3 p-3 rounded-xl border-l-4 ${isPending ? 'border-l-blue-500 bg-slate-800/60' : 'border-l-green-500 bg-slate-800/40'}`}>
        <div className="flex items-center gap-2 mb-1.5">
          {isPending ? <Sparkles size={14} className="text-blue-400" /> : <Check size={14} className="text-green-400" />}
          <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-700 text-slate-300 rounded">{suggestion.category}</span>
          <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${urgencyClass}`}>{suggestion.urgency}</span>
        </div>
        <p className="text-sm text-slate-200 mb-1">{suggestion.summary}</p>
        {suggestion.suggestedReply && isPending && (
          <p className="text-xs text-slate-400 italic mb-2">Suggested reply: &ldquo;{suggestion.suggestedReply}&rdquo;</p>
        )}
        {isPending && (
          <div className="flex gap-2">
            <button
              onClick={() => approveSuggestion(suggestion)}
              className="px-3 py-1 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              {suggestion.suggestedAction === 'CREATE_ISSUE' ? 'Create Issue' :
               suggestion.suggestedAction === 'CREATE_JOB' ? 'Create Job' :
               suggestion.suggestedAction === 'DISPATCH_WORKER' ? 'Dispatch Worker' :
               suggestion.suggestedAction === 'AUTO_REPLY' ? 'Send Reply' : 'Approve'}
            </button>
            <button
              onClick={() => dismissSuggestion(suggestion)}
              className="px-3 py-1 text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}
        {isApproved && (
          <p className="text-xs text-green-400 font-semibold">
            {suggestion.createdIssueId ? 'Issue created' : suggestion.createdJobId ? 'Job created' : 'Approved'}
          </p>
        )}
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-12 text-slate-500">Loading...</div>;
  }

  return (
    <FeatureGate feature="messaging">
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="flex items-center gap-4 pb-4 border-b border-slate-800">
          <button onClick={() => router.push('/messages')} className="text-slate-400 hover:text-slate-100">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-100">{conversation?.guestName}</h1>
            {conversation?.booking?.property && (
              <p className="text-xs text-brand-400">{conversation.booking.property.name}</p>
            )}
          </div>
          {conversation?.booking && (
            <div className="ml-auto text-right">
              <p className="text-xs text-slate-500">
                {new Date(conversation.booking.checkIn).toLocaleDateString()} - {new Date(conversation.booking.checkOut).toLocaleDateString()}
              </p>
              <p className="text-xs text-slate-600">{conversation.booking.status}</p>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {hasMore && (
            <button onClick={loadMore} className="block mx-auto text-sm text-brand-400 hover:text-brand-300 py-2">
              Load earlier messages
            </button>
          )}
          {messages.length === 0 ? (
            <div className="text-center py-12 text-slate-500">No messages yet. Start the conversation!</div>
          ) : (
            messages.map((msg) => {
              if (msg.senderType === 'SYSTEM') {
                return (
                  <div key={msg.id} className="text-center">
                    <span className="inline-block px-3 py-1 text-xs text-slate-400 bg-slate-800 rounded-full italic">
                      {msg.content}
                    </span>
                  </div>
                );
              }

              const isHost = msg.senderType === 'HOST';
              const isWorker = msg.senderType === 'WORKER';
              const isVideo = msg.imageUrl && /\.(mp4|mov|webm|avi)$/i.test(msg.imageUrl);
              return (
                <div key={msg.id}>
                  <div className={`flex ${isHost ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                        isHost
                          ? 'bg-brand-600 text-white rounded-br-md'
                          : 'bg-slate-800 text-slate-100 rounded-bl-md'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <p className="text-[11px] text-slate-300/70 font-medium">{msg.senderName}</p>
                        {isWorker && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">Worker</span>
                        )}
                        {isHost && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">Host</span>
                        )}
                      </div>
                      {msg.content && <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>}
                      {msg.imageUrl && (
                        isVideo ? (
                          <video src={msg.imageUrl} controls playsInline className="mt-2 rounded-lg max-w-full max-h-48" />
                        ) : (
                          <img src={msg.imageUrl} alt="" className="mt-2 rounded-lg max-w-full max-h-48 object-cover" />
                        )
                      )}
                      {msg.voiceUrl && (
                        <div className="mt-2">
                          <audio src={msg.voiceUrl} controls className="max-w-full h-8" style={{ minWidth: '180px' }} />
                          {msg.voiceDuration && (
                            <p className="text-[10px] text-slate-300/50 mt-0.5">
                              {Math.floor(msg.voiceDuration / 60)}:{String(msg.voiceDuration % 60).padStart(2, '0')}
                            </p>
                          )}
                          {msg.voiceTranslation && (
                            <p className="text-sm mt-1 leading-relaxed text-slate-200">{msg.voiceTranslation}</p>
                          )}
                          {msg.voiceTranscript && (
                            <p className="text-[11px] mt-0.5 italic text-slate-400">{msg.voiceTranscript}</p>
                          )}
                        </div>
                      )}
                      <p className="text-[10px] text-slate-300/50 mt-1 text-right">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  {msg.aiSuggestion && renderAiCard(msg.aiSuggestion)}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Media preview */}
        {mediaPreview && (
          <div className="flex items-center gap-3 pt-3 px-1">
            {mediaPreview.type === 'video' ? (
              <div className="w-16 h-16 bg-slate-800 rounded-lg flex items-center justify-center border border-slate-700">
                <span className="text-xs text-slate-400">Video</span>
              </div>
            ) : (
              <img src={mediaPreview.url} alt="" className="w-16 h-16 rounded-lg object-cover border border-slate-700" />
            )}
            {uploading && <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />}
            <button onClick={() => setMediaPreview(null)} className="p-1 text-slate-500 hover:text-slate-300">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Input */}
        <div className="flex items-end gap-3 pt-3 border-t border-slate-800">
          <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileSelect} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 text-slate-500 hover:text-slate-300 transition-colors"
            title="Attach image or video"
          >
            <Paperclip size={18} />
          </button>

          {isRecording ? (
            <div className="flex-1 flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl">
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm text-red-400 font-medium">
                Recording {Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, '0')}
              </span>
            </div>
          ) : (
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type a message..."
              rows={1}
              className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
              style={{ maxHeight: '120px' }}
            />
          )}

          <button
            onMouseDown={(e) => { e.preventDefault(); startRecording(); }}
            onMouseUp={() => stopRecording()}
            onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
            onTouchEnd={() => stopRecording()}
            className={`p-2.5 rounded-xl transition-colors ${
              isRecording
                ? 'bg-red-500 text-white'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
            }`}
            title="Hold to record voice"
          >
            <Mic size={18} />
          </button>
          <button
            onClick={handleSend}
            disabled={(!input.trim() && !mediaPreview) || sending}
            className="p-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </FeatureGate>
  );
}
