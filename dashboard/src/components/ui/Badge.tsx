import clsx from 'clsx';

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

const variants: Record<Variant, string> = {
  default: 'bg-slate-700 text-slate-300',
  success: 'bg-emerald-500/20 text-emerald-400',
  warning: 'bg-amber-500/20 text-amber-400',
  danger: 'bg-red-500/20 text-red-400',
  info: 'bg-sky-500/20 text-sky-400',
  purple: 'bg-purple-500/20 text-purple-400',
};

export function Badge({
  children,
  variant = 'default',
  className,
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: Variant }> = {
    CONFIRMED: { label: 'Confirmed', variant: 'info' },
    CHECKED_IN: { label: 'Checked In', variant: 'success' },
    CHECKED_OUT: { label: 'Checked Out', variant: 'default' },
    CANCELLED: { label: 'Cancelled', variant: 'danger' },
    PENDING: { label: 'Pending', variant: 'warning' },
    DISPATCHED: { label: 'Dispatched', variant: 'info' },
    ACCEPTED: { label: 'Accepted', variant: 'purple' },
    IN_PROGRESS: { label: 'In Progress', variant: 'info' },
    COMPLETED: { label: 'Completed', variant: 'success' },
  };
  const { label, variant } = map[status] || { label: status, variant: 'default' as Variant };
  return <Badge variant={variant}>{label}</Badge>;
}

export function skillBadge(skill: string) {
  const map: Record<string, { icon: string; variant: Variant }> = {
    CLEANING: { icon: '🧹', variant: 'info' },
    COOKING: { icon: '🍳', variant: 'warning' },
    DRIVING: { icon: '🚗', variant: 'purple' },
    MAINTENANCE: { icon: '🔧', variant: 'default' },
  };
  const { icon, variant } = map[skill] || { icon: '', variant: 'default' as Variant };
  return (
    <Badge key={skill} variant={variant}>
      {icon} {skill.charAt(0) + skill.slice(1).toLowerCase()}
    </Badge>
  );
}
