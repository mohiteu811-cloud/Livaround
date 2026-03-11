'use client'

import { useRouter } from 'next/navigation'
import { GuestCheckoutForm } from './guest-checkout-form'
import { HostCheckoutForm } from './host-checkout-form'

interface GuestActionsProps {
  bookingId: string
  verificationId: string
}

export function GuestActions({ bookingId, verificationId }: GuestActionsProps) {
  const router = useRouter()
  return (
    <GuestCheckoutForm
      bookingId={bookingId}
      verificationId={verificationId}
      onComplete={() => router.refresh()}
    />
  )
}

interface HostActionsProps {
  bookingId: string
  verificationId: string
  guestName: string
  guestVideoUrl?: string
}

export function HostActions({ bookingId, verificationId, guestName, guestVideoUrl }: HostActionsProps) {
  const router = useRouter()
  return (
    <HostCheckoutForm
      bookingId={bookingId}
      verificationId={verificationId}
      guestName={guestName}
      guestVideoUrl={guestVideoUrl}
      onComplete={() => router.refresh()}
    />
  )
}
