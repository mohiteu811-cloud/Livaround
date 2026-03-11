'use client'

import { useState, useCallback } from 'react'
import { MapPin, Upload, CheckCircle } from 'lucide-react'
import { VideoRecorder } from './video-recorder'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

interface GuestCheckoutFormProps {
  bookingId: string
  verificationId: string
  onComplete: () => void
}

type SubmitState = 'idle' | 'uploading' | 'saving' | 'done' | 'error'

export function GuestCheckoutForm({ bookingId, verificationId, onComplete }: GuestCheckoutFormProps) {
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationError, setLocationError] = useState('')
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleVideoReady = useCallback((blob: Blob) => {
    setVideoBlob(blob)
  }, [])

  const captureLocation = useCallback(() => {
    setLocationError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLocationError('Could not get location. Please enable location services.')
    )
  }, [])

  const handleSubmit = async () => {
    if (!videoBlob) return
    setSubmitState('uploading')

    try {
      const supabase = createClient()
      const fileName = `checkout/${bookingId}/guest_${Date.now()}.webm`

      const { error: uploadError } = await supabase.storage
        .from('checkout-videos')
        .upload(fileName, videoBlob, { contentType: 'video/webm', upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('checkout-videos')
        .getPublicUrl(fileName)

      setSubmitState('saving')

      const { error: updateError } = await supabase
        .from('checkout_verifications')
        .update({
          guest_video_url: publicUrl,
          guest_submitted_at: new Date().toISOString(),
          guest_location_lat: location?.lat,
          guest_location_lng: location?.lng,
          status: 'guest_submitted',
        })
        .eq('id', verificationId)

      if (updateError) throw updateError

      setSubmitState('done')
      setTimeout(onComplete, 1500)
    } catch (err) {
      console.error(err)
      setErrorMsg('Something went wrong. Please try again.')
      setSubmitState('error')
    }
  }

  if (submitState === 'done') {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <CheckCircle size={56} className="text-emerald-500" />
        <h2 className="text-xl font-bold text-gray-900">Checkout Submitted</h2>
        <p className="text-gray-500 text-center">
          Your walkthrough has been recorded. The host will verify the property shortly.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Your Checkout Walkthrough</h2>
        <p className="text-sm text-gray-500">
          Record a video walking through each room. This protects you from false damage claims.
        </p>
      </div>

      <VideoRecorder onVideoReady={handleVideoReady} maxDurationSeconds={120} />

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <MapPin size={16} />
            <span>Location Verification</span>
          </div>
          {location ? (
            <span className="text-xs text-emerald-600 font-medium">
              {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
            </span>
          ) : (
            <Button size="sm" variant="secondary" onClick={captureLocation}>
              Capture Location
            </Button>
          )}
        </div>
        {locationError && <p className="text-xs text-red-500">{locationError}</p>}
        <p className="text-xs text-gray-400">
          Location is timestamped to confirm you were on-site at checkout.
        </p>
      </div>

      {submitState === 'error' && (
        <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{errorMsg}</p>
      )}

      <Button
        onClick={handleSubmit}
        disabled={!videoBlob || submitState === 'uploading' || submitState === 'saving'}
        size="lg"
        className="gap-2 w-full"
      >
        <Upload size={18} />
        {submitState === 'uploading' ? 'Uploading video...' :
         submitState === 'saving' ? 'Saving...' :
         'Submit My Checkout'}
      </Button>
    </div>
  )
}
