import React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Bed, Bath, MapPin, Star, Heart, ArrowLeftRight, CheckCircle } from 'lucide-react';
import { NEIGHBORHOOD_LABELS } from '@/lib/constants';
import { useAuth } from '@/lib/AuthContext';
export default function ListingCard({ listing, favoriteIds, onToggleFavorite, compareIds, onToggleCompare, hasBookingRequest, refCode = '' }) {
  const { user } = useAuth();
  const isAgent = user?.role === 'agent';
  const photo = listing.photos?.[0] || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&q=80';
  const isFavorited = favoriteIds?.has(listing.id);
  const isComparing = compareIds?.has(listing.id);

  return (
    <Link to={`/listings/${listing.id}${refCode ? `?ref=${refCode}` : ''}`} className="group block">
      <div className="rounded-2xl overflow-hidden bg-card border border-border/40 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 active:scale-[0.98]">
        {/* Photo */}
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <img
            src={photo}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
          {/* Compare toggle */}
          {onToggleCompare && (
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleCompare(listing.id); }}
              className={`absolute bottom-2.5 right-2.5 z-10 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold transition-colors ${isComparing ? 'bg-primary text-primary-foreground' : 'bg-black/40 text-white backdrop-blur-sm hover:bg-black/60'}`}
              aria-label="Toggle compare"
            >
              <ArrowLeftRight className="w-3 h-3" />
              {isComparing ? 'Selected' : 'Compare'}
            </button>
          )}
          {/* Heart / favorite button – hidden for agents */}
          {onToggleFavorite && !isAgent && (
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(listing.id); }}
              className="absolute top-2.5 right-2.5 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors"
              aria-label={isFavorited ? 'Remove from favorites' : 'Save to favorites'}
            >
              <Heart className={`w-4 h-4 transition-colors ${isFavorited ? 'fill-rose-500 text-rose-500' : 'text-white'}`} />
            </button>
          )}
          {/* Top badges */}
          <div className="absolute top-2.5 left-2.5 flex gap-1.5">
            {hasBookingRequest && (
              <Badge className="bg-blue-500 text-white gap-1 text-xs shadow px-2 py-1">
                <CheckCircle className="w-3 h-3" /> Request Sent
              </Badge>
            )}
            {listing.is_verified && (
              <Badge className="bg-accent text-accent-foreground gap-1 text-xs shadow px-2 py-1">
                <ShieldCheck className="w-3 h-3" /> Verified
              </Badge>
            )}
            {listing.is_featured && (
              <Badge className="bg-yellow-400 text-yellow-900 gap-1 text-xs shadow px-2 py-1">
                <Star className="w-3 h-3" /> Featured
              </Badge>
            )}
          </div>
          {/* Price pill */}
          <div className="absolute bottom-2.5 right-2.5">
            <span className="bg-black/70 text-white text-sm font-bold px-3 py-1.5 rounded-full backdrop-blur-sm">
              ${listing.price_usd?.toLocaleString()}<span className="font-normal text-white/80">/mo</span>
            </span>
          </div>
          {/* Pet icon */}
          {listing.pet_friendly && (
            <div className="absolute bottom-2.5 left-2.5 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
              🐾
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4">
          <h3 className="font-semibold text-base leading-snug line-clamp-1 group-hover:text-primary transition-colors">
            {listing.title}
          </h3>
          <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{NEIGHBORHOOD_LABELS[listing.neighborhood] || listing.neighborhood}</span>
          </div>
          <div className="flex items-center gap-3 mt-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Bed className="w-4 h-4" />
              <strong className="text-foreground">{listing.bedrooms}</strong> bd
            </span>
            <span className="flex items-center gap-1">
              <Bath className="w-4 h-4" />
              <strong className="text-foreground">{listing.bathrooms}</strong> ba
            </span>
            {listing.furnished === 'furnished' && (
              <span className="text-xs bg-muted px-2 py-0.5 rounded-full">Furnished</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}