
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronLeft, ChevronRight, Lock, Unlock, Calendar, Loader2,
  CheckCircle, XCircle, Hourglass, Building2
} from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isBefore, startOfDay, addMonths, subMonths, isToday,
} from 'date-fns';
import { toast } from 'sonner';

const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function AvailabilityManager({ listings }) {
  const queryClient = useQueryClient();
  const [selectedListingId, setSelectedListingId] = useState(listings[0]?.id || null);
  const [month, setMonth] = useState(new Date());
  const [selecting, setSelecting] = useState(false); // drag-select mode
  const [dragDates, setDragDates] = useState(new Set());

  const listing = listings.find(l => l.id === selectedListingId);
  const today = startOfDay(new Date());

  // Also fetch actual booking requests from the bookings table
  const { data: listingBookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['owner-availability-bookings', selectedListingId],
    queryFn: () => base44.entities.Booking.filter({ listing_id: selectedListingId }, '-created_date', 200),
    enabled: !!selectedListingId,
  });

  const { data: renterProfiles = [] } = useQuery({
    queryKey: ['renter-profiles-availability', listingBookings.map(b => b.renter_id).filter(Boolean)],
    queryFn: async () => {
      if (listingBookings.length === 0) return [];
      const renterIds = listingBookings.map(b => b.renter_id).filter(Boolean);
      const { data } = await supabase
        .from('profiles')
        .select('id, email, full_name, phone_number')
        .in('id', renterIds);
      return data || [];
    },
    enabled: listingBookings.length > 0,
  });

  const renterProfileMap = Object.fromEntries(renterProfiles.map(p => [p.id, p]));

  const isLoading = bookingsLoading;

  const blockedSet = new Set(listing?.blocked_dates || []);

  // Build a set of dates that have approved/confirmed bookings (occupied)
  const occupiedDates = new Set();
  listingBookings
    .filter(b => b.status === 'approved' || b.status === 'confirmed')
    .forEach(b => {
      if (b.move_in_date) {
        occupiedDates.add(b.move_in_date);
      }
    });

  // Pending requests: from bookings (status=pending)
  const pendingRequests = listingBookings.filter(b => b.status === 'pending').map(b => ({
    id: b.id,
    date: b.move_in_date,
    type: 'booking',
    requester_name: renterProfileMap[b.renter_id]?.full_name || 'Renter',
    note: b.message,
    listing_title: b.listing_title || listing?.title,
    renter_email: renterProfileMap[b.renter_id]?.email || '',
    renter_phone: renterProfileMap[b.renter_id]?.phone_number || '',
    lease_duration_months: b.lease_duration_months,
  }));

  const blockMutation = useMutation({
    mutationFn: async (datesToBlock) => {
      const currentBlocked = listing.blocked_dates || [];
      const updatedBlocked = Array.from(new Set([...currentBlocked, ...datesToBlock]));
      const { error } = await supabase
        .from('listings')
        .update({ blocked_dates: updatedBlocked })
        .eq('id', selectedListingId);
      if (error) throw error;
    },
    onSuccess: (_, dates) => {
      queryClient.invalidateQueries({ queryKey: ['owner-listings'] });
      queryClient.invalidateQueries({ queryKey: ['listings'] });
      toast.success(`${dates.length} date${dates.length > 1 ? 's' : ''} blocked`);
    },
  });

  const unblockMutation = useMutation({
    mutationFn: async (datesToUnblock) => {
      const currentBlocked = listing.blocked_dates || [];
      const updatedBlocked = currentBlocked.filter(d => !datesToUnblock.includes(d));
      const { error } = await supabase
        .from('listings')
        .update({ blocked_dates: updatedBlocked })
        .eq('id', selectedListingId);
      if (error) throw error;
    },
    onSuccess: (_, dates) => {
      queryClient.invalidateQueries({ queryKey: ['owner-listings'] });
      queryClient.invalidateQueries({ queryKey: ['listings'] });
      toast.success(`${dates.length} date${dates.length > 1 ? 's' : ''} unblocked`);
    },
  });

  const updateRequestMutation = useMutation({
    mutationFn: ({ id, type, status }) => {
      return base44.entities.Booking.update(id, { status });
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['owner-availability-bookings', selectedListingId] });
      queryClient.invalidateQueries({ queryKey: ['owner-bookings'] });
      toast.success(status === 'approved' ? 'Request approved' : 'Request declined');
    },
  });

  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const startDow = startOfMonth(month).getDay();

  const toggleDate = (day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    if (isBefore(day, today)) return;
    if (blockedSet.has(dateStr)) {
      unblockMutation.mutate([dateStr]);
    } else {
      blockMutation.mutate([dateStr]);
    }
  };

  const blockAll = () => {
    const toBlock = days
      .filter(d => !isBefore(d, today) && !blockedSet.has(format(d, 'yyyy-MM-dd')))
      .map(d => format(d, 'yyyy-MM-dd'));
    if (toBlock.length) blockMutation.mutate(toBlock);
  };

  const unblockAll = () => {
    const toUnblock = days
      .filter(d => blockedSet.has(format(d, 'yyyy-MM-dd')))
      .map(d => format(d, 'yyyy-MM-dd'));
    if (toUnblock.length) unblockMutation.mutate(toUnblock);
  };

  const getDayStyle = (day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const past = isBefore(day, today);
    const blocked = blockedSet.has(dateStr);
    const isOccupied = occupiedDates.has(dateStr);
    const hasBookingPending = listingBookings.some(b => b.status === 'pending' && b.move_in_date === dateStr);

    if (past) return 'text-muted-foreground/30 cursor-default';
    if (isOccupied) return 'bg-green-100 text-green-700 rounded-lg font-medium cursor-default';
    if (blocked) return 'bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 cursor-pointer';
    if (hasBookingPending) return 'bg-amber-100 text-amber-700 rounded-lg font-medium cursor-pointer';
    return 'hover:bg-primary/10 rounded-lg cursor-pointer text-foreground';
  };

  if (!listing) {
    return (
      <div className="text-center py-16">
        <Building2 className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground">No properties to manage yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Property selector dropdown */}
      {listings.length > 1 && (
        <div className="max-w-sm">
          <Select value={selectedListingId} onValueChange={setSelectedListingId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a property..." />
            </SelectTrigger>
            <SelectContent>
              {listings.map(l => (
                <SelectItem key={l.id} value={l.id} className="truncate">
                  {l.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Calendar */}
        <div className="lg:col-span-3 rounded-2xl border bg-card shadow-sm overflow-hidden">
          {/* Calendar header */}
          <div className="flex items-center justify-between px-5 py-4 border-b gap-3 flex-wrap">
            <div>
              <h3 className="font-semibold">{listing.title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Click any date to block or unblock it
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={blockAll} disabled={blockMutation.isPending}>
                <Lock className="w-3 h-3" /> Block month
              </Button>
              <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={unblockAll} disabled={unblockMutation.isPending}>
                <Unlock className="w-3 h-3" /> Unblock month
              </Button>
            </div>
          </div>

          {/* Month nav */}
          <div className="flex items-center justify-between px-5 py-3 border-b">
            <button onClick={() => setMonth(m => subMonths(m, 1))} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold">{format(month, 'MMMM yyyy')}</span>
            <button onClick={() => setMonth(m => addMonths(m, 1))} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Grid */}
          <div className="p-4">
            <div className="grid grid-cols-7 mb-1">
              {DOW.map(d => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
              ))}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-y-1">
                {Array.from({ length: startDow }).map((_, i) => <div key={`e-${i}`} />)}
                {days.map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  return (
                    <button
                      key={dateStr}
                      onClick={() => toggleDate(day)}
                      title={blockedSet.has(dateStr) ? 'Click to unblock' : 'Click to block'}
                      className={`aspect-square flex items-center justify-center text-sm transition-all mx-0.5 relative ${getDayStyle(day)} ${isToday(day) ? 'ring-1 ring-primary/50' : ''}`}
                    >
                      {format(day, 'd')}
                      {blockedSet.has(dateStr) && (
                        <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-red-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-5 pb-4 text-xs text-muted-foreground border-t pt-3">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 border border-red-300 inline-block" /> Blocked (unavailable)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-300 inline-block" /> Pending request</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-100 border border-green-300 inline-block" /> Approved</span>
          </div>
        </div>

        {/* Right panel: summary */}
        <div className="space-y-3 lg:col-span-1">
          {/* Blocked count summary */}
          <div className="rounded-2xl border bg-muted/40 px-4 py-3">
            <p className="text-xs text-muted-foreground">Blocked dates this month</p>
            <p className="text-2xl font-bold mt-0.5">
              {days.filter(d => blockedSet.has(format(d, 'yyyy-MM-dd'))).length}
              <span className="text-sm font-normal text-muted-foreground"> / {days.length}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}