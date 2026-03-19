'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2, CalendarCheck, DollarSign, Wrench, LogOut,
  TrendingUp, AlertCircle, Clock, BarChart3,
} from 'lucide-react';
import { api, OwnerDashboard, RevenueReport } from '@/lib/api';
import { getToken, clearToken } from '@/lib/auth';

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'text-slate-400',
  MEDIUM: 'text-amber-400',
  HIGH: 'text-orange-400',
  URGENT: 'text-red-400',
};

const INVOLVEMENT_DESC: Record<string, string> = {
  NONE: 'No visibility',
  REPORTS_ONLY: 'Booking activity',
  FINANCIAL: 'Bookings & revenue',
  FULL: 'Full visibility',
};

function StatCard({ icon: Icon, label, value, sub, color = 'text-brand-400' }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center ${color}`}>
          <Icon size={15} />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-100">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function OwnerDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<OwnerDashboard | null>(null);
  const [revenueReports, setRevenueReports] = useState<RevenueReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) { router.replace('/owner/login'); return; }
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [d, r] = await Promise.all([
        api.owners.dashboard(),
        api.revenueReports.ownerReports().catch(() => [] as RevenueReport[]),
      ]);
      setData(d);
      setRevenueReports(r);
    } catch (err) {
      if (err instanceof Error && err.message === 'Unauthorized') return;
      setError('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    clearToken();
    router.push('/owner/login');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalProperties = data?.properties.length || 0;
  const totalActiveBookings = data?.properties.reduce((sum, p) => sum + (p.property.activeBookings?.length || 0), 0) || 0;
  const totalRevenue = data?.properties.reduce((sum, p) => sum + (p.property.recentRevenue || 0), 0) || 0;
  const pendingMaintenance = data?.properties.reduce((sum, p) => sum + (p.property.maintenanceRequests?.filter((m) => m.status === 'PENDING').length || 0), 0) || 0;
  const hasFinancial = data?.properties.some((p) => ['FINANCIAL', 'FULL'].includes(p.involvementLevel));
  const hasMaintenance = data?.properties.some((p) => p.involvementLevel === 'FULL');
  const pendingExpenseApprovals = revenueReports.reduce((s, r) =>
    s + r.expenses.filter((e) => e.requiresApproval && e.approvalStatus === 'PENDING').length, 0);
  const latestReport = revenueReports[0];

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center text-white font-bold text-sm">L</div>
          <div>
            <span className="font-bold text-slate-100">LivAround</span>
            <span className="ml-2 text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">Owner portal</span>
          </div>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
          <LogOut size={15} /> Sign out
        </button>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-8 space-y-8">
        {error && (
          <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>
        )}

        <div>
          <h1 className="text-2xl font-bold text-slate-100">Your portfolio</h1>
          <p className="text-slate-400 text-sm mt-1">{totalProperties} {totalProperties === 1 ? 'property' : 'properties'} in your portfolio</p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Building2} label="Properties" value={totalProperties} color="text-violet-400" />
          <StatCard icon={CalendarCheck} label="Active bookings" value={totalActiveBookings} color="text-blue-400" />
          {hasFinancial && (
            <StatCard icon={DollarSign} label="Revenue (active)" value={`₹${totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} color="text-emerald-400" />
          )}
          {hasMaintenance && pendingMaintenance > 0 && (
            <StatCard icon={Wrench} label="Pending maintenance" value={pendingMaintenance} color="text-amber-400" />
          )}
        </div>

        {/* Revenue reports banner */}
        {(revenueReports.length > 0 || pendingExpenseApprovals > 0) && (
          <div
            className={`rounded-xl border p-5 cursor-pointer hover:border-brand-500/50 transition-colors ${
              pendingExpenseApprovals > 0
                ? 'bg-amber-500/5 border-amber-500/20'
                : 'bg-slate-900 border-slate-800'
            }`}
            onClick={() => router.push('/owner/revenue')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${pendingExpenseApprovals > 0 ? 'bg-amber-500/20' : 'bg-slate-800'}`}>
                  <BarChart3 size={16} className={pendingExpenseApprovals > 0 ? 'text-amber-400' : 'text-brand-400'} />
                </div>
                <div>
                  <p className="font-medium text-slate-200">Revenue Reports</p>
                  {pendingExpenseApprovals > 0 ? (
                    <p className="text-xs text-amber-400">{pendingExpenseApprovals} expense{pendingExpenseApprovals > 1 ? 's' : ''} awaiting your approval</p>
                  ) : (
                    <p className="text-xs text-slate-500">{revenueReports.length} published report{revenueReports.length !== 1 ? 's' : ''} from your manager</p>
                  )}
                </div>
              </div>
              {latestReport && (
                <div className="text-right">
                  <p className="text-xs text-slate-500">Latest ({['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][latestReport.month - 1]} {latestReport.year})</p>
                  <p className="text-sm font-bold text-emerald-400">
                    ₹{(latestReport.netRevenue - latestReport.commissionAmount - latestReport.expenses.reduce((s, e) => s + e.amount, 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Per-property breakdown */}
        <div className="space-y-6">
          {data?.properties.map((ownership) => {
            const { property, involvementLevel, ownershipPercent } = ownership;
            const inv = INVOLVEMENT_DESC[involvementLevel] || '';

            return (
              <div key={ownership.propertyId} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                {/* Property header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <Building2 size={16} className="text-violet-400" />
                    <div>
                      <p className="font-semibold text-slate-100">{property.name}</p>
                      <p className="text-xs text-slate-500">{property.city} · {property.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    {ownershipPercent && <span className="font-medium text-slate-400">{ownershipPercent}% ownership</span>}
                    <span className="bg-slate-800 px-2 py-0.5 rounded">{inv}</span>
                  </div>
                </div>

                <div className="p-5 space-y-5">
                  {/* Active bookings — visible from REPORTS_ONLY up */}
                  {property.activeBookings && property.activeBookings.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Active bookings</p>
                      <div className="space-y-2">
                        {property.activeBookings.map((b) => (
                          <div key={b.id} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2 text-sm">
                            <div>
                              <p className="text-slate-200">{b.guestName}</p>
                              <p className="text-xs text-slate-500">
                                {new Date(b.checkIn).toLocaleDateString()} → {new Date(b.checkOut).toLocaleDateString()}
                              </p>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${b.status === 'CHECKED_IN' ? 'text-emerald-400 bg-emerald-500/10' : 'text-blue-400 bg-blue-500/10'}`}>
                              {b.status.replace('_', ' ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {property.activeBookings && property.activeBookings.length === 0 && involvementLevel !== 'NONE' && (
                    <p className="text-sm text-slate-600 italic">No active bookings at this property.</p>
                  )}

                  {/* Revenue — FINANCIAL and FULL */}
                  {property.recentRevenue !== undefined && (
                    <div className="flex items-center gap-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg px-4 py-3">
                      <TrendingUp size={16} className="text-emerald-400" />
                      <div>
                        <p className="text-xs text-slate-500">Revenue from active bookings</p>
                        <p className="text-lg font-bold text-emerald-400">${property.recentRevenue.toLocaleString()}</p>
                      </div>
                    </div>
                  )}

                  {/* Maintenance — FULL only */}
                  {property.maintenanceRequests && property.maintenanceRequests.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Open maintenance</p>
                      <div className="space-y-2">
                        {property.maintenanceRequests.map((m) => (
                          <div key={m.id} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2 text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                              <Wrench size={12} className="text-slate-500 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-slate-200 truncate">{m.title}</p>
                                <p className="text-xs text-slate-500">{m.tradeRole?.name || 'General'}</p>
                              </div>
                            </div>
                            <span className={`text-xs font-medium flex-shrink-0 ml-2 ${PRIORITY_COLORS[m.priority]}`}>{m.priority}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {involvementLevel === 'NONE' && (
                    <div className="flex items-center gap-2 text-slate-600 text-sm">
                      <AlertCircle size={14} />
                      <span>You have chosen not to receive updates for this property.</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {data?.properties.length === 0 && (
          <div className="text-center py-16 text-slate-600">
            <Building2 size={40} className="mx-auto mb-3 opacity-40" />
            <p>No properties linked to your account yet.</p>
            <p className="text-sm mt-1">Contact your property manager to link your properties.</p>
          </div>
        )}
      </main>
    </div>
  );
}
