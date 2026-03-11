'use client'

import { useState, useCallback } from 'react'
import { MapPin, Upload, CheckCircle, AlertTriangle } from 'lucide-react'
import { VideoRecorder } from './video-recorder'
import { StarRating } from './star-rating'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { CheckoutRating } from '@/lib/types'

interface HostCheckoutFormProps {
  bookingId: string
  verificationId: string
  guestName: string
  guestVideoUrl?: string
  onComplete: () => void
}

type SubmitState = 'idle' | 'uploading' | 'saving' | 'done' | 'error'

export function HostCheckoutForm({
  bookingId,
  verificationId,
  guestName,
  guestVideoUrl,
  onComplete,
}: HostCheckoutFormProps) {
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationError, setLocationError] = useState('')
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [rating, setRating] = useState<CheckoutRating>({
    overall: 0,
    cleanliness: 0,
    damage_reported: false,
    damage_notes: '',
    notes: '',
  })

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

  const canSubmit = videoBlob && rating.overall > 0 && rating.cleanliness > 0 &&
    (!rating.damage_reported || rating.damage_notes.trim().length > 0)

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitState('uploading')

    try {
      const supabase = createClient()
      const fileName = `checkout/${bookingId}/host_${Date.now()}.webm`

      const { error: uploadError } = await supabase.storage
        .from('checkout-videos')
        .upload(fileName, videoBlob!, { contentType: 'video/webm', upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('checkout-videos')
        .getPublicUrl(fileName)

      setSubmitState('saving')

      const { error: updateError } = await supabase
        .from('checkout_verifications')
        .update({
          host_video_url: publicUrl,
          host_submitted_at: new Date().toISOString(),
          host_location_lat: location?.lat,
          host_location_lng: location?.lng,
          overall_score: rating.overall,
          cleanliness_score: rating.cleanliness,
          damage_reported: rating.damage_reported,
          damage_notes: rating.damage_notes || null,
          host_notes: rating.notes || null,
          status: 'completed',
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
        <h2 className="text-xl font-bold text-gray-900">Verification Complete</h2>
        <p className="text-gray-500 text-center">
          {guestName}&apos;s Checkout Score has been updated.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Property Condition Check</h2>
        <p className="text-sm text-gray-500">
          Record a walkthrough and rate how {guestName} left the property.
        </p>
      </div>

      {guestVideoUrl && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-700">Guest&apos;s Checkout Video</p>
          <video
            src={guestVideoUrl}
            controls
            className="w-full aspect-video rounded-2xl bg-gray-900 object-cover"
          />
        </div>
      )}

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Your Walkthrough Video</p>
        <VideoRecorder onVideoReady={handleVideoReady} maxDurationSeconds={180} />
      </div>

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
      </div>

      <div className="bg-gray-50 rounded-2xl p-5 flex flex-col gap-5">
        <h3 className="font-semibold text-gray-900">Rate {guestName}&apos;s Checkout</h3>

        <StarRating
          label="Overall"
          value={rating.overall}
          onChange={(v) => setRating((r) => ({ ...r, overall: v }))}
        />
        <StarRating
          label="Cleanliness"
          value={rating.cleanliness}
          onChange={(v) => setRating((r) => ({ ...r, cleanliness: v }))}
        />

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setRating((r) => ({ ...r, damage_reported: !r.damage_reported }))}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
              rating.damage_reported
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-white text-gray-700 border border-gray-200'
            }`}
          >
            <AlertTriangle size={16} />
            Report Damage
          </button>

          {rating.damage_reported && (
            <textarea
              placeholder="Describe the damage (required)..."
              value={rating.damage_notes}
              onChange={(e) => setRating((r) => ({ ...r, damage_notes: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm resize-none outline-none focus:ring-2 focus:ring-[#1A1A2E]/20"
              rows={3}
            />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Additional Notes</label>
          <textarea
            placeholder="Anything else to note about this guest's stay..."
            value={rating.notes}
            onChange={(e) => setRating((r) => ({ ...r, notes: e.target.value }))}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm resize-none outline-none focus:ring-2 focus:ring-[#1A1A2E]/20"
            rows={3}
          />
        </div>
      </div>

      {submitState === 'error' && (
        <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{errorMsg}</p>
      )}

      <Button
        onClick={handleSubmit}
        disabled={!canSubmit || submitState === 'uploading' || submitState === 'saving'}
        size="lg"
        className="gap-2 w-full"
      >
        <Upload size={18} />
        {submitState === 'uploading' ? 'Uploading video...' :
         submitState === 'saving' ? 'Saving...' :
         'Submit Verification'}
      </Button>
    </div>
  )
}
