'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  Building2,
  CalendarCheck,
  Briefcase,
  Users,
  DollarSign,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import Link from 'next/link';
import { api, DashboardStats } from '@/lib/api';
import { StatsCard } from '@/components/StatsCard';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { statusBadge } from '@/components/ui/Badge';

const PIE_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

const JOB_TYPE_ICONS: Record<string, string> = {
  CLEANING: '🧹',
  COOKING: '🍳',
  DRIVING: '🚗',
  MAINTENANCE: '🔧',
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.analytics.dashboard().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-96">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-slate-400">Failed to load dashboard data.</div>
    );
  }

  const { stats, recentBookings, upcomingJobs, bookingsBySource, revenueByMonth, lowStockAlerts } = data;

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Overview</h1>
        <p className="text-slate-400 text-sm mt-1">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Properties"
          value={stats.totalProperties}
          subtitle="Active listings"
          icon={Building2}
          color="blue"
        />
        <StatsCard
          title="Active Bookings"
          value={stats.activeBookings}
          subtitle="Current & upcoming"
          icon={CalendarCheck}
          color="emerald"
        />
        <StatsCard
          title="Pending Jobs"
          value={stats.pendingJobs}
          subtitle="Awaiting dispatch"
          icon={Briefcase}
          color="amber"
        />
        <StatsCard
          title="Workers"
          value={stats.totalWorkers}
          subtitle="On platform"
          icon={Users}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Revenue (this month)"
          value={`$${stats.monthlyRevenue.toLocaleString()}`}
          subtitle={`${stats.monthlyBookings} bookings`}
          icon={DollarSign}
          color="emerald"
          trend={stats.revenueGrowth !== null ? { value: stats.revenueGrowth, label: 'vs last month' } : null}
        />
        <StatsCard
          title="Jobs Completed"
          value={stats.completedJobsThisMonth}
          subtitle="This month"
          icon={Briefcase}
          color="blue"
        />
        <StatsCard
          title="Low Stock Alerts"
          value={stats.lowStockAlerts}
          subtitle="Needs restocking"
          icon={AlertTriangle}
          color={stats.lowStockAlerts > 0 ? 'red' : 'emerald'}
        />
        <StatsCard
          title="Active Workers"
          value={stats.totalWorkers}
          subtitle="On the platform"
          icon={Users}
          color="purple"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue chart */}
        <Card className="lg:col-span-2">
          <CardHeader title="Revenue (last 6 months)" />
          <CardBody>
            {revenueByMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={revenueByMonth}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                    labelStyle={{ color: '#e2e8f0' }}
                    formatter={(v: number) => [`$${v.toLocaleString()}`, 'Revenue']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#0ea5e9" fill="url(#colorRevenue)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-slate-500 text-sm">
                No revenue data yet
              </div>
            )}
          </CardBody>
        </Card>

        {/* Booking sources pie */}
        <Card>
          <CardHeader title="Booking Sources" />
          <CardBody>
            {bookingsBySource.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={bookingsBySource}
                    dataKey="_count"
                    nameKey="source"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                  >
                    {bookingsBySource.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                    formatter={(v, name) => [v, (name as string).replace('_', ' ')]}
                  />
                  <Legend formatter={(v) => v.replace('_', ' ')} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-slate-500 text-sm">
                No bookings yet
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Tables row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent bookings */}
        <Card>
          <CardHeader
            title="Recent Bookings"
            action={
              <Link href="/bookings" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                View all <ArrowRight size={12} />
              </Link>
            }
          />
          <div className="divide-y divide-slate-800">
            {recentBookings.length === 0 && (
              <p className="px-6 py-4 text-slate-500 text-sm">No bookings yet</p>
            )}
            {recentBookings.map((b) => (
              <div key={b.id} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-200">{b.guestName}</p>
                  <p className="text-xs text-slate-500">
                    {b.property?.name} · {format(new Date(b.checkIn), 'dd MMM')} – {format(new Date(b.checkOut), 'dd MMM')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-300">${b.totalAmount.toLocaleString()}</span>
                  {statusBadge(b.status)}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Upcoming jobs */}
        <Card>
          <CardHeader
            title="Upcoming Jobs"
            action={
              <Link href="/jobs" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                View all <ArrowRight size={12} />
              </Link>
            }
          />
          <div className="divide-y divide-slate-800">
            {upcomingJobs.length === 0 && (
              <p className="px-6 py-4 text-slate-500 text-sm">No upcoming jobs</p>
            )}
            {upcomingJobs.map((j) => (
              <div key={j.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{JOB_TYPE_ICONS[j.type] || '📋'}</span>
                  <div>
                    <p className="text-sm font-medium text-slate-200">
                      {j.type.charAt(0) + j.type.slice(1).toLowerCase()} · {j.property?.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {format(new Date(j.scheduledAt), 'dd MMM, HH:mm')}
                      {j.worker && ` · ${j.worker.user.name}`}
                    </p>
                  </div>
                </div>
                {statusBadge(j.status)}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Low stock alerts */}
      {lowStockAlerts.length > 0 && (
        <Card>
          <CardHeader
            title={`Low Stock Alerts (${lowStockAlerts.length})`}
            action={
              <Link href="/inventory" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                Manage inventory <ArrowRight size={12} />
              </Link>
            }
          />
          <div className="divide-y divide-slate-800">
            {lowStockAlerts.map((item) => (
              <div key={item.id} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-200">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.property?.name} · {item.location}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-red-400 font-medium">
                    {item.currentStock} {item.unit}
                  </p>
                  <p className="text-xs text-slate-500">min: {item.minStock} {item.unit}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
