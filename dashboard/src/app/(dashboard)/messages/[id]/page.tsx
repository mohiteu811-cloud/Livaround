'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, ConversationDetail, MessageItem } from '@/lib/api';
import { FeatureGate } from '@/components/FeatureGate';
import { ArrowLeft, Send } from 'lucide-react';

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadConversation();
    // Mark as read on mount
    api.conversations.markRead(id).catch(() => {});

    // Poll for new messages every 5 seconds
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
      // Mark as read
      if (data.conversation.unreadByHost > 0) {
        api.conversations.markRead(id).catch(() => {});
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
      const msg = await api.conversations.sendMessage(id, { content: text });
      setMessages((prev) => [...prev, msg]);
    } catch {
      setInput(text);
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
            <button
              onClick={loadMore}
              className="block mx-auto text-sm text-brand-400 hover:text-brand-300 py-2"
            >
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
              return (
                <div key={msg.id} className={`flex ${isHost ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                      isHost
                        ? 'bg-brand-600 text-white rounded-br-md'
                        : 'bg-slate-800 text-slate-100 rounded-bl-md'
                    }`}
                  >
                    <p className="text-[11px] text-slate-300/70 font-medium mb-0.5">{msg.senderName}</p>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    {msg.imageUrl && (
                      <img src={msg.imageUrl} alt="" className="mt-2 rounded-lg max-w-full max-h-48 object-cover" />
                    )}
                    <p className="text-[10px] text-slate-300/50 mt-1 text-right">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
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
