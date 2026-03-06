import clsx from 'clsx';
import { LucideIcon } from 'lucide-react';

interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string } | null;
  color?: 'blue' | 'emerald' | 'amber' | 'purple' | 'red';
}

const colors = {
  blue: { bg: 'bg-brand-500/10', icon: 'text-brand-400', border: 'border-brand-500/20' },
  emerald: { bg: 'bg-emerald-500/10', icon: 'text-emerald-400', border: 'border-emerald-500/20' },
  amber: { bg: 'bg-amber-500/10', icon: 'text-amber-400', border: 'border-amber-500/20' },
  purple: { bg: 'bg-purple-500/10', icon: 'text-purple-400', border: 'border-purple-500/20' },
  red: { bg: 'bg-red-500/10', icon: 'text-red-400', border: 'border-red-500/20' },
};

export function StatsCard({ title, value, subtitle, icon: Icon, trend, color = 'blue' }: Props) {
  const c = colors[color];
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400 mb-1">{title}</p>
          <p className="text-2xl font-bold text-slate-100">{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
          {trend !== null && trend !== undefined && (
            <p
              className={clsx(
                'text-xs mt-1.5 font-medium',
                trend.value >= 0 ? 'text-emerald-400' : 'text-red-400'
              )}
            >
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value).toFixed(1)}% {trend.label}
            </p>
          )}
        </div>
        <div className={clsx('p-2.5 rounded-lg border', c.bg, c.border)}>
          <Icon size={20} className={c.icon} />
        </div>
      </div>
    </div>
  );
}
