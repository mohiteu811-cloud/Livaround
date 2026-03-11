export type UserRole = 'guest' | 'host' | 'cleaner'

export type CheckoutStatus =
  | 'pending_guest'
  | 'guest_submitted'
  | 'pending_host'
  | 'completed'
  | 'disputed'

export interface Booking {
  id: string
  property_id: string
  guest_id: string
  host_id: string
  check_in: string
  check_out: string
  status: string
  property: Property
  guest: UserProfile
}

export interface Property {
  id: string
  host_id: string
  name: string
  address: string
  city: string
  cover_image_url?: string
}

export interface UserProfile {
  id: string
  full_name: string
  avatar_url?: string
  role: UserRole
  checkout_score?: number
  checkout_count?: number
}

export interface CheckoutVerification {
  id: string
  booking_id: string
  guest_video_url?: string
  guest_submitted_at?: string
  guest_location_lat?: number
  guest_location_lng?: number
  host_video_url?: string
  host_submitted_at?: string
  host_location_lat?: number
  host_location_lng?: number
  cleaner_id?: string
  overall_score?: number
  cleanliness_score?: number
  damage_reported: boolean
  damage_notes?: string
  host_notes?: string
  status: CheckoutStatus
  created_at: string
}

export interface CheckoutRating {
  overall: number
  cleanliness: number
  damage_reported: boolean
  damage_notes: string
  notes: string
}
