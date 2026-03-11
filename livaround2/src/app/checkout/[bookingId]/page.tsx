import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { GuestActions, HostActions } from '@/components/checkout/checkout-actions'
import { CheckoutStatusCard } from '@/components/checkout/checkout-status-card'
import { ScoreBadge } from '@/components/ui/score-badge'
import { Home, Calendar } from 'lucide-react'

interface PageProps {
  params: Promise<{ bookingId: string }>
}

export default async function CheckoutPage({ params }: PageProps) {
  const { bookingId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      *,
      property:properties(*),
      guest:user_profiles!bookings_guest_id_fkey(*),
      host:user_profiles!bookings_host_id_fkey(*)
    `)
    .eq('id', bookingId)
    .single()

  if (!booking) redirect('/')

  const isGuest = user.id === booking.guest_id
  const isHost = user.id === booking.host_id

  if (!isGuest && !isHost) redirect('/')

  let { data: verification } = await supabase
    .from('checkout_verifications')
    .select('*')
    .eq('booking_id', bookingId)
    .single()

  // Auto-create verification record if it doesn't exist (host triggers this)
  if (!verification && isHost) {
    const { data: newVerification } = await supabase
      .from('checkout_verifications')
      .insert({ booking_id: bookingId })
      .select()
      .single()
    verification = newVerification
  }

  const checkoutDate = new Date(booking.check_out).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8 flex flex-col gap-6">

        {/* Header */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Home size={14} />
            <span>{booking.property.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Checkout Verification</h1>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar size={14} />
            <span>{checkoutDate}</span>
          </div>
        </div>

        {/* Guest info (visible to host) */}
        {isHost && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-semibold">
              {booking.guest.full_name[0]}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{booking.guest.full_name}</p>
              <p className="text-xs text-gray-500">Guest</p>
            </div>
            {booking.guest.checkout_count > 0 && (
              <ScoreBadge
                score={booking.guest.checkout_score}
                count={booking.guest.checkout_count}
                size="sm"
              />
            )}
          </div>
        )}

        {/* Status card */}
        {verification && (
          <CheckoutStatusCard
            status={verification.status}
            guestSubmittedAt={verification.guest_submitted_at}
            hostSubmittedAt={verification.host_submitted_at}
            overallScore={verification.overall_score}
            damageReported={verification.damage_reported}
          />
        )}

        {/* Action forms */}
        {isGuest && verification?.status === 'pending_guest' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <GuestActions
              bookingId={bookingId}
              verificationId={verification.id}
            />
          </div>
        )}

        {isGuest && verification?.status === 'guest_submitted' && (
          <div className="bg-amber-50 rounded-2xl border border-amber-100 p-5 text-center">
            <p className="text-amber-800 font-medium">Your walkthrough has been submitted.</p>
            <p className="text-amber-700 text-sm mt-1">
              The host will verify the property and rate your checkout.
            </p>
          </div>
        )}

        {isHost && verification?.status === 'guest_submitted' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <HostActions
              bookingId={bookingId}
              verificationId={verification.id}
              guestName={booking.guest.full_name}
              guestVideoUrl={verification.guest_video_url ?? undefined}
            />
          </div>
        )}

        {isHost && verification?.status === 'pending_guest' && (
          <div className="bg-blue-50 rounded-2xl border border-blue-100 p-5 text-center">
            <p className="text-blue-800 font-medium">Waiting for guest to record their checkout.</p>
            <p className="text-blue-700 text-sm mt-1">
              You&apos;ll be notified when {booking.guest.full_name} submits their walkthrough.
            </p>
          </div>
        )}

        {verification?.status === 'completed' && (
          <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-5 text-center">
            <p className="text-emerald-800 font-semibold text-lg">Checkout Complete</p>
            {isHost && (
              <p className="text-emerald-700 text-sm mt-1">
                {booking.guest.full_name}&apos;s Checkout Score has been updated.
              </p>
            )}
            {isGuest && verification.overall_score && (
              <div className="mt-3 flex flex-col items-center gap-2">
                <p className="text-emerald-700 text-sm">Your checkout score for this stay:</p>
                <ScoreBadge score={verification.overall_score} count={1} size="lg" />
              </div>
            )}
          </div>
        )}

      </div>
    </main>
  )
}
