'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

type Tab = 'guest' | 'team';

interface Conversation {
  id: string;
  channelType?: string;
  host?: { id: string; name: string };
  worker?: { id: string; user?: { name: string } };
  guest?: { id: string; name: string };
  guestName?: string;
  property?: { id: string; name: string };
  booking?: { property?: { name: string } };
  lastMessageAt?: string;
  lastMessagePreview?: string;
  unreadByWorker: number;
}

export default function WorkerMessagesPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('guest');
  const [teamConversations, setTeamConversations] = useState<Conversation[]>([]);
  const [guestConversations, setGuestConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [creating, setCreating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      api.internalConversations.list().then(setTeamConversations).catch(() => {}),
      api.conversations.workerGuestList().then(setGuestConversations).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowNewMenu(false);
      }
    }
    if (showNewMenu) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showNewMenu]);

  async function handleMessageHost() {
    setShowNewMenu(false);
    setCreating(true);
    try {
      const conv = await api.internalConversations.create();
      router.push(`/worker/messages/${conv.id}`);
    } catch (err: any) {
      alert(err.message || 'Failed to create conversation');
    }
    setCreating(false);
  }

  async function handleMessageGuest() {
    setShowNewMenu(false);
    if (guestConversations.length === 0) {
      alert('No active guest conversations available.');
      return;
    }
    // Switch to guest tab so user can pick a conversation
    setTab('guest');
  }

  const conversations = tab === 'team' ? teamConversations : guestConversations;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">Messages</h1>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowNewMenu(!showNewMenu)}
            disabled={creating}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold"
          >
            {creating ? 'Creating...' : '+ New Message'}
          </button>
          {showNewMenu && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
              <button
                onClick={handleMessageHost}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 transition-colors text-left"
              >
                <span className="w-10 h-10 flex items-center justify-center bg-blue-600/20 text-blue-400 rounded-full text-lg">
                  👤
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-100">Message Host</p>
                  <p className="text-xs text-slate-400">Start a conversation with your host</p>
                </div>
              </button>
              <button
                onClick={handleMessageGuest}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 transition-colors text-left border-t border-slate-700"
              >
                <span className="w-10 h-10 flex items-center justify-center bg-green-600/20 text-green-400 rounded-full text-lg">
                  💬
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-100">Message Guest</p>
                  <p className="text-xs text-slate-400">Message an active guest</p>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('guest')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            tab === 'guest' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          Guest
          {guestConversations.some((c) => c.unreadByWorker > 0) && (
            <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
              {guestConversations.filter((c) => c.unreadByWorker > 0).length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('team')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            tab === 'team' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          Team
          {teamConversations.some((c) => c.unreadByWorker > 0) && (
            <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
              {teamConversations.filter((c) => c.unreadByWorker > 0).length}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading...</div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">💬</div>
          <p className="text-slate-400 font-medium">
            No {tab === 'guest' ? 'guest' : 'team'} messages yet
          </p>
          <p className="text-slate-500 text-sm mt-1">
            {tab === 'guest'
              ? 'Guest conversations will appear here'
              : 'Messages from your host will appear here'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => {
            const displayName = tab === 'guest'
              ? (conv.guestName || conv.guest?.name || 'Guest')
              : (conv.host?.name || 'Host');
            const badge = tab === 'guest'
              ? 'Guest'
              : (conv.channelType === 'HOST_WORKER' ? 'Host' : 'Supervisor');
            const propertyName = tab === 'guest'
              ? (conv.property?.name || conv.booking?.property?.name)
              : conv.property?.name;
            const href = tab === 'guest'
              ? `/worker/messages/${conv.id}?type=guest`
              : `/worker/messages/${conv.id}`;

            return (
              <Link
                key={conv.id}
                href={href}
                className={`block p-4 rounded-xl border transition-colors hover:bg-slate-800/50 ${
                  conv.unreadByWorker > 0
                    ? 'bg-slate-800/30 border-blue-500/50'
                    : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-100">{displayName}</span>
                    <span className="px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded-full">
                      {badge}
                    </span>
                    {conv.unreadByWorker > 0 && (
                      <span className="px-2 py-0.5 text-xs font-bold bg-blue-600 text-white rounded-full">
                        {conv.unreadByWorker}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">{timeAgo(conv.lastMessageAt ?? null)}</span>
                </div>
                {propertyName && <p className="text-xs text-blue-400 mb-1">{propertyName}</p>}
                {conv.lastMessagePreview && (
                  <p className="text-sm text-slate-400 truncate">{conv.lastMessagePreview}</p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
