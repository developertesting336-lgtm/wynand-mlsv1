import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight } from 'lucide-react';
import ListingCard from '../listings/ListingCard';

export default function FeaturedListings() {
  const { data: listings, isLoading } = useQuery({
    queryKey: ['featured-listings'],
    queryFn: () => base44.entities.Listing.filter({ status: 'approved' }, '-created_date', 6),
    initialData: [],
  });

  // Fetch all bookings that are approved or confirmed to hide those listings
  const { data: allBookings = [] } = useQuery({
    queryKey: ['all-active-bookings'],
    queryFn: async () => {
      const [approved, confirmed] = await Promise.all([
        base44.entities.Booking.filter({ status: 'approved' }, '-created_date', 500),
        base44.entities.Booking.filter({ status: 'confirmed' }, '-created_date', 500),
      ]);
      return [...approved, ...confirmed];
    },
  });

  const bookedListingIds = new Set(allBookings.map(b => b.listing_id));
  const availableListings = listings.filter(l => !bookedListingIds.has(l.id));

  const featured = availableListings.filter(l => l.is_featured);
  const display = featured.length >= 3 ? featured.slice(0, 6) : availableListings.slice(0, 6);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
      <div className="flex items-end justify-between mb-10">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Featured Rentals</h2>
          <p className="text-muted-foreground mt-2">Hand-picked verified properties</p>
        </div>
        <Link to="/listings">
          <Button variant="ghost" className="gap-2 hidden md:flex">
            View All <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl overflow-hidden">
              <Skeleton className="aspect-[4/3] w-full" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {display.map(listing => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}

      <div className="mt-8 text-center md:hidden">
        <Link to="/listings">
          <Button variant="outline" className="gap-2">View All Rentals <ArrowRight className="w-4 h-4" /></Button>
        </Link>
      </div>
    </section>
  );
}