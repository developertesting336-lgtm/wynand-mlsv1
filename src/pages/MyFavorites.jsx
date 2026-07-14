import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useFavorites } from '@/hooks/useFavorites';
import { Heart, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import ListingCard from '@/components/listings/ListingCard';

export default function MyFavorites() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { favorites, favoriteIds, toggle } = useFavorites(user?.id);

  const { data: allListings = [], isLoading } = useQuery({
    queryKey: ['approved-listings'],
    queryFn: () => base44.entities.Listing.filter({ status: 'approved' }, '-created_date', 200),
    enabled: !!user,
  });

  const savedListings = allListings.filter(l => favoriteIds.has(l.id));

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <Heart className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Sign in to view your favorites</h2>
        <Button onClick={() => base44.auth.redirectToLogin()}>Sign In</Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Heart className="w-6 h-6 text-rose-500 fill-rose-500" />
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">My Favorites</h1>
        {savedListings.length > 0 && (
          <span className="ml-1 text-sm bg-rose-100 text-rose-700 px-2.5 py-0.5 rounded-full font-semibold">
            {savedListings.length}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-72 rounded-2xl" />)}
        </div>
      ) : savedListings.length === 0 ? (
        <div className="text-center py-20">
          <Heart className="w-14 h-14 mx-auto text-muted-foreground/30 mb-4" />
          <h2 className="text-xl font-semibold">No saved properties yet</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Tap the heart icon on any listing to save it here.
          </p>
          <Link to="/listings">
            <Button className="mt-6 gap-2"><Search className="w-4 h-4" /> Browse Listings</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {savedListings.map(listing => (
            <ListingCard
              key={listing.id}
              listing={listing}
              userEmail={user.email}
              favoriteIds={favoriteIds}
              onToggleFavorite={(id) => toggle.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}