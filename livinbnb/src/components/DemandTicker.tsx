'use client';

import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';

interface Destination { city: string; count: number; }

export default function DemandTicker() {
  const [destinations, setDestinations] = useState<Destination[]>([]);

  useEffect(() => {
    fetch('/api/listings')
      .then(r => r.json())
      .then(d => setDestinations(d.topDestinations ?? []))
      .catch(() => {});
  }, []);

  if (destinations.length === 0) return null;

  return (
    <div className="flex items-center justify-center gap-1.5 flex-wrap mt-4">
      <TrendingUp className="w-3.5 h-3.5 text-sand-400" />
      <span className="text-xs text-slate-400 font-medium">People want:</span>
      {destinations.map(({ city, count }, i) => (
        <span key={city} className="flex items-center gap-1">
          <span className="text-xs font-semibold text-slate-700">
            {count} → {city}
          </span>
          {i < destinations.length - 1 && <span className="text-slate-300">·</span>}
        </span>
      ))}
    </div>
  );
}
