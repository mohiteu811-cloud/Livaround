'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Plus, MessageSquare, Users } from 'lucide-react';

type Tab = 'guest' | 'team';

function timeAgo(dateStr: string | null | undefined) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface Conversation {
  id: string;
  channelType?: string;
  host?: { id: string; name: string };
  guest?: { id: string; name: string };
  guestName?: string;
  property?: { id: string; name: string };
  lastMessageAt?: string;
  lastMessagePreview?: string;
  unreadByWorker: number;
}

export default function WorkerMessagesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('guest');
  const [teamConversations, setTeamConversations] = useState<Conversation[]>([]);
  const [guestConversations, setGuestConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);
  const [guestPickerOpen, setGuestPickerOpen] = useState(false);
  const [error, setError] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const [team, guests] = await Promise.all([
        api.internalConversations.list(),
        api.guestConversations.list(),
      ]);
      setTeamConversations(team);
      setGuestConversations(guests);
    } catch {
      // silently fail
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [menuOpen]);

  async function handleMessageHost() {
    setMenuOpen(false);
    setCreatingChat(true);
    setError('');
    try {
      const conv = await api.internalConversations.createAsWorker();
      if (!conv?.id) {
        setError('Failed to create conversation — no conversation returned');
        setCreatingChat(false);
        return;
      }
      router.push(`/worker/messages/${conv.id}`);
    } catch (err: any) {
      console.error('Failed to create conversation:', err);
      const msg = err?.message || 'Failed to create conversation';
      setError(msg === 'upgrade_required'
        ? 'Your host needs a Pro plan to enable messaging.'
        : msg === 'Worker has no assigned host'
        ? 'You are not linked to a host yet. Please ask your host to add you to their team.'
        : msg);
    }
    setCreatingChat(false);
  }

  function handleMessageGuest() {
    setMenuOpen(false);
    setError('');
    if (guestConversations.length === 0) {
      api.guestConversations.list().then((guests) => {
        setGuestConversations(guests);
        if (guests.length === 0) {
          setError('No active guest conversations available.');
          return;
        }
        setGuestPickerOpen(true);
      }).catch(() => {});
    } else {
      setGuestPickerOpen(true);
    }
  }

  function selectGuest(conv: Conversation) {
    setGuestPickerOpen(false);
    router.push(`/worker/messages/${conv.id}?type=guest`);
  }

  const conversations = activeTab === 'team' ? teamConversations : guestConversations;

  function getDisplayName(item: Conversation): string {
    if (activeTab === 'guest') {
      return item.guestName || item.guest?.name || 'Guest';
    }
    return item.host?.name || 'Host';
  }

  function getBadgeLabel(item: Conversation): string {
    if (activeTab === 'guest') return 'Guest';
    return item.channelType === 'HOST_WORKER' ? 'Host' : 'Supervisor';
  }

  function getBadgeColor(item: Conversation): string {
    if (activeTab === 'guest') return 'bg-emerald-600/20 text-emerald-400';
    return item.channelType === 'HOST_WORKER'
      ? 'bg-blue-600/20 text-blue-400'
      : 'bg-purple-600/20 text-purple-400';
  }

  function getHref(item: Conversation): string {
    if (activeTab === 'guest') return `/worker/messages/${item.id}?type=guest`;
    return `/worker/messages/${item.id}`;
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">Messages</h1>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            disabled={creatingChat}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {creatingChat ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            New Message
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
              <button
                onClick={handleMessageHost}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700/50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center">
                  <Users className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-100">Message Host</p>
                  <p className="text-xs text-slate-400">Start a conversation with your host</p>
                </div>
              </button>
              <button
                onClick={handleMessageGuest}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700/50 transition-colors text-left border-t border-slate-700"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-600/20 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-100">Message Guest</p>
                  <p className="text-xs text-slate-400">Message an active guest</p>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-3 text-red-400/60 hover:text-red-300 font-bold">x</button>
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex bg-slate-800 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('guest')}
          className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${
            activeTab === 'guest'
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          Guest
        </button>
        <button
          onClick={() => setActiveTab('team')}
          className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${
            activeTab === 'team'
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          Team
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading...</div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">💬</div>
          <p className="text-slate-400 font-medium">
            No {activeTab === 'guest' ? 'guest' : 'team'} messages yet
          </p>
          <p className="text-slate-500 text-sm mt-1">
            {activeTab === 'guest'
              ? 'Guest conversations will appear here'
              : 'Messages from your host will appear here'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => (
            <Link
              key={conv.id}
              href={getHref(conv)}
              className={`block p-4 rounded-xl border transition-colors hover:bg-slate-800/50 ${
                conv.unreadByWorker > 0
                  ? 'bg-slate-800/30 border-blue-500/50'
                  : 'bg-slate-900 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-100">
                    {getDisplayName(conv)}
                  </span>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getBadgeColor(conv)}`}>
                    {getBadgeLabel(conv)}
                  </span>
                  {conv.unreadByWorker > 0 && (
                    <span className="px-2 py-0.5 text-xs font-bold bg-blue-600 text-white rounded-full">
                      {conv.unreadByWorker}
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-500">
                  {timeAgo(conv.lastMessageAt)}
                </span>
              </div>
              {conv.property && (
                <p className="text-xs text-blue-400 mb-1">{conv.property.name}</p>
              )}
              {conv.lastMessagePreview && (
                <p className="text-sm text-slate-400 truncate">
                  {conv.lastMessagePreview}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Guest Picker Modal */}
      {guestPickerOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setGuestPickerOpen(false);
          }}
        >
          <div className="bg-slate-800 w-full sm:max-w-md sm:rounded-xl rounded-t-xl max-h-[60vh] flex flex-col">
            <div className="p-4 border-b border-slate-700">
              <h2 className="text-lg font-bold text-slate-100 text-center">
                Select Guest
              </h2>
            </div>
            <div className="overflow-y-auto p-4 space-y-2 flex-1">
              {guestConversations.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  No active guest conversations
                </p>
              ) : (
                guestConversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => selectGuest(conv)}
                    className="w-full text-left p-4 bg-slate-900 hover:bg-slate-700 rounded-xl transition-colors"
                  >
                    <p className="text-sm font-semibold text-slate-100">
                      {conv.guestName || conv.guest?.name || 'Guest'}
                    </p>
                    {conv.property && (
                      <p className="text-xs text-blue-400 mt-1">
                        {conv.property.name}
                      </p>
                    )}
                  </button>
                ))
              )}
            </div>
            <div className="p-4 border-t border-slate-700">
              <button
                onClick={() => setGuestPickerOpen(false)}
                className="w-full py-2.5 text-sm font-medium text-slate-400 hover:text-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
