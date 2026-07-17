import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { isSubscriptionActive } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft, ChevronRight, Lock, Calendar, Send, CheckCircle, X, Loader2, AlertCircle
} from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isSameDay, isToday, isBefore, startOfDay,
  addMonths, subMonths
} from 'date-fns';
import { toast } from 'sonner';

const VITE_EMAIL_SERVER_URL = import.meta.env.VITE_EMAIL_SERVER_URL || 'http://localhost:3001';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function AvailabilityCalendar({ listing, currentUser, refCode = '' }) {
  const queryClient = useQueryClient();
  const isOwner = currentUser?.email && currentUser.email === listing.owner_email;

  const [month, setMonth] = useState(new Date());
  const [selectedDates, setSelectedDates] = useState(new Set());
  const [requestForm, setRequestForm] = useState({ name: '', email: '', note: '', budget: '', dates: [] });
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [tenantVerification, setTenantVerification] = useState({});
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  // Pre-fill form with logged-in user
  useEffect(() => {
    if (currentUser) {
      setRequestForm(prev => ({
        ...prev,
        name: currentUser.full_name || '',
        email: currentUser.email || '',
      }));
    }
  }, [currentUser?.email]);

  const { data: bookingDates = [], isLoading } = useQuery({
    queryKey: ['booking-dates', listing.id],
    queryFn: () => base44.entities.BookingDate.filter({ listing_id: listing.id }, 'date', 200),
  });

  const { data: subscription = null } = useQuery({
    queryKey: ['subscription', currentUser?.id],
    queryFn: () =>
      currentUser?.id
        ? base44.entities.Subscription.filter({ user_id: currentUser.id }).then(data => data[0] || null)
        : Promise.resolve(null),
    enabled: !!currentUser?.id,
  });

  const { data: existingBookings = [] } = useQuery({
    queryKey: ['renter-existing-bookings-on-listing', currentUser?.id, listing.id],
    queryFn: async () => {
      if (!currentUser?.id || !listing.id) return [];
      const { data, error } = await supabase
        .from('bookings')
        .select('id, status, end_lease')
        .eq('renter_id', currentUser.id)
        .eq('listing_id', listing.id)
        .in('status', ['pending', 'approved', 'confirmed', 'lease_pending']);
      if (error) throw error;
      return (data || []).filter(b => b.end_lease !== true);
    },
    enabled: !!currentUser?.id && !!listing.id,
  });

  const hasAlreadyRequested = existingBookings.length > 0;

  const hasActiveSubscription = currentUser?.role === 'renter' ? isSubscriptionActive(subscription) : true;

  // Build lookup maps
  const blockedSet = new Set(listing.blocked_dates || []);
  const requestMap = {};
  bookingDates.filter(d => d.type === 'request').forEach(d => {
    requestMap[d.date] = d;
  });

  // Owner: toggle blocked dates
  const toggleBlockMutation = useMutation({
    mutationFn: async (dateStr) => {
      const currentBlocked = listing.blocked_dates || [];
      let updatedBlocked;
      if (blockedSet.has(dateStr)) {
        updatedBlocked = currentBlocked.filter(d => d !== dateStr);
      } else {
        updatedBlocked = Array.from(new Set([...currentBlocked, dateStr]));
      }
      const { error } = await supabase
        .from('listings')
        .update({ blocked_dates: updatedBlocked })
        .eq('id', listing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listing', listing.id] });
      queryClient.invalidateQueries({ queryKey: ['owner-listings'] });
      queryClient.invalidateQueries({ queryKey: ['listings'] });
    },
  });

  // Fetch tenant verification on mount / when currentUser changes
  useEffect(() => {
    if (!currentUser?.id) {
      setVerificationLoading(false);
      return;
    }
    const fetchVerification = async () => {
      setVerificationLoading(true);
      const { data: rows, error } = await supabase
        .from('verifications')
        .select('*');
      if (error) {
        console.error('Failed to fetch verifications:', error);
        setVerificationLoading(false);
        return;
      }
      const verif = rows?.find(r => r.user_id === currentUser.id) || {};
      console.log('Fetched tenant verification:', verif);
      setTenantVerification(verif);
      setVerificationLoading(false);
    };
    fetchVerification();
  }, [currentUser?.id]);

  // Debug: fetch all tenant verification rows on mount (optional)
  useEffect(() => {
    const fetchAll = async () => {
      const { data: allData, error: allError } = await supabase.from('verifications').select('*');
      console.log('All verifications rows (debug):', allData, allError);
    };
    fetchAll();
  }, []);

  // Owner: update request status
  const updateRequestMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.BookingDate.update(id, { status }),
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['booking-dates', listing.id] });
      toast.success(status === 'approved' ? 'Request approved' : 'Request declined');
    },
  });

  // Tenant: submit booking request
  const submitRequestMutation = useMutation({
    mutationFn: async (form) => {
      if (currentUser?.role === 'renter') {
        if (!hasActiveSubscription) {
          throw new Error('An active subscription is required to request booking dates.');
        }
        if (tenantVerification.id_verification !== 'approved' || tenantVerification.employment_verification !== 'approved') {
          throw new Error('Complete identity verification and employment verification before booking.');
        }
      }
      console.log('SubmitRequestMutation called with', form);
      const { name, email, note, budget, dates } = form;
      const sortedDates = dates ? [...dates].sort() : [];
      const moveInDate = sortedDates[0];
      // Resolve owner ID via owner_email
      let ownerEmail = listing.owner_email;
      if (!ownerEmail) {
        const { data: listingData } = await supabase
          .from('listings')
          .select('owner_email')
          .eq('id', listing.id)
          .single();
        ownerEmail = listingData?.owner_email;
      }
      let ownerId = null;
      if (ownerEmail) {
        const { data: ownerProfile, error: ownerErr } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', ownerEmail)
          .maybeSingle();
        if (ownerErr) {
          console.error('Error fetching owner profile:', ownerErr);
        } else if (ownerProfile) {
          ownerId = ownerProfile.id;
        }
      }
      console.log('Resolved ownerId:', ownerId);
      console.log('Submitting booking request for dates', dates);

      let agentEmail = listing.agent_email;
      if (!agentEmail) {
        const { data: listingData, error: listingError } = await supabase
          .from('listings')
          .select('agent_email')
          .eq('id', listing.id)
          .maybeSingle();
        if (listingError) {
          console.error('Error fetching listing agent email:', listingError);
        } else {
          agentEmail = listingData?.agent_email;
        }
      }

      let agentId = null;
      if (agentEmail) {
        const { data: agentProfile, error: agentErr } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', agentEmail)
          .maybeSingle();
        if (agentErr) {
          console.error('Error fetching agent profile:', agentErr);
        } else if (agentProfile) {
          agentId = agentProfile.id;
        }
      }

      if (currentUser?.id && ownerId) {
        const { error: bookingError } = await supabase
          .from('bookings')
          .insert({
            listing_id: listing.id,
            renter_id: currentUser.id,
            owner_id: ownerId,
            agent_id: agentId,
            referral_code: refCode || null,
            move_in_date: moveInDate,
            lease_duration_months: 12,
            monthly_budget_mxn: budget ? Number(budget) : null,
            message:
              note ||
              `Booking request for ${sortedDates.length} date(s) starting ${format(
                new Date(moveInDate + 'T00:00:00'),
                'MMMM d, yyyy'
              )}`,
            status: 'pending',
          });

        if (bookingError) throw bookingError;
      } else {
        console.error('Missing renter or owner ID', { renterId: currentUser?.id, ownerId });
        throw new Error('Missing renter or owner ID');
      }

      /*
      const promises = dates.map(dateStr =>
        base44.entities.BookingDate.create({
          listing_id: listing.id,
          date: dateStr,
          type: 'request',
          requester_name: name,
          requester_email: email,
          note: note,
          status: 'pending',
          listing_owner_email: listing.owner_email,
        })
      );
      await Promise.all(promises);
      */

      if (listing.owner_email) {
        await fetch(`${VITE_EMAIL_SERVER_URL}/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: listing.owner_email,
            subject: `New booking request for "${listing.title}"`,
            body: `
<p>Hi ${listing.owner_name || 'there'},</p>
<p><strong>${name}</strong> has requested the following dates for <strong>${listing.title}</strong>:</p>
<ul>${sortedDates.map(d => `<li>${format(new Date(d + 'T00:00:00'), 'MMMM d, yyyy')}</li>`).join('')}</ul>
${note ? `<p>Note: ${note}</p>` : ''}
<p>Reply to: <a href="mailto:${email}">${email}</a></p>
<p style="color:#888;font-size:12px">PV Verified Rentals · Puerto Vallarta</p>
            `.trim(),
            fromEmail: 'noreply@pvverified.com',
            fromName: 'PV Verified Rentals',
          }),
        }).catch(() => { });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-dates', listing.id] });
      queryClient.invalidateQueries({ queryKey: ['owner-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['user-bookings'] });
      setSelectedDates(new Set());
      setShowRequestForm(false);
      setRequestSent(true);
    },
    onError: (error) => {
      console.error('Mutation onError:', error);
    },
  });

  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const startDow = startOfMonth(month).getDay();
  const today = startOfDay(new Date());

  const handleDayClick = (day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    if (isBefore(day, today)) return;

    if (!isOwner && currentUser?.role === 'renter') {
      if (hasAlreadyRequested) {
        toast.error('You already have an active booking request for this property.');
        return;
      }
      if (!hasActiveSubscription) {
        toast.error('An active subscription is required to request booking dates. Please subscribe first.');
        return;
      }
      if (tenantVerification.id_verification !== 'approved' || tenantVerification.employment_verification !== 'approved') {
        toast.error('Complete identity verification and employment verification before booking.');
        return;
      }
    }

    if (isOwner) {
      toggleBlockMutation.mutate(dateStr);
    } else {
      if (blockedSet.has(dateStr)) return;
      setSelectedDates(prev => {
        const next = new Set(prev);
        if (next.has(dateStr)) next.delete(dateStr);
        else next.add(dateStr);
        return next;
      });
    }
  };

  const getDayStyle = (day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const past = isBefore(day, today);
    const blocked = blockedSet.has(dateStr);
    const request = requestMap[dateStr];
    const selected = selectedDates.has(dateStr);

    if (past) return 'text-muted-foreground/40 cursor-default bg-transparent';
    if (blocked) {
      return isOwner
        ? 'bg-red-100 text-red-700 cursor-pointer hover:bg-red-200 rounded-lg font-medium'
        : 'bg-red-50/50 text-red-300 cursor-not-allowed rounded-lg';
    }
    if (selected) return 'bg-primary text-primary-foreground rounded-lg font-semibold ring-2 ring-primary ring-offset-1';
    if (request?.status === 'approved') return 'bg-green-100 text-green-700 rounded-lg font-medium cursor-default';
    if (request?.status === 'pending') return 'bg-amber-100 text-amber-700 rounded-lg font-medium cursor-pointer hover:bg-amber-200';
    return 'hover:bg-muted rounded-lg cursor-pointer';
  };

  const pendingRequests = bookingDates.filter(d => d.type === 'request' && d.status === 'pending');

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Availability Calendar
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMonth(m => subMonths(m, 1))}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium w-32 text-center">
              {format(month, 'MMMM yyyy')}
            </span>
            <button
              onClick={() => setMonth(m => addMonths(m, 1))}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="grid grid-cols-7 mb-1">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-y-1">
              {Array.from({ length: startDow }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {days.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const isT = isToday(day);
                return (
                  <button
                    key={dateStr}
                    onClick={() => handleDayClick(day)}
                    className={classNames(
                      'aspect-square flex items-center justify-center text-sm transition-all mx-0.5',
                      getDayStyle(day),
                      isT ? 'ring-1 ring-primary/50' : ''
                    )}
                    title={
                      blockedSet.has(dateStr)
                        ? isOwner ? 'Click to unblock' : 'Not available'
                        : isOwner ? 'Click to block' : 'Click to select'
                    }
                  >
                    {format(day, 'd')}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {currentUser?.role === 'renter' && !hasActiveSubscription && (
          <div className="px-5 pb-4">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
              An active subscription is required to request bookings. Please subscribe to continue.
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-5 pb-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 border border-red-200 inline-block" /> Blocked</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-200 inline-block" /> Pending request</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-100 border border-green-200 inline-block" /> Approved</span>
          {!isOwner && <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-primary inline-block" /> Your selection</span>}
        </div>

        {isOwner && (
          <div className="flex items-center gap-2 px-5 pb-4 text-xs text-muted-foreground">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            Click any future date to block or unblock it
          </div>
        )}
      </div>

      {!isOwner && (
        <>
          {hasAlreadyRequested && currentUser?.role === 'renter' ? (
            <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5 text-center shadow-sm">
              <AlertCircle className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="font-semibold text-blue-950 text-sm">Active Booking Request Found</p>
              <p className="text-xs text-blue-800 mt-1 max-w-xs mx-auto">
                You have already submitted an active booking request for this property. Please check your Dashboard to view details, sign lease, or process payments.
              </p>
            </div>
          ) : requestSent ? (
            <div className="rounded-2xl border bg-card p-6 text-center">
              <CheckCircle className="w-10 h-10 text-primary mx-auto mb-2" />
              <p className="font-semibold">Booking request sent!</p>
              <p className="text-sm text-muted-foreground mt-1">The owner will review and confirm shortly.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => { setRequestSent(false); setSelectedDates(new Set()); }}>
                Request more dates
              </Button>
            </div>
          ) : selectedDates.size > 0 && (
            <div className="rounded-2xl border bg-card shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">
                  {selectedDates.size} date{selectedDates.size > 1 ? 's' : ''} selected
                </p>
                <button onClick={() => setSelectedDates(new Set())} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[...selectedDates].sort().map(d => (
                  <Badge key={d} variant="secondary" className="text-xs gap-1">
                    {format(new Date(d + 'T00:00:00'), 'MMM d')}
                    <button onClick={() => setSelectedDates(prev => { const n = new Set(prev); n.delete(d); return n; })}>
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>

              {showRequestForm ? (
                <form
                  onSubmit={(e) => {
                    console.log('Form submitted');
                    e.preventDefault();
                    e.preventDefault();
                    if (verificationLoading) return;
                    if (currentUser?.role === 'renter' && !hasActiveSubscription) {
                      toast.error('An active subscription is required to request booking dates. Please subscribe first.');
                      return;
                    }
                    if (tenantVerification.id_verification !== 'approved' || tenantVerification.employment_verification !== 'approved') {
                      toast.error('Complete Identity Verification and Employment verification before booking');
                      return;
                    }
                    const dates = [...selectedDates].sort();
                    submitRequestMutation.mutate({ ...requestForm, dates });
                  }}
                  className="space-y-3 pt-1"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Name *</Label>
                      <Input required value={requestForm.name} onChange={e => setRequestForm(p => ({ ...p, name: e.target.value }))} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Email *</Label>
                      <Input required type="email" value={requestForm.email} onChange={e => setRequestForm(p => ({ ...p, email: e.target.value }))} className="mt-1" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Monthly Budget (MXN) *</Label>
                    <Input required type="number" value={requestForm.budget} onChange={e => setRequestForm(p => ({ ...p, budget: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Note (optional)</Label>
                    <Textarea value={requestForm.note} onChange={e => setRequestForm(p => ({ ...p, note: e.target.value }))} rows={2} placeholder="Move-in date, duration, questions..." className="mt-1" />
                  </div>
                  <Button
                    type="submit"
                    className="w-full gap-2"
                    disabled={submitRequestMutation.isPending || verificationLoading}
                    onClick={() => {
                      console.log('Submit button clicked');
                    }}
                  >
                    {submitRequestMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Send Booking Request
                  </Button>
                </form>
              ) : (
                <Button className="w-full gap-2" onClick={() => {
                  console.log('Opening request form');
                  setRequestForm(p => ({ ...p, dates: [...selectedDates].sort() }));
                  setShowRequestForm(true);
                }}>
                  <Calendar className="w-4 h-4" /> Request These Dates
                </Button>
              )}
            </div>
          )}
        </>
      )}

      {/* Owner: pending requests panel */}
      {isOwner && pendingRequests.length > 0 && (
        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b bg-amber-50">
            <p className="font-semibold text-sm text-amber-800">
              {pendingRequests.length} Pending Booking Request{pendingRequests.length > 1 ? 's' : ''}
            </p>
          </div>
          <div className="divide-y">
            {pendingRequests.map(req => (
              <div key={req.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{req.requester_name || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(req.date + 'T00:00:00'), 'MMMM d, yyyy')}</p>
                  {req.note && <p className="text-xs text-muted-foreground italic mt-0.5 truncate">"{req.note}"</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-green-700 border-green-200 hover:bg-green-50 gap-1"
                    onClick={() => updateRequestMutation.mutate({ id: req.id, status: 'approved' })}
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50 gap-1"
                    onClick={() => updateRequestMutation.mutate({ id: req.id, status: 'declined' })}
                  >
                    <X className="w-3.5 h-3.5" /> Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}