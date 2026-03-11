'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface StarRatingProps {
  value: number
  onChange: (value: number) => void
  label: string
  size?: number
}

export function StarRating({ value, onChange, label, size = 32 }: StarRatingProps) {
  const [hovered, setHovered] = useState(0)

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onChange(star)}
            className={cn(
              'transition-transform active:scale-90',
              (hovered || value) >= star ? 'text-amber-400' : 'text-gray-200'
            )}
            style={{ fontSize: size }}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  )
}
