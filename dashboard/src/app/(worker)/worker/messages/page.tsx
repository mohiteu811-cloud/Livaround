'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

function timeAgo(dateStr: string | null) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface InternalConversation {
  id: string;
  channelType: string;
  host?: { id: string; name: string };
  property?: { id: string; name: string };
  lastMessageAt?: string;
  lastMessagePreview?: string;
  unreadByWorker: number;
}

export default function WorkerMessagesPage() {
  const [conversations, setConversations] = useState<InternalConversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.internalConversations.list()
      .then(setConversations)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-slate-100">Messages</h1>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading...</div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">💬</div>
          <p className="text-slate-400 font-medium">No messages yet</p>
          <p className="text-slate-500 text-sm mt-1">Messages from your host will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => (
            <Link
              key={conv.id}
              href={`/worker/messages/${conv.id}`}
              className={`block p-4 rounded-xl border transition-colors hover:bg-slate-800/50 ${
                conv.unreadByWorker > 0
                  ? 'bg-slate-800/30 border-blue-500/50'
                  : 'bg-slate-900 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-100">{conv.host?.name || 'Host'}</span>
                  <span className="px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded-full">
                    {conv.channelType === 'HOST_WORKER' ? 'Host' : 'Supervisor'}
                  </span>
                  {conv.unreadByWorker > 0 && (
                    <span className="px-2 py-0.5 text-xs font-bold bg-blue-600 text-white rounded-full">
                      {conv.unreadByWorker}
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-500">{timeAgo(conv.lastMessageAt)}</span>
              </div>
              {conv.property && <p className="text-xs text-blue-400 mb-1">{conv.property.name}</p>}
              {conv.lastMessagePreview && (
                <p className="text-sm text-slate-400 truncate">{conv.lastMessagePreview}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
