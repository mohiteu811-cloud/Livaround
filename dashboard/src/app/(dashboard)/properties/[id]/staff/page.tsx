'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Plus, Trash2, ArrowLeft, UserCheck, Settings } from 'lucide-react';
import { api, Property, Worker, PropertyStaffAssignment, MaintenanceSettings, TradeRole } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/Input';

function AssignStaffModal({
  workers,
  existing,
  onSave,
  onClose,
}: {
  workers: Worker[];
  existing: PropertyStaffAssignment[];
  onSave: (workerId: string, role: 'CARETAKER' | 'CLEANER' | 'SUPERVISOR') => Promise<void>;
  onClose: () => void;
}) {
  const existingIds = existing.map((s) => s.workerId);
  const available = workers.filter((w) => !existingIds.includes(w.id));
  const [workerId, setWorkerId] = useState(available[0]?.id || '');
  const [role, setRole] = useState<'CARETAKER' | 'CLEANER' | 'SUPERVISOR'>('CLEANER');
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!workerId) return;
    setLoading(true);
    try { await onSave(workerId, role as 'CARETAKER' | 'CLEANER'); onClose(); } finally { setLoading(false); }
  }

  if (available.length === 0) {
    return (
      <div className="text-center py-6 space-y-2">
        <p className="text-slate-400">All workers are already assigned to this property.</p>
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FormField label="Worker">
        <select
          value={workerId}
          onChange={(e) => setWorkerId(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-brand-500"
        >
          {available.map((w) => <option key={w.id} value={w.id}>{w.user.name}</option>)}
        </select>
      </FormField>
      <FormField label="Role at this property">
        <div className="flex gap-2">
          {(['CLEANER', 'CARETAKER', 'SUPERVISOR'] as const).map((r) => (
            <button
              key={r} type="button"
              onClick={() => setRole(r)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${role === r ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              {r === 'CARETAKER' ? '🏠 Caretaker' : r === 'SUPERVISOR' ? '🔍 Supervisor' : '🧹 Cleaner'}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-600 mt-1">
          {role === 'CARETAKER'
            ? 'Caretakers can raise maintenance requests and (if enabled) assign tradespeople.'
            : role === 'SUPERVISOR'
            ? 'Supervisors visit to audit and inspect cleaner work. They can submit rated audit reports per job.'
            : 'Cleaners can raise maintenance requests for issues they find.'}
        </p>
      </FormField>
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onClose} className="flex-1 justify-center">Cancel</Button>
        <Button loading={loading} onClick={handleSave} className="flex-1 justify-center">Assign</Button>
      </div>
    </div>
  );
}

function MaintenanceSettingsPanel({
  propertyId,
  tradeRoles,
}: {
  propertyId: string;
  tradeRoles: TradeRole[];
}) {
  const [settings, setSettings] = useState<MaintenanceSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.propertyStaff.getSettings(propertyId).then(setSettings);
  }, [propertyId]);

  async function save(updates: Partial<MaintenanceSettings>) {
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await api.propertyStaff.updateSettings(propertyId, updates);
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return <div className="animate-pulse h-32 bg-slate-800 rounded-xl" />;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Settings size={16} className="text-slate-500" />
        <h2 className="font-semibold text-slate-200">Maintenance approval settings</h2>
      </div>

      <label className="flex items-start justify-between gap-4 cursor-pointer">
        <div>
          <p className="text-sm font-medium text-slate-300">Require host approval</p>
          <p className="text-xs text-slate-500 mt-0.5">When ON, all maintenance requests need your approval before being dispatched.</p>
        </div>
        <button
          type="button"
          onClick={() => save({ requireApproval: !settings.requireApproval })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${settings.requireApproval ? 'bg-brand-600' : 'bg-slate-700'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.requireApproval ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </label>

      <label className="flex items-start justify-between gap-4 cursor-pointer">
        <div>
          <p className="text-sm font-medium text-slate-300">Allow caretaker to assign tradespeople</p>
          <p className="text-xs text-slate-500 mt-0.5">Caretakers can directly pick and schedule a tradesperson without waiting for your approval.</p>
        </div>
        <button
          type="button"
          onClick={() => save({ allowCaretakerAssign: !settings.allowCaretakerAssign })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${settings.allowCaretakerAssign ? 'bg-brand-600' : 'bg-slate-700'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.allowCaretakerAssign ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </label>

      {tradeRoles.length > 0 && (
        <div>
          <p className="text-sm font-medium text-slate-300 mb-1">Auto-assign trade roles</p>
          <p className="text-xs text-slate-500 mb-3">Requests for these trades will be automatically dispatched without approval.</p>
          <div className="flex flex-wrap gap-2">
            {tradeRoles.map((role) => {
              const selected = settings.autoAssignTradeRoles.includes(role.id);
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => {
                    const next = selected
                      ? settings.autoAssignTradeRoles.filter((id) => id !== role.id)
                      : [...settings.autoAssignTradeRoles, role.id];
                    save({ autoAssignTradeRoles: next });
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                    selected
                      ? 'text-white border-transparent'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                  }`}
                  style={selected ? { background: role.color, borderColor: role.color } : {}}
                >
                  {role.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {saved && <p className="text-xs text-emerald-400">Settings saved.</p>}
      {saving && <p className="text-xs text-slate-500">Saving...</p>}
    </div>
  );
}

export default function PropertyStaffPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [property, setProperty] = useState<Property | null>(null);
  const [staff, setStaff] = useState<PropertyStaffAssignment[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [tradeRoles, setTradeRoles] = useState<TradeRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  useEffect(() => { load(); }, [id]);

  async function load() {
    setLoading(true);
    try {
      const [prop, st, wks, roles] = await Promise.all([
        api.properties.get(id),
        api.propertyStaff.list(id),
        api.workers.list(),
        api.tradeRoles.list(),
      ]);
      setProperty(prop);
      setStaff(st);
      setWorkers(wks);
      setTradeRoles(roles);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(workerId: string) {
    if (!confirm('Remove this person from the property?')) return;
    await api.propertyStaff.remove(id, workerId);
    load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{property?.name} — Staff</h1>
          <p className="text-slate-400 text-sm mt-0.5">Assign caretakers & cleaners, configure maintenance approval</p>
        </div>
      </div>

      {/* Assigned staff */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck size={16} className="text-slate-500" />
            <h2 className="font-semibold text-slate-200">Assigned staff</h2>
          </div>
          <Button onClick={() => setModal(true)} className="text-xs py-1 px-2 h-auto"><Plus size={12} /> Assign</Button>
        </div>

        {staff.length === 0 ? (
          <p className="text-sm text-slate-600 italic py-4 text-center">No staff assigned yet. Assign a cleaner or caretaker so they can log maintenance requests.</p>
        ) : (
          <div className="space-y-2">
            {staff.map((s) => (
              <div key={s.id} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 font-semibold text-xs">
                    {s.worker.user.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm text-slate-200">{s.worker.user.name}</p>
                    <p className="text-xs text-slate-500">{s.worker.user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {s.worker.tradeRole && (
                    <span className="text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded">{s.worker.tradeRole.name}</span>
                  )}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    s.role === 'CARETAKER' ? 'text-brand-400 bg-brand-500/10'
                    : s.role === 'SUPERVISOR' ? 'text-amber-400 bg-amber-500/10'
                    : 'text-slate-400 bg-slate-800'
                  }`}>
                    {s.role === 'CARETAKER' ? 'Caretaker' : s.role === 'SUPERVISOR' ? 'Supervisor' : 'Cleaner'}
                  </span>
                  <button onClick={() => handleRemove(s.workerId)} className="p-1 rounded hover:bg-slate-700 text-slate-600 hover:text-red-400 transition-colors">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Maintenance settings */}
      <MaintenanceSettingsPanel propertyId={id} tradeRoles={tradeRoles} />

      <Modal open={modal} onClose={() => setModal(false)} title="Assign staff to property">
        <AssignStaffModal
          workers={workers}
          existing={staff}
          onSave={async (workerId, role) => {
            await api.propertyStaff.assign(id, { workerId, role: role as 'CARETAKER' | 'CLEANER' });
            await load();
          }}
          onClose={() => setModal(false)}
        />
      </Modal>
    </div>
  );
}
