'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api, ConversationListItem } from '@/lib/api';
import { FeatureGate } from '@/components/FeatureGate';

function timeAgo(dateStr: string | null) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.conversations.list()
      .then(setConversations)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = conversations.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.guestName.toLowerCase().includes(q) ||
      c.booking?.property?.name.toLowerCase().includes(q)
    );
  });

  return (
    <FeatureGate feature="messaging">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-100">Messages</h1>
          <span className="text-sm text-slate-500">
            {conversations.filter((c) => c.unreadByHost > 0).length} unread
          </span>
        </div>

        <input
          type="text"
          placeholder="Search by guest name or property..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />

        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading conversations...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-slate-400 font-medium">No messages yet</p>
            <p className="text-slate-500 text-sm mt-1">Guest messages will appear here when they reach out</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((conv) => (
              <Link
                key={conv.id}
                href={`/messages/${conv.id}`}
                className={`block p-4 rounded-xl border transition-colors hover:bg-slate-800/50 ${
                  conv.unreadByHost > 0
                    ? 'bg-slate-800/30 border-brand-500/50'
                    : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-100">{conv.guestName}</span>
                    {conv.unreadByHost > 0 && (
                      <span className="px-2 py-0.5 text-xs font-bold bg-brand-600 text-white rounded-full">
                        {conv.unreadByHost}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">{timeAgo(conv.lastMessageAt)}</span>
                </div>
                {conv.booking?.property && (
                  <p className="text-xs text-brand-400 mb-1">{conv.booking.property.name}</p>
                )}
                {conv.lastMessagePreview && (
                  <p className="text-sm text-slate-400 truncate">{conv.lastMessagePreview}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </FeatureGate>
  );
}
