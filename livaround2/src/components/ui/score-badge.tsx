import { cn } from '@/lib/utils'

interface ScoreBadgeProps {
  score: number
  count: number
  size?: 'sm' | 'md' | 'lg'
}

export function ScoreBadge({ score, count, size = 'md' }: ScoreBadgeProps) {
  const color =
    score >= 4.5 ? 'bg-emerald-100 text-emerald-700' :
    score >= 3.5 ? 'bg-yellow-100 text-yellow-700' :
    'bg-red-100 text-red-700'

  return (
    <div className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1', color, {
      'text-xs': size === 'sm',
      'text-sm': size === 'md',
      'text-base': size === 'lg',
    })}>
      <span className="font-bold">{score.toFixed(1)}</span>
      <span className="opacity-60">★</span>
      <span className="opacity-60">({count})</span>
    </div>
  )
}
