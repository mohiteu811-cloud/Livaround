'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { ArrowLeft, Send } from 'lucide-react';

interface Message {
  id: string;
  conversationId: string;
  senderType: string;
  senderName: string;
  content: string;
  imageUrl?: string;
  createdAt: string;
  aiSuggestion?: { id: string; category: string; urgency: string; summary: string; status: string };
}

export default function WorkerConversationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [conversation, setConversation] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
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
      }
      if (data.conversation.unreadByWorker > 0) {
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

  if (loading) {
    return <div className="text-center py-12 text-slate-500">Loading...</div>;
  }

  const headerName = conversation?.host?.name || 'Host';

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-slate-800">
        <button onClick={() => router.push('/worker/messages')} className="text-slate-400 hover:text-slate-100">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-100">{headerName}</h1>
          {conversation?.property && (
            <p className="text-xs text-blue-400">{conversation.property.name}</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-12 text-slate-500">No messages yet</div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.senderType === 'WORKER' || msg.senderType === 'SUPERVISOR';
            const isSystem = msg.senderType === 'SYSTEM';

            if (isSystem) {
              return (
                <div key={msg.id} className="text-center">
                  <span className="inline-block px-3 py-1 text-xs text-slate-400 bg-slate-800 rounded-full italic">
                    {msg.content}
                  </span>
                </div>
              );
            }

            return (
              <div key={msg.id}>
                <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                    isOwn ? 'bg-blue-600 text-white rounded-br-md' : 'bg-slate-800 text-slate-100 rounded-bl-md'
                  }`}>
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
                {/* Read-only AI suggestion for workers */}
                {msg.aiSuggestion && msg.aiSuggestion.status === 'PENDING' && (
                  <div className="ml-2 mt-1 mb-3 p-3 rounded-xl border-l-4 border-l-blue-500 bg-slate-800/60">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">✨</span>
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-700 text-slate-300 rounded">{msg.aiSuggestion.category}</span>
                    </div>
                    <p className="text-sm text-slate-200">{msg.aiSuggestion.summary}</p>
                    <p className="text-xs text-slate-500 mt-1 italic">Host will review this suggestion</p>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex items-end gap-3 p-4 border-t border-slate-800">
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
          className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{ maxHeight: '120px' }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
