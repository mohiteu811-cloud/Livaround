import { CheckCircle, Clock, AlertCircle, Video } from 'lucide-react'
import { CheckoutStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

interface CheckoutStatusCardProps {
  status: CheckoutStatus
  guestSubmittedAt?: string
  hostSubmittedAt?: string
  overallScore?: number
  damageReported?: boolean
}

const steps = [
  { key: 'pending_guest', label: 'Guest Walkthrough', icon: Video },
  { key: 'guest_submitted', label: 'Guest Submitted', icon: CheckCircle },
  { key: 'pending_host', label: 'Host Verification', icon: Clock },
  { key: 'completed', label: 'Verified', icon: CheckCircle },
]

const statusOrder = ['pending_guest', 'guest_submitted', 'pending_host', 'completed']

export function CheckoutStatusCard({
  status,
  guestSubmittedAt,
  hostSubmittedAt,
  overallScore,
  damageReported,
}: CheckoutStatusCardProps) {
  const currentIndex = statusOrder.indexOf(status)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Checkout Status</h3>
        {status === 'disputed' && (
          <span className="flex items-center gap-1 text-xs text-red-600 font-medium bg-red-50 px-2 py-1 rounded-full">
            <AlertCircle size={12} /> Disputed
          </span>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {steps.map((step, i) => {
          const done = i <= currentIndex
          const active = i === currentIndex
          const Icon = step.icon
          return (
            <div key={step.key} className="flex items-center gap-3">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                done ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'
              )}>
                <Icon size={16} />
              </div>
              <div className="flex-1">
                <p className={cn('text-sm font-medium', done ? 'text-gray-900' : 'text-gray-400')}>
                  {step.label}
                </p>
                {step.key === 'guest_submitted' && guestSubmittedAt && (
                  <p className="text-xs text-gray-400">
                    {new Date(guestSubmittedAt).toLocaleString()}
                  </p>
                )}
                {step.key === 'completed' && hostSubmittedAt && (
                  <p className="text-xs text-gray-400">
                    {new Date(hostSubmittedAt).toLocaleString()}
                  </p>
                )}
              </div>
              {active && status !== 'completed' && (
                <span className="text-xs text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-full">
                  Pending
                </span>
              )}
            </div>
          )
        })}
      </div>

      {status === 'completed' && overallScore !== undefined && (
        <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
          <span className="text-sm text-gray-600">Guest Checkout Score</span>
          <div className="flex items-center gap-2">
            {damageReported && (
              <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                Damage Reported
              </span>
            )}
            <span className="text-lg font-bold text-gray-900">
              {overallScore.toFixed(1)} <span className="text-amber-400">★</span>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
