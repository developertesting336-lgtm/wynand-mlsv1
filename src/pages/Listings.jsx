import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/lib/supabase';
import { useFavorites } from '@/hooks/useFavorites';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Search, LayoutGrid, Map } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import SortBar from '../components/listings/SortBar';
import ListingCard from '../components/listings/ListingCard';
import FilterSidebar from '../components/listings/FilterSidebar';
import ListingsMap from '../components/listings/ListingsMap';
import CompareBar from '../components/listings/CompareBar';
import CompareDrawer from '../components/listings/CompareDrawer';

export default function Listings() {
  const location = useLocation();
  const urlParams = new URLSearchParams(location.search);
  const [user, setUser] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'map'

  // Referral code: URL takes priority, fallback to sessionStorage
  const urlRefCode = urlParams.get('ref') || '';
  useEffect(() => {
    if (urlRefCode) {
      sessionStorage.setItem('referral_code', urlRefCode);
    }
  }, [urlRefCode]);
  const refCode = urlRefCode || sessionStorage.getItem('referral_code') || '';

  useEffect(() => { base44.auth.me().then(setUser).catch(() => { }); }, []);

  const { favoriteIds, toggle } = useFavorites(user?.id);
  const [filters, setFilters] = useState({
    neighborhood: urlParams.get('neighborhood') ? urlParams.get('neighborhood').toLowerCase().replace(/\s+/g, '_') : undefined,
    maxPrice: urlParams.get('maxPrice') ? Number(urlParams.get('maxPrice')) : undefined,
  });

  // Sync filters with URL parameters when navigating via React Router
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const neighborhood = params.get('neighborhood') 
      ? params.get('neighborhood').toLowerCase().replace(/\s+/g, '_')
      : undefined;
    const maxPrice = params.get('maxPrice') ? Number(params.get('maxPrice')) : undefined;
    
    setFilters(prev => {
      if (prev.neighborhood !== neighborhood || prev.maxPrice !== maxPrice) {
        return { neighborhood, maxPrice };
      }
      return prev;
    });
  }, [location.search]);
  const [sortBy, setSortBy] = useState('newest');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 6;
  const [compareIds, setCompareIds] = useState(new Set());
  const [showCompare, setShowCompare] = useState(false);

  // Reset page to 1 whenever filters or search parameters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, search, sortBy]);

  const MAX_COMPARE = 4;

  const toggleCompare = (id) => {
    setCompareIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); }
      else if (next.size < MAX_COMPARE) { next.add(id); }
      return next;
    });
  };

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ['listings'],
    queryFn: () => base44.entities.Listing.filter({ status: 'approved' }, '-created_date', 100),
  });

  const { data: userBookings = [] } = useQuery({
    queryKey: ['user-bookings', user?.email],
    queryFn: () => user?.email ? base44.entities.Booking.filter({ renter_email: user.email }, '-created_date', 100) : Promise.resolve([]),
    enabled: !!user?.email,
  });

  const { data: bookedListingIdsData = [] } = useQuery({
    queryKey: ['booked-listing-ids'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('listing_id, end_lease')
        .in('status', ['approved', 'confirmed', 'lease_pending'])
        .not('listing_id', 'is', null);

      if (error) throw error;
      const activeBookings = (data || []).filter(item => item.end_lease !== true);
      return Array.from(new Set(activeBookings.map(item => item.listing_id)));
    },
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const { data: activeSubscriptions = [] } = useQuery({
    queryKey: ['active-subscriptions-featured'],
    queryFn: () => base44.entities.Subscription.filter({ status: 'active' }, '-created_date', 100),
  });

  const bookedListingIds = useMemo(() => new Set(bookedListingIdsData), [bookedListingIdsData]);
  const subscriptionFeaturedIds = useMemo(() => {
    const ids = new Set();
    for (const sub of activeSubscriptions) {
      if (Array.isArray(sub.featured_listing_ids)) {
        sub.featured_listing_ids.forEach(id => ids.add(id));
      }
    }
    return ids;
  }, [activeSubscriptions]);
  const userBookedListingIds = useMemo(() => new Set(userBookings.map(b => b.listing_id)), [userBookings]);

  const filtered = useMemo(() => {
    let result = listings.filter(l => !bookedListingIds.has(l.id));

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        l.title?.toLowerCase().includes(q) ||
        l.neighborhood?.toLowerCase().includes(q) ||
        l.description?.toLowerCase().includes(q) ||
        l.address?.toLowerCase().includes(q)
      );
    }

    if (filters.neighborhood) result = result.filter(l => l.neighborhood === filters.neighborhood);
    if (filters.minPrice) result = result.filter(l => l.price_usd >= filters.minPrice);
    if (filters.maxPrice) result = result.filter(l => l.price_usd <= filters.maxPrice);
    if (filters.bedrooms) result = result.filter(l => l.bedrooms >= filters.bedrooms);
    if (filters.bathrooms) result = result.filter(l => l.bathrooms >= filters.bathrooms);
    if (filters.furnished) result = result.filter(l => l.furnished === filters.furnished);
    if (filters.rentalType) result = result.filter(l => l.rental_type === filters.rentalType || l.rental_type === 'both');
    if (filters.petFriendly) result = result.filter(l => l.pet_friendly);

    const isFeatured = (item) => item.is_featured || subscriptionFeaturedIds.has(item.id);

    if (sortBy === 'price_asc') {
      result.sort((a, b) => {
        const aFeat = isFeatured(a);
        const bFeat = isFeatured(b);
        if (aFeat && !bFeat) return -1;
        if (!aFeat && bFeat) return 1;
        return (a.price_usd || 0) - (b.price_usd || 0);
      });
    }
    else if (sortBy === 'price_desc') {
      result.sort((a, b) => {
        const aFeat = isFeatured(a);
        const bFeat = isFeatured(b);
        if (aFeat && !bFeat) return -1;
        if (!aFeat && bFeat) return 1;
        return (b.price_usd || 0) - (a.price_usd || 0);
      });
    }
    else if (sortBy === 'verified') {
      result.sort((a, b) => {
        const aFeat = isFeatured(a);
        const bFeat = isFeatured(b);
        if (aFeat && !bFeat) return -1;
        if (!aFeat && bFeat) return 1;

        if (a.is_verified && !b.is_verified) return -1;
        if (!a.is_verified && b.is_verified) return 1;
        return new Date(b.last_verified_date || 0) - new Date(a.last_verified_date || 0);
      });
    }
    // Default sort: newest
    else {
      result.sort((a, b) => {
        const aFeat = isFeatured(a);
        const bFeat = isFeatured(b);
        if (aFeat && !bFeat) return -1;
        if (!aFeat && bFeat) return 1;
        return new Date(b.created_date || 0) - new Date(a.created_date || 0);
      });
    }

    return result;
  }, [listings, filters, sortBy, search, subscriptionFeaturedIds]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginatedListings = useMemo(() => {
    return filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  }, [filtered, currentPage]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Browse Rentals</h1>
        {/* <p className="text-muted-foreground mt-0.5 text-sm flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5" /> Puerto Vallarta, Mexico
        </p> */}
      </div>

      {/* Sticky search + filter bar */}
      <div className="sticky top-16 z-30 bg-background/95 backdrop-blur-sm py-3 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 border-b mb-6">
        <div className="space-y-3">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by name, neighborhood, or keyword..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-11 text-base bg-card"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter row + view toggle */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <SortBar
                filters={filters}
                setFilters={setFilters}
                sortBy={sortBy}
                setSortBy={setSortBy}
                count={filtered.length}
                isLoading={isLoading}
              />
            </div>
            <div className="flex items-center border rounded-xl overflow-hidden shrink-0">
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'}`}
              >
                <LayoutGrid className="w-4 h-4" /> <span className="hidden sm:inline">List</span>
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${viewMode === 'map' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'}`}
              >
                <Map className="w-4 h-4" /> <span className="hidden sm:inline">Map</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Results + Sidebar */}
      <div className="flex gap-6 items-start">
        {viewMode === 'grid' && <FilterSidebar filters={filters} setFilters={setFilters} />}

        <div className="flex-1 min-w-0">
          {viewMode === 'map' ? (
            <ListingsMap listings={filtered} />
          ) : isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="rounded-xl overflow-hidden">
                  <Skeleton className="aspect-[4/3] w-full" />
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">🏠</div>
              <p className="text-xl font-semibold">No rentals found</p>
              <p className="text-muted-foreground mt-2 text-sm">Try adjusting your filters or search term</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {paginatedListings.map(listing => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    favoriteIds={favoriteIds}
                    onToggleFavorite={user ? (id) => toggle.mutate(id) : undefined}
                    compareIds={compareIds}
                    onToggleCompare={toggleCompare}
                    hasBookingRequest={userBookedListingIds.has(listing.id)}
                    refCode={refCode}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border pt-6 mt-4">
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Showing <span className="font-semibold text-foreground">{((currentPage - 1) * PAGE_SIZE) + 1}</span> to{' '}
                    <span className="font-semibold text-foreground">
                      {Math.min(currentPage * PAGE_SIZE, filtered.length)}
                    </span>{' '}
                    of <span className="font-semibold text-foreground">{filtered.length}</span> properties
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="text-xs h-9"
                    >
                      Previous
                    </Button>
                    <div className="hidden sm:flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <Button
                          key={page}
                          variant={currentPage === page ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className="text-xs h-9 w-9 p-0"
                        >
                          {page}
                        </Button>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="text-xs h-9"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {compareIds.size > 0 && (
        <CompareBar
          count={compareIds.size}
          max={MAX_COMPARE}
          onCompare={() => setShowCompare(true)}
          onClear={() => setCompareIds(new Set())}
        />
      )}

      {showCompare && (
        <CompareDrawer
          listings={listings.filter(l => compareIds.has(l.id))}
          onRemove={(id) => {
            setCompareIds(prev => { const n = new Set(prev); n.delete(id); return n; });
            if (compareIds.size <= 1) setShowCompare(false);
          }}
          onClose={() => setShowCompare(false)}
        />
      )}
    </div>
  );
}