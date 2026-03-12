'use client';

import { useEffect, useState } from 'react';
import { MapPin, ArrowRight, ExternalLink, Calendar, Users } from 'lucide-react';

interface Listing {
  id: string;
  name: string;
  platform: string;
  listingUrl: string;
  title: string;
  location: string;
  imageUrl: string | null;
  destination: string;
  travelStart: string;
  travelEnd: string;
}

function formatDateRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  return `${fmt(s)} – ${fmt(e)}`;
}

function platformLabel(p: string) {
  if (p === 'airbnb') return { label: 'Airbnb', color: 'bg-rose-50 text-rose-600' };
  if (p === 'homeexchange') return { label: 'HomeExchange', color: 'bg-green-50 text-green-600' };
  return { label: 'Listing', color: 'bg-slate-100 text-slate-500' };
}

function ListingCard({ listing }: { listing: Listing }) {
  const plat = platformLabel(listing.platform);
  return (
    <div className="group bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
      {/* Image */}
      <div className="relative h-48 bg-slate-100 overflow-hidden">
        {listing.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.imageUrl}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">🏠</div>
        )}
        <span className={`absolute top-3 left-3 text-xs font-semibold px-2 py-1 rounded-full ${plat.color}`}>
          {plat.label}
        </span>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col gap-3">
        <div>
          <p className="text-xs text-slate-400 font-medium mb-0.5">{listing.name}</p>
          <h3 className="font-semibold text-slate-900 text-sm leading-tight line-clamp-2">
            {listing.title}
          </h3>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          {listing.location}
        </div>

        {/* Exchange arrow */}
        <div className="flex items-center gap-2 py-2 px-3 bg-sand-50 rounded-xl">
          <span className="text-xs text-slate-500 truncate">{listing.location}</span>
          <ArrowRight className="w-3.5 h-3.5 text-sand-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-sand-600 truncate">{listing.destination}</span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Calendar className="w-3.5 h-3.5" />
          {formatDateRange(listing.travelStart, listing.travelEnd)}
        </div>

        <a
          href={listing.listingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500 hover:text-sand-600 transition-colors pt-1 border-t border-slate-50"
        >
          View {plat.label} listing <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

export default function ListingsBoard() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [matchCount, setMatchCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/listings')
      .then(r => r.json())
      .then(data => {
        setListings(data.listings ?? []);
        setMatchCount(data.matchCount ?? 0);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-72 rounded-2xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <div className="text-5xl mb-4">🏠</div>
        <p className="font-medium">No homes listed yet — be the first!</p>
        <p className="text-sm mt-1">List your home above and watch this board fill up.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Stats bar */}
      <div className="flex items-center gap-6 mb-8">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Users className="w-4 h-4 text-sand-400" />
          <span><strong className="text-slate-900">{listings.length}</strong> homes listed</span>
        </div>
        {matchCount > 0 && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span><strong className="text-slate-900">{matchCount}</strong> exchange route{matchCount !== 1 ? 's' : ''} found</span>
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {listings.map(l => <ListingCard key={l.id} listing={l} />)}
      </div>
    </div>
  );
}
