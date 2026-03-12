'use client';

import { useEffect, useState } from 'react';
import { MapPin, ExternalLink, Calendar, Users } from 'lucide-react';

interface DestinationWish {
  id: string;
  city: string;
  country: string;
  display: string;
}

interface Listing {
  id: string;
  name: string;
  airbnbUrl: string | null;
  homeExchangeUrl: string | null;
  title: string;
  location: string;
  imageUrl: string | null;
  destination: string;
  travelStart: string;
  travelEnd: string;
  destinationWishes?: DestinationWish[];
}

function formatDateRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  return `${fmt(s)} – ${fmt(e)}`;
}

function WishChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-sand-700 bg-sand-100 px-2 py-0.5 rounded-full whitespace-nowrap">
      <MapPin className="w-2.5 h-2.5 flex-shrink-0" />{label}
    </span>
  );
}

function ListingCard({ listing }: { listing: Listing }) {
  const hasBoth = listing.airbnbUrl && listing.homeExchangeUrl;
  const wishes = listing.destinationWishes && listing.destinationWishes.length > 0
    ? listing.destinationWishes
    : null;

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
        <div className="absolute top-3 left-3 flex gap-1.5">
          {listing.airbnbUrl && (
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-rose-50 text-rose-600">Airbnb</span>
          )}
          {listing.homeExchangeUrl && (
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-50 text-green-700">HomeExchange</span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col gap-3">
        <div>
          <p className="text-xs text-slate-400 font-medium mb-0.5">{listing.name}</p>
          <h3 className="font-semibold text-slate-900 text-sm leading-tight line-clamp-2">{listing.title}</h3>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          {listing.location}
        </div>

        {/* Destination wishlist */}
        <div className="bg-sand-50 rounded-xl p-2.5">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Wants to go to</p>
          <div className="flex flex-wrap gap-1">
            {wishes
              ? wishes.map(w => <WishChip key={w.id} label={w.display} />)
              : <WishChip label={listing.destination} />
            }
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Calendar className="w-3.5 h-3.5" />
          {formatDateRange(listing.travelStart, listing.travelEnd)}
        </div>

        {/* Profile links */}
        <div className={`flex gap-2 pt-1 border-t border-slate-50 ${hasBoth ? 'flex-row' : ''}`}>
          {listing.airbnbUrl && (
            <a href={listing.airbnbUrl} target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1 text-xs font-medium text-rose-500 hover:text-rose-600 transition-colors py-1 px-2 rounded-lg hover:bg-rose-50">
              <ExternalLink className="w-3 h-3" /> Airbnb
            </a>
          )}
          {listing.homeExchangeUrl && (
            <a href={listing.homeExchangeUrl} target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1 text-xs font-medium text-green-600 hover:text-green-700 transition-colors py-1 px-2 rounded-lg hover:bg-green-50">
              <ExternalLink className="w-3 h-3" /> HomeExchange
            </a>
          )}
        </div>
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
