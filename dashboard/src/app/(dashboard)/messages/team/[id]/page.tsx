'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { FeatureGate } from '@/components/FeatureGate';
import { ArrowLeft, Send, Sparkles, Check } from 'lucide-react';

interface AiSuggestion {
  id: string;
  category: string;
  urgency: string;
  summary: string;
  suggestedAction: string;
  suggestedReply?: string;
  status: string;
  createdIssueId?: string;
  createdJobId?: string;
}

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

const urgencyColors: Record<string, string> = {
  CRITICAL: 'text-red-400 bg-red-500/10 border-red-500/30',
  HIGH: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  MEDIUM: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  LOW: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
};

export default function TeamConversationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [conversation, setConversation] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadConversation();
    api.internalConversations.markRead(id).catch(() => {});

    pollRef.current = setInterval(() => {
      loadConversation(true);
    }, 5000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [id]);

  async function loadConversation(silent = false) {
    try {
      const data = await api.internalConversations.get(id);
      setConversation(data.conversation);
      if (!silent || data.messages.length > messages.length) {
        setMessages(data.messages);
        setHasMore(data.hasMore);
      }
      if (data.conversation.unreadByHost > 0) {
        api.internalConversations.markRead(id).catch(() => {});
      }
    } catch {}
    if (!silent) setLoading(false);
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setInput('');
    try {
      const msg = await api.internalConversations.sendMessage(id, { content: text });
      setMessages((prev) => [...prev, msg]);
    } catch {
      setInput(text);
    }
    setSending(false);
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

  if (loading) {
    return <div className="text-center py-12 text-slate-500">Loading...</div>;
  }

  const workerName = conversation?.worker?.user?.name || 'Worker';
  const propertyName = conversation?.property?.name;

  return (
    <FeatureGate feature="messaging">
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="flex items-center gap-4 pb-4 border-b border-slate-800">
          <button onClick={() => router.push('/messages')} className="text-slate-400 hover:text-slate-100">
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-100">{workerName}</h1>
              <span className="px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded-full">
                {conversation?.channelType === 'HOST_WORKER' ? 'Worker' : 'Supervisor'}
              </span>
            </div>
            {propertyName && <p className="text-xs text-brand-400">{propertyName}</p>}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3">
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
                      <p className="text-[11px] text-slate-300/70 font-medium mb-0.5">{msg.senderName}</p>
                      {msg.content && <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>}
                      {msg.imageUrl && (
                        <img src={msg.imageUrl} alt="" className="mt-2 rounded-lg max-w-full max-h-48 object-cover" />
                      )}
                      <p className="text-[10px] text-slate-300/50 mt-1 text-right">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  {/* AI Suggestion Card */}
                  {msg.aiSuggestion && msg.aiSuggestion.status !== 'DISMISSED' && (
                    <div className={`ml-2 mt-1 mb-3 p-3 rounded-xl border-l-4 ${
                      msg.aiSuggestion.status === 'PENDING' ? 'border-l-blue-500 bg-slate-800/60' : 'border-l-green-500 bg-slate-800/40'
                    }`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        {msg.aiSuggestion.status === 'PENDING'
                          ? <Sparkles size={14} className="text-blue-400" />
                          : <Check size={14} className="text-green-400" />}
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-700 text-slate-300 rounded">{msg.aiSuggestion.category}</span>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${urgencyColors[msg.aiSuggestion.urgency] || ''}`}>{msg.aiSuggestion.urgency}</span>
                      </div>
                      <p className="text-sm text-slate-200 mb-1">{msg.aiSuggestion.summary}</p>
                      {msg.aiSuggestion.suggestedReply && msg.aiSuggestion.status === 'PENDING' && (
                        <p className="text-xs text-slate-400 italic mb-2">Suggested reply: &ldquo;{msg.aiSuggestion.suggestedReply}&rdquo;</p>
                      )}
                      {msg.aiSuggestion.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <button onClick={() => approveSuggestion(msg.aiSuggestion!)} className="px-3 py-1 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg">
                            {msg.aiSuggestion.suggestedAction === 'CREATE_ISSUE' ? 'Create Issue' :
                             msg.aiSuggestion.suggestedAction === 'CREATE_JOB' ? 'Create Job' :
                             msg.aiSuggestion.suggestedAction === 'DISPATCH_WORKER' ? 'Dispatch Worker' :
                             msg.aiSuggestion.suggestedAction === 'AUTO_REPLY' ? 'Send Reply' : 'Approve'}
                          </button>
                          <button onClick={() => dismissSuggestion(msg.aiSuggestion!)} className="px-3 py-1 text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg">
                            Dismiss
                          </button>
                        </div>
                      )}
                      {msg.aiSuggestion.status === 'APPROVED' && (
                        <p className="text-xs text-green-400 font-semibold">
                          {msg.aiSuggestion.createdIssueId ? 'Issue created' : msg.aiSuggestion.createdJobId ? 'Job created' : 'Approved'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex items-end gap-3 pt-3 border-t border-slate-800">
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
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="p-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </FeatureGate>
  );
}
