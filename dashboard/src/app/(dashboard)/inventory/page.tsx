'use client';

import { useEffect, useState } from 'react';
import { Plus, AlertTriangle, Package, RotateCcw } from 'lucide-react';
import { api, InventoryItem, Property } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input, Select, FormField } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';

const CATEGORIES = ['CLEANING_SUPPLIES', 'TOILETRIES', 'KITCHEN', 'LINENS', 'OTHER'];
const CAT_ICONS: Record<string, string> = {
  CLEANING_SUPPLIES: '🧴', TOILETRIES: '🚿', KITCHEN: '🍽️', LINENS: '🛏️', OTHER: '📦',
};
const CAT_LABELS: Record<string, string> = {
  CLEANING_SUPPLIES: 'Cleaning', TOILETRIES: 'Toiletries', KITCHEN: 'Kitchen', LINENS: 'Linens', OTHER: 'Other',
};

function stockLevel(item: InventoryItem): { pct: number; color: string; label: string } {
  if (item.minStock === 0) return { pct: 100, color: 'bg-emerald-500', label: 'OK' };
  const pct = Math.min(100, (item.currentStock / item.minStock) * 100);
  if (pct <= 0) return { pct: 0, color: 'bg-red-500', label: 'Empty' };
  if (pct < 100) return { pct, color: 'bg-amber-500', label: 'Low' };
  return { pct, color: 'bg-emerald-500', label: 'OK' };
}

