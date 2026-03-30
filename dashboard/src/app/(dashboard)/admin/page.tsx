'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DollarSign,
  TrendingUp,
  Users,
  RefreshCw,
  ArrowDownRight,
  BarChart3,
  Building2,
  Coins,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { api, AdminStats } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { StatsCard } from '@/components/StatsCard';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'mohit@livaround.com';

const eventBadge: Record<string, { label: string; variant: 'success' | 'info' | 'danger' | 'warning' }> = {
  new: { label: 'New', variant: 'success' },
  upgraded: { label: 'Upgraded', variant: 'info' },
  cancelled: { label: 'Cancelled', variant: 'danger' },
  payment_failed: { label: 'Payment failed', variant: 'warning' },
};

export default function AdminPage() {
  const router = useRouter();
  const [data, setData] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    getCurrentUser().then((user) => {
      if (user?.email !== ADMIN_EMAIL) {
        router.replace('/dashboard');
        return;
      }
      setAuthorized(true);
      api.admin
        .stats()
        .then(setData)
        .finally(() => setLoading(false));
    });
  }, [router]);

  if (!authorized || loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-96">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 md:p-8 text-slate-400">Failed to load admin data.</div>
    );
  }

  const { kpis, mrrHistory, recentEvents } = data;

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Platform Admin</h1>
        <p className="text-sm text-slate-400 mt-1">Revenue and subscription metrics</p>
      </div>

      {/* KPI cards — row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Monthly Recurring Revenue"
          value={`$${kpis.totalMRR.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          subtitle="Active subscriptions"
          icon={DollarSign}
          color="emerald"
        />
        <StatsCard
          title="Annual Run Rate"
          value={`$${kpis.totalARR.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          subtitle="MRR × 12"
          icon={TrendingUp}
          color="blue"
        />
        <StatsCard
          title="Active Subscriptions"
          value={kpis.activeSubscriptions}
          subtitle="Paying orgs"
          icon={Users}
          color="purple"
        />
        <StatsCard
          title="Trial Conversion"
          value={`${kpis.trialConversionRate.toFixed(1)}%`}
          subtitle="This month"
          icon={RefreshCw}
          color="blue"
        />
      </div>

      {/* KPI cards — row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Monthly Churn Rate"
          value={`${kpis.monthlyChurnRate.toFixed(1)}%`}
          subtitle="Cancelled / total"
          icon={ArrowDownRight}
          color={kpis.monthlyChurnRate > 5 ? 'red' : 'emerald'}
        />
        <StatsCard
          title="Avg Revenue / Org"
          value={`$${kpis.arpu.toFixed(0)}`}
          subtitle="ARPU"
          icon={BarChart3}
          color="amber"
        />
        <StatsCard
          title="Properties Managed"
          value={kpis.totalProperties}
          subtitle="Across all orgs"
          icon={Building2}
          color="blue"
        />
        <StatsCard
          title="Pending Commissions"
          value={`$${kpis.pendingPayouts.toFixed(2)}`}
          subtitle="Partner payouts"
          icon={Coins}
          color="amber"
        />
      </div>

      {/* MRR chart */}
      <Card>
        <CardHeader title="MRR over last 12 months" />
        <CardBody>
          {mrrHistory.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={mrrHistory}>
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  contentStyle={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: 8,
                  }}
                  labelStyle={{ color: '#e2e8f0' }}
                  formatter={(v: number, name: string) => [
                    `$${v.toLocaleString()}`,
                    name === 'pro' ? 'Pro' : name === 'agency' ? 'Agency' : 'Total',
                  ]}
                />
                <Legend
                  formatter={(v) =>
                    v === 'pro' ? 'Pro' : v === 'agency' ? 'Agency' : 'Total'
                  }
                />
                <Line
                  type="monotone"
                  dataKey="pro"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="agency"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-slate-500 text-sm">
              No MRR data yet
            </div>
          )}
        </CardBody>
      </Card>

      {/* Recent subscription events */}
      <Card>
        <CardHeader title="Recent Subscription Events" />
        <CardBody>
          {recentEvents.length === 0 ? (
            <p className="text-sm text-slate-500">No subscription events yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-500">
                    <th className="pb-2 pr-4 font-medium">Organization</th>
                    <th className="pb-2 pr-4 font-medium">Plan</th>
                    <th className="pb-2 pr-4 font-medium">Event</th>
                    <th className="pb-2 pr-4 font-medium text-right">Amount</th>
                    <th className="pb-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEvents.map((e) => {
                    const badge = eventBadge[e.eventType] || {
                      label: e.eventType,
                      variant: 'default' as const,
                    };
                    return (
                      <tr key={e.id} className="border-b border-slate-800/50">
                        <td className="py-3 pr-4 text-slate-200">{e.orgName}</td>
                        <td className="py-3 pr-4 capitalize text-slate-400">{e.planName}</td>
                        <td className="py-3 pr-4">
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </td>
                        <td className="py-3 pr-4 text-right text-slate-200">
                          ${e.monthlyAmount.toFixed(2)}
                        </td>
                        <td className="py-3 text-slate-400">
                          {new Date(e.date).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
