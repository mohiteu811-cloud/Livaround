'use client';

import { useEffect, useState } from 'react';
import { api, NotificationPrefs } from '@/lib/api';

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`relative w-10 h-5 rounded-full transition-colors ${checked ? 'bg-brand-600' : 'bg-slate-700'} ${disabled ? 'opacity-50' : ''}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    guestMessages: true,
    workerMessages: true,
    conversationAlerts: true,
    issueAlerts: 'all',
  });
  const [autoDispatch, setAutoDispatch] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.hostApp.getSettings()
      .then(s => {
        setPrefs(s.notificationPrefs || prefs);
        setAutoDispatch(s.autoDispatch);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save(update: Partial<NotificationPrefs>) {
    const next = { ...prefs, ...update };
    setSaving(true);
    try {
      await api.hostApp.updateSettings({ notificationPrefs: next });
      setPrefs(next);
    } catch {
      // rollback handled by not setting state
    }
    setSaving(false);
  }

  async function saveAutoDispatch(v: boolean) {
    setSaving(true);
    try {
      await api.hostApp.updateSettings({ autoDispatch: v });
      setAutoDispatch(v);
    } catch {}
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="p-4 md:p-8 flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Notification Settings</h1>
        <p className="text-slate-400 text-sm mt-1">
          Configure how and when you receive notifications
          {saving && <span className="ml-2 text-brand-400">Saving...</span>}
        </p>
      </div>

      {/* Messages */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Messages</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-200">Guest Messages</p>
            <p className="text-xs text-slate-500">Notifications when guests send messages</p>
          </div>
          <Toggle checked={prefs.guestMessages} onChange={v => save({ guestMessages: v })} disabled={saving} />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-200">Worker Messages</p>
            <p className="text-xs text-slate-500">Notifications when team members send messages</p>
          </div>
          <Toggle checked={prefs.workerMessages} onChange={v => save({ workerMessages: v })} disabled={saving} />
        </div>
      </div>

      {/* AI Alerts */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">AI Alerts</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-200">AI Conversation Alerts</p>
            <p className="text-xs text-slate-500">Get notified when AI detects important conversation patterns</p>
          </div>
          <Toggle checked={prefs.conversationAlerts} onChange={v => save({ conversationAlerts: v })} disabled={saving} />
        </div>
        <div>
          <p className="text-sm text-slate-200 mb-2">AI Issue Alerts</p>
          <p className="text-xs text-slate-500 mb-3">Control which AI-detected issues trigger notifications</p>
          <div className="space-y-2">
            {([
              { value: 'all' as const, label: 'All Issues', desc: 'Get notified for all AI-detected issues' },
              { value: 'high_critical' as const, label: 'High & Critical Only', desc: 'Only urgent and critical issues' },
              { value: 'none' as const, label: 'Off', desc: 'No AI issue notifications' },
            ] as const).map(opt => (
              <label
                key={opt.value}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  prefs.issueAlerts === opt.value
                    ? 'bg-brand-600/10 border border-brand-500/30'
                    : 'bg-slate-800/50 border border-slate-800 hover:bg-slate-800'
                }`}
              >
                <input
                  type="radio"
                  name="issueAlerts"
                  checked={prefs.issueAlerts === opt.value}
                  onChange={() => save({ issueAlerts: opt.value })}
                  disabled={saving}
                  className="sr-only"
                />
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  prefs.issueAlerts === opt.value ? 'border-brand-500' : 'border-slate-600'
                }`}>
                  {prefs.issueAlerts === opt.value && <div className="w-2 h-2 rounded-full bg-brand-500" />}
                </div>
                <div>
                  <p className="text-sm text-slate-200">{opt.label}</p>
                  <p className="text-xs text-slate-500">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Auto-Dispatch */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Automation</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-200">Auto-Dispatch Jobs</p>
            <p className="text-xs text-slate-500">Automatically assign new jobs to available workers</p>
          </div>
          <Toggle checked={autoDispatch} onChange={v => saveAutoDispatch(v)} disabled={saving} />
        </div>
      </div>
    </div>
  );
}
