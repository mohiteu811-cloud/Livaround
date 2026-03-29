'use client';

import { Lock } from 'lucide-react';
import { useFeatureGate } from '@/lib/useFeatureGate';

/**
 * Wraps a feature section.  When the feature is gated, renders the children
 * with a semi-transparent overlay + lock icon and plan upgrade tooltip.
 * Never hides features — just overlays them so users can see what they'd get.
 */
export function FeatureGate({
  feature,
  children,
}: {
  feature: string;
  children: React.ReactNode;
}) {
  const { allowed, requiredPlan, loading } = useFeatureGate(feature);

  if (loading) {
    return <div className="animate-pulse opacity-50">{children}</div>;
  }

  if (allowed) {
    return <>{children}</>;
  }

  const label =
    requiredPlan === 'agency' ? 'Available on Agency' : 'Available on Pro';

  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-40">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="group relative flex items-center gap-1.5 rounded-full bg-slate-800/90 px-3 py-1.5 text-xs font-medium text-slate-300 ring-1 ring-slate-700">
          <Lock className="h-3.5 w-3.5 text-amber-400" />
          {label}
          {/* Tooltip on hover */}
          <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-950 px-2 py-1 text-xs text-slate-300 opacity-0 shadow-lg ring-1 ring-slate-700 transition-opacity group-hover:opacity-100">
            Upgrade to {requiredPlan === 'agency' ? 'Agency' : 'Pro'} to unlock
          </span>
        </div>
      </div>
    </div>
  );
}
