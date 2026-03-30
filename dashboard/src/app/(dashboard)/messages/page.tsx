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

type Tab = 'guest' | 'team';

interface InternalConversation {
  id: string;
  channelType: string;
  worker?: { id: string; user: { name: string; email?: string } };
  property?: { id: string; name: string };
  lastMessageAt?: string;
  lastMessagePreview?: string;
  unreadByHost: number;
}

export default function MessagesPage() {
  const [tab, setTab] = useState<Tab>('guest');
  const [guestConvos, setGuestConvos] = useState<ConversationListItem[]>([]);
  const [teamConvos, setTeamConvos] = useState<InternalConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showWorkerPicker, setShowWorkerPicker] = useState(false);
  const [workers, setWorkers] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      api.conversations.list().then(setGuestConvos).catch(() => {}),
      api.internalConversations.list().then(setTeamConvos).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const filteredGuest = guestConvos.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.guestName?.toLowerCase().includes(q) ||
      c.booking?.property?.name.toLowerCase().includes(q)
    );
  });

  const filteredTeam = teamConvos.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.worker?.user?.name?.toLowerCase().includes(q) ||
      c.property?.name?.toLowerCase().includes(q)
    );
  });

  async function openNewTeamChat() {
    try {
      const w = await api.workers.list();
      setWorkers(w);
      setShowWorkerPicker(true);
    } catch {}
  }

  const totalUnread = guestConvos.filter((c) => c.unreadByHost > 0).length +
    teamConvos.filter((c) => c.unreadByHost > 0).length;

  return (
    <FeatureGate feature="messaging">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-100">Messages</h1>
          <span className="text-sm text-slate-500">{totalUnread} unread</span>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2">
          <button
            onClick={() => setTab('guest')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === 'guest' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Guest Messages
            {guestConvos.some((c) => c.unreadByHost > 0) && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
                {guestConvos.filter((c) => c.unreadByHost > 0).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('team')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === 'team' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Team Messages
            {teamConvos.some((c) => c.unreadByHost > 0) && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
                {teamConvos.filter((c) => c.unreadByHost > 0).length}
              </span>
            )}
          </button>
          {tab === 'team' && (
            <button
              onClick={openNewTeamChat}
              className="ml-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold"
            >
              + New Chat
            </button>
          )}
        </div>

        <input
          type="text"
          placeholder={tab === 'guest' ? 'Search by guest name or property...' : 'Search by worker name or property...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />

        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading conversations...</div>
        ) : tab === 'guest' ? (
          filteredGuest.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">💬</div>
              <p className="text-slate-400 font-medium">No messages yet</p>
              <p className="text-slate-500 text-sm mt-1">Guest messages will appear here when they reach out</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredGuest.map((conv) => (
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
          )
        ) : (
          filteredTeam.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">👥</div>
              <p className="text-slate-400 font-medium">No team messages yet</p>
              <p className="text-slate-500 text-sm mt-1">Click "+ New Chat" to message a worker</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTeam.map((conv) => (
                <Link
                  key={conv.id}
                  href={`/messages/team/${conv.id}`}
                  className={`block p-4 rounded-xl border transition-colors hover:bg-slate-800/50 ${
                    conv.unreadByHost > 0
                      ? 'bg-slate-800/30 border-brand-500/50'
                      : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-100">{conv.worker?.user?.name || 'Worker'}</span>
                      <span className="px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded-full">
                        {conv.channelType === 'HOST_WORKER' ? 'Worker' : 'Supervisor'}
                      </span>
                      {conv.unreadByHost > 0 && (
                        <span className="px-2 py-0.5 text-xs font-bold bg-brand-600 text-white rounded-full">
                          {conv.unreadByHost}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500">{timeAgo(conv.lastMessageAt)}</span>
                  </div>
                  {conv.property && (
                    <p className="text-xs text-brand-400 mb-1">{conv.property.name}</p>
                  )}
                  {conv.lastMessagePreview && (
                    <p className="text-sm text-slate-400 truncate">{conv.lastMessagePreview}</p>
                  )}
                </Link>
              ))}
            </div>
          )
        )}

        {/* Worker Picker Modal */}
        {showWorkerPicker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md max-h-[60vh] flex flex-col">
              <h2 className="text-lg font-bold text-slate-100 mb-1">New Team Chat</h2>
              <p className="text-sm text-slate-400 mb-4">Select a worker to message</p>
              <div className="flex-1 overflow-y-auto space-y-1">
                {workers.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">No workers found</p>
                ) : (
                  workers.map((w: any) => (
                    <button
                      key={w.id}
                      onClick={async () => {
                        setShowWorkerPicker(false);
                        try {
                          const conv = await api.internalConversations.create(w.id);
                          window.location.href = `/messages/team/${conv.id}`;
                        } catch {}
                      }}
                      className="w-full text-left px-4 py-3 rounded-lg hover:bg-slate-700 transition-colors"
                    >
                      <span className="text-slate-100 font-medium">{w.user?.name || w.id}</span>
                    </button>
                  ))
                )}
              </div>
              <button
                onClick={() => setShowWorkerPicker(false)}
                className="mt-4 w-full py-2 text-blue-400 hover:text-blue-300 font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </FeatureGate>
  );
}