function ItemForm({
  properties,
  initial,
  onSave,
  onClose,
}: {
  properties: Property[];
  initial?: Partial<InventoryItem>;
  onSave: (d: Partial<InventoryItem>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<InventoryItem>>({
    propertyId: properties[0]?.id || '', name: '', category: 'OTHER',
    currentStock: 0, minStock: 1, unit: 'units', location: '',
    ...initial,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function set(k: string, v: unknown) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try { await onSave(form); onClose(); } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Property">
          <Select value={form.propertyId} onChange={(e) => set('propertyId', e.target.value)} required>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </FormField>
        <FormField label="Category">
          <Select value={form.category} onChange={(e) => set('category', e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CAT_ICONS[c]} {CAT_LABELS[c]}</option>)}
          </Select>
        </FormField>
      </div>
      <FormField label="Item name">
        <Input placeholder="Toilet paper rolls" value={form.name} onChange={(e) => set('name', e.target.value)} required />
      </FormField>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FormField label="Current stock">
          <Input type="number" min={0} step="0.1" value={form.currentStock} onChange={(e) => set('currentStock', parseFloat(e.target.value))} required />
        </FormField>
        <FormField label="Min stock">
          <Input type="number" min={0} step="0.1" value={form.minStock} onChange={(e) => set('minStock', parseFloat(e.target.value))} required />
        </FormField>
        <FormField label="Unit">
          <Input placeholder="rolls / litres / kg" value={form.unit} onChange={(e) => set('unit', e.target.value)} required />
        </FormField>
      </div>
      <FormField label="Storage location">
        <Input placeholder="Main bathroom cabinet, under sink..." value={form.location || ''} onChange={(e) => set('location', e.target.value)} />
      </FormField>
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onClose} className="flex-1 justify-center">Cancel</Button>
        <Button type="submit" loading={loading} className="flex-1 justify-center">
          {initial?.id ? 'Save changes' : 'Add item'}
        </Button>
      </div>
    </form>
  );
}

function RestockModal({ item, onSave, onClose }: {
  item: InventoryItem;
  onSave: (stock: number) => Promise<void>;
  onClose: () => void;
}) {
  const [stock, setStock] = useState(item.minStock * 2);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    try { await onSave(stock); onClose(); } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Updating stock for <strong className="text-slate-200">{item.name}</strong></p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800 rounded-lg p-3 text-center">
          <p className="text-xs text-slate-500 mb-1">Current</p>
          <p className="text-xl font-bold text-slate-200">{item.currentStock} <span className="text-sm text-slate-400">{item.unit}</span></p>
        </div>
        <div className="bg-slate-800 rounded-lg p-3 text-center">
          <p className="text-xs text-slate-500 mb-1">Min required</p>
          <p className="text-xl font-bold text-slate-200">{item.minStock} <span className="text-sm text-slate-400">{item.unit}</span></p>
        </div>
      </div>
      <FormField label={`New stock level (${item.unit})`}>
        <Input type="number" min={0} step="0.1" value={stock} onChange={(e) => setStock(parseFloat(e.target.value))} />
      </FormField>
      <div className="flex gap-3">
        <Button variant="secondary" onClick={onClose} className="flex-1 justify-center">Cancel</Button>
        <Button onClick={handleSave} loading={loading} className="flex-1 justify-center">
          <RotateCcw size={14} /> Update stock
        </Button>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [propertyFilter, setPropertyFilter] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState<InventoryItem | null>(null);
  const [restockModal, setRestockModal] = useState<InventoryItem | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [inv, props] = await Promise.all([api.inventory.list(), api.properties.list()]);
      setItems(inv); setProperties(props);
    } finally { setLoading(false); }
  }

  const filtered = items.filter((i) => {
    const matchProp = !propertyFilter || i.propertyId === propertyFilter;
    const matchCat = !catFilter || i.category === catFilter;
    const matchLow = !showLowOnly || i.currentStock <= i.minStock;
    return matchProp && matchCat && matchLow;
  });

  const lowCount = items.filter((i) => i.currentStock <= i.minStock).length;

  const grouped = CATEGORIES.reduce<Record<string, InventoryItem[]>>((acc, cat) => {
    acc[cat] = filtered.filter((i) => i.category === cat);
    return acc;
  }, {});

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Inventory</h1>
          <p className="text-slate-400 text-sm mt-1">
            {items.length} items tracked
            {lowCount > 0 && <span className="text-red-400 ml-2">· {lowCount} low stock</span>}
          </p>
        </div>
        <Button onClick={() => setAddModal(true)}><Plus size={16} /> Add item</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)} className="w-48">
          <option value="">All properties</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="w-44">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{CAT_ICONS[c]} {CAT_LABELS[c]}</option>)}
        </Select>
        <button
          onClick={() => setShowLowOnly(!showLowOnly)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${showLowOnly ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
        >
          <AlertTriangle size={14} /> Low stock only
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center py-16 gap-3">
          <Package size={48} className="text-slate-700" />
          <p className="text-slate-400">No inventory items found</p>
          <Button onClick={() => setAddModal(true)}>Add first item</Button>
        </div>
      ) : (
        <div className="space-y-6">
          {CATEGORIES.filter((c) => grouped[c].length > 0).map((cat) => (
            <div key={cat}>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span>{CAT_ICONS[cat]}</span> {CAT_LABELS[cat]}
                <span className="text-slate-600 font-normal normal-case tracking-normal">({grouped[cat].length})</span>
              </h3>
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs text-slate-600 uppercase tracking-wider">
                      <th className="text-left px-5 py-2.5">Item</th>
                      <th className="text-left px-5 py-2.5">Property</th>
                      <th className="text-left px-5 py-2.5">Location</th>
                      <th className="text-left px-5 py-2.5 w-40">Stock level</th>
                      <th className="text-right px-5 py-2.5">Stock</th>
                      <th className="px-5 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {grouped[cat].map((item) => {
                      const { pct, color, label } = stockLevel(item);
                      const isLow = item.currentStock <= item.minStock;
                      return (
                        <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              {isLow && <AlertTriangle size={13} className="text-amber-400 shrink-0" />}
                              <span className={isLow ? 'text-amber-200' : 'text-slate-200'}>{item.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-slate-400 text-xs">{item.property?.name}</td>
                          <td className="px-5 py-3 text-slate-500 text-xs">{item.location || '—'}</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.max(2, pct)}%` }} />
                              </div>
                              <Badge variant={label === 'OK' ? 'success' : label === 'Low' ? 'warning' : 'danger'} className="text-xs">
                                {label}
                              </Badge>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span className={`font-medium ${isLow ? 'text-amber-400' : 'text-slate-300'}`}>
                              {item.currentStock}
                            </span>
                            <span className="text-slate-600 text-xs"> / {item.minStock} {item.unit}</span>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1 justify-end">
                              <button onClick={() => setRestockModal(item)}
                                className="p-1.5 rounded hover:bg-slate-800 text-emerald-400 hover:text-emerald-300" title="Restock">
                                <RotateCcw size={13} />
                              </button>
                              <button onClick={() => setEditModal(item)}
                                className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs" title="Edit">
                                ✎
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={addModal} onClose={() => setAddModal(false)} title="Add inventory item">
        <ItemForm
          properties={properties}
          onSave={async (d) => { await api.inventory.create(d); await load(); }}
          onClose={() => setAddModal(false)}
        />
      </Modal>

      {editModal && (
        <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Edit item">
          <ItemForm
            properties={properties}
            initial={editModal}
            onSave={async (d) => { await api.inventory.update(editModal.id, d); await load(); }}
            onClose={() => setEditModal(null)}
          />
        </Modal>
      )}

      {restockModal && (
        <Modal open={!!restockModal} onClose={() => setRestockModal(null)} title="Update stock">
          <RestockModal
            item={restockModal}
            onSave={async (stock) => { await api.inventory.update(restockModal.id, { currentStock: stock }); await load(); }}
            onClose={() => setRestockModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
