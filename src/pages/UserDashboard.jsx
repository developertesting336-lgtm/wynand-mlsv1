import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useFavorites } from '@/hooks/useFavorites';
import { Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import {
  Heart, MessageSquare, Calendar, Search, User,
  MapPin, ExternalLink, Clock, CheckCircle, XCircle, Hourglass, Star, ShieldCheck,
  CreditCard, Loader2, Reply, FileText, PenLine, Download
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import ListingCard from '@/components/listings/ListingCard';
import ReviewForm from '@/components/reviews/ReviewForm';
import TenantVerification from '@/components/profile/TenantVerification';
import StripeConnectBanner from '@/components/StripeConnectBanner';
import SignLeaseButton from '@/components/tenant/SignLeaseButton';
import { useStripeOnboarding } from '@/hooks/useStripeOnboarding';
import ReferralPaymentsTab from '@/components/ReferralPaymentsTab';
import InquiryReplies from '@/components/inquiries/InquiryReplies';
import InquiryKanban from '@/components/inquiries/InquiryKanban';
import { toast } from 'sonner';
import { NEIGHBORHOOD_LABELS } from '@/lib/constants';

function useDebouncedValue(value, delay = 500) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);

  return debounced;
}

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Inquiry row removed: InquiryKanban now handles chat layout ────────────────

/*
// ── OLD CARD-BASED BOOKING VIEW (COMMENETED FOR FUTURE REFERENCE) ─────────────
function BookingRow({ booking, listing, onPay }) {
  const statusConfig = {
    pending: { label: 'Pending Approval', icon: Hourglass, cls: 'bg-amber-100 text-amber-700' },
    approved: { label: 'Approved (Pending Payment)', icon: CheckCircle, cls: 'bg-green-100 text-green-700 animate-pulse' },
    confirmed: { label: 'Confirmed & Paid', icon: CheckCircle, cls: 'bg-blue-100 text-blue-700 font-semibold' },
    declined: { label: 'Declined', icon: XCircle, cls: 'bg-red-100 text-red-700' },
  };
  const { label, icon: Icon, cls } = statusConfig[booking.status] || statusConfig.pending;
  const depositAmount = listing?.deposit_amount || 0;
  const rentAmount = listing?.price_mxn || listing?.price_usd || 0;
  const subtotal = depositAmount + rentAmount;
  const totalAmount = subtotal;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-5 mb-4 last:mb-0">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            Move-in Date: {booking.move_in_date ? format(new Date(booking.move_in_date + 'T00:00:00'), 'MMMM d, yyyy') : 'N/A'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Lease: {booking.lease_duration_months} months
          </p>
          {booking.message && <p className="text-xs text-slate-500 mt-2 italic max-w-2xl">"{booking.message}"</p>}
        </div>
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${cls}`}>
          <Icon className="w-4 h-4" /> {label}
        </span>
      </div>

      {booking.status === 'approved' && subtotal > 0 && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Payment Summary</p>
              <p className="text-xs text-slate-500">Deposit and first month rent.</p>
            </div>
            <p className="text-sm font-semibold text-slate-900">
              ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<span className="text-xs font-normal text-muted-foreground ml-0.5"> MXN</span>
            </p>
          </div>

          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            <li className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <span>Deposit</span>
              <span className="font-semibold text-slate-900">
                ${depositAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<span className="text-xs font-normal text-muted-foreground ml-0.5"> MXN</span>
              </span>
            </li>
            <li className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <span>First Month Rent</span>
              <span className="font-semibold text-slate-900">
                ${rentAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<span className="text-xs font-normal text-muted-foreground ml-0.5"> MXN</span>
              </span>
            </li>
          </ul>

          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">Ready to pay now</span>
            <Button
              size="sm"
              onClick={() => onPay(booking.id)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm transition-transform active:scale-[0.98]"
            >
              Pay ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<span className="text-xs font-normal opacity-90 ml-0.5"> MXN</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function OldBookingsTab({ bookings = [], isLoading, listings, userEmail }) {
  const handlePayment = async (bookingId) => {
    try {
      const res = await supabase.functions.invoke('stripe-checkout', {
        body: JSON.stringify({
          bookingId,
          origin: window.location.origin
        })
      });

      let data = res.data;
      if (res && typeof res.json === 'function') {
        try {
          data = await res.json();
        } catch (err) {
          console.warn('Response is not JSON, using raw object:', err);
        }
      }

      if (data?.url) {
        window.location.href = data.url;
      } else if (data?.error) {
        toast.error(data.error);
      } else {
        toast.error('Failed to start payment checkout.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error starting payment checkout.');
    }
  };

  const grouped = bookings.reduce((acc, b) => {
    if (!acc[b.listing_id]) acc[b.listing_id] = [];
    acc[b.listing_id].push(b);
    return acc;
  }, {});

  const listingMap = Object.fromEntries(listings.map(l => [l.id, l]));

  if (isLoading) return <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>;

  if (bookings.length === 0) {
    return (
      <div className="text-center py-16">
        <Calendar className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
        <p className="font-semibold text-lg">No booking requests yet</p>
        <p className="text-muted-foreground text-sm mt-1">Use the availability calendar on any listing to request dates.</p>
        <Link to="/listings"><Button className="mt-5 gap-2"><Search className="w-4 h-4" /> Browse Listings</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([listingId, items]) => {
        const listing = listingMap[listingId];
        return (
          <Card key={listingId}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Link to={`/listings/${listingId}`} className="font-semibold text-sm hover:text-primary transition-colors flex items-center gap-1">
                  {listing?.title || 'Listing'} <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                </Link>
                {listing?.neighborhood && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {NEIGHBORHOOD_LABELS[listing.neighborhood] || listing.neighborhood}
                  </span>
                )}
              </div>
              {items.map(b => (
                <BookingRow key={b.id} booking={b} listing={listing} onPay={handlePayment} />
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
*/

// ── TABLE-BASED BOOKINGS VIEW ──────────────────────────────────────────────────
function BookingsTab({ bookings = [], isLoading, listings = [], userEmail }) {
  const listingMap = Object.fromEntries(listings.map(l => [l.id, l]));
  const [payingId, setPayingId] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const debouncedSearch = useDebouncedValue(search, 500);

  const filteredBookings = bookings.filter(b => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) return true;
    const listing = listingMap[b.listing_id];
    return [
      listing?.title,
      b.listing_title,
      b.owner_email,
      b.agent_email,
      b.status,
      b.lease_status,
      b.move_in_date,
    ]
      .filter(Boolean)
      .some(value => value.toString().toLowerCase().includes(query));
  });
  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / pageSize));
  const paginatedBookings = filteredBookings.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handlePayment = async (bookingId) => {
    setPayingId(bookingId);
    try {
      const res = await supabase.functions.invoke('stripe-checkout', {
        body: JSON.stringify({
          bookingId,
          origin: window.location.origin
        })
      });

      console.log(res);
      

      let data = res.data;
      if (res && typeof res.json === 'function') {
        try {
          data = await res.json();
        } catch (err) {
          console.warn('Response is not JSON, using raw object:', err);
        }
      }

      if (data?.url) {
        window.location.href = data.url;
      } else if (data?.error) {
        toast.error(data.error);
        setPayingId(null);
      } else {
        toast.error('Failed to start payment checkout.');
        setPayingId(null);
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error starting payment checkout.');
      setPayingId(null);
    }
  };

  if (isLoading) return <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>;

  if (bookings.length === 0) {
    return (
      <div className="text-center py-16">
        <Calendar className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
        <p className="font-semibold text-lg">No booking requests yet</p>
        <p className="text-muted-foreground text-sm mt-1">Use the availability calendar on any listing to request dates.</p>
        <Link to="/listings"><Button className="mt-5 gap-2"><Search className="w-4 h-4" /> Browse Listings</Button></Link>
      </div>
    );
  }

  const statusConfig = {
    pending: { label: 'Pending Approval', icon: Hourglass, cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    lease_pending: { label: 'Sign Lease Agreement', icon: PenLine, cls: 'bg-blue-100 text-blue-700 border-blue-200 animate-pulse' },
    approved: { label: 'Approved (Pay Now)', icon: CheckCircle, cls: 'bg-green-100 text-green-700 border-green-200 animate-pulse' },
    confirmed: { label: 'Confirmed & Paid', icon: CheckCircle, cls: 'bg-blue-100 text-blue-700 border-blue-200 font-semibold' },
    declined: { label: 'Declined', icon: XCircle, cls: 'bg-red-100 text-red-700 border-red-200' },
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search bookings by property, owner, or status"
            className="pl-10 pr-3 h-11 rounded-2xl border border-slate-200 bg-slate-50 shadow-sm focus:border-slate-300 focus:ring-2 focus:ring-primary/10"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <label htmlFor="bookings-page-size" className="font-medium">Show</label>
          <select
            id="bookings-page-size"
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10"
          >
            {[10, 15, 25].map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <span>per page</span>
        </div>
      </div>

      {filteredBookings.length === 0 ? (
        <div className="text-center py-16">
          <Calendar className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="font-semibold text-lg">No bookings match your search</p>
          <p className="text-muted-foreground text-sm mt-1">Try adjusting the search query.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left">
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Property</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Owner</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Move-in Date</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Lease</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Status</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Lease Agreement</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedBookings.map(b => {
              const listing = listingMap[b.listing_id];
              const ownerEmail = b.owner_email || listing?.owner_email || '—';
              const ownerName = listing?.owner_name || 'Owner';
              const { label, icon: Icon, cls } = statusConfig[b.status] || statusConfig.pending;
              
              // Use agreement_conditions for payment amounts
              const conditions = b.agreement_conditions || {};
              const depositAmount = parseFloat(conditions.securityDepositAmount) || 0;
              const rentAmount = parseFloat(conditions.monthlyRent?.toString().replace(/[^0-9.]/g, '')) || 0;
              const totalAmount = depositAmount + (rentAmount * 2);

              return (
                <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    <Link to={`/listings/${b.listing_id}`} className="hover:text-primary transition-colors inline-flex items-center gap-1 font-semibold">
                      {listing?.title || b.listing_title || 'Property'} <ExternalLink className="w-3 h-3 opacity-60" />
                    </Link>
                    {b.message && (
                      <p className="text-xs text-muted-foreground italic mt-1 max-w-[200px] truncate" title={b.message}>
                        "{b.message}"
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium">{ownerName}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {b.move_in_date ? format(new Date(b.move_in_date + 'T00:00:00'), 'MMMM d, yyyy') : 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {b.lease_duration_months} months
                  </td>
                  <td className="px-4 py-3">
                    {b.end_lease ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-slate-100 text-slate-700 border-slate-200">
                        <CheckCircle className="w-3.5 h-3.5 text-slate-500" /> Lease Ended
                      </span>
                    ) : (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
                        <Icon className="w-3.5 h-3.5" /> {label}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {b.lease_pdf_url ? (
                      <div className="inline-flex items-center gap-3">
                        <a
                          href={b.lease_pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <FileText className="w-3.5 h-3.5" /> View
                        </a>
                        <a
                          href={b.lease_pdf_url}
                          download={`lease_${b.id}.pdf`}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                          title="Download lease"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Pending...</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(b.status === 'lease_pending' || (b.status === 'approved' && b.lease_status !== 'signed')) ? (
                      <SignLeaseButton booking={b} listing={listing} onSigned={() => {}} />
                    ) : b.status === 'approved' && totalAmount > 0 ? (
                      <Button
                        size="sm"
                        onClick={() => handlePayment(b.id)}
                        disabled={payingId === b.id}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-transform active:scale-[0.98] py-1 px-2.5 h-auto whitespace-nowrap disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {payingId === b.id ? (
                          <span className="flex items-center gap-1.5">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Pay ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            <span className="text-[10px] font-normal opacity-90 ml-0.5"> mxn</span>
                          </span>
                        ) : (
                          <>
                            Pay ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            <span className="text-[10px] font-normal opacity-90 ml-0.5"> mxn</span>
                          </>
                        )}
                      </Button>
                    ) : b.status === 'confirmed' ? (
                      <span className="text-xs text-emerald-600 font-medium">Completed</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground mt-4">
          <div>Page {page} of {totalPages}</div>
          <div className="inline-flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  )}
  </div>
  );
}

// ── Payments tab ──────────────────────────────────────────────────────────────
function PaymentsTab({ payments = [], bookings = [], listings = [], isLoading }) {
  const bookingMap = Object.fromEntries(bookings.map(b => [b.id, b]));
  const listingMap = Object.fromEntries(listings.map(l => [l.id, l]));
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const debouncedSearch = useDebouncedValue(search, 500);

  const filteredPayments = payments.filter(p => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) return true;
    const booking = bookingMap[p.booking_id];
    const listing = listingMap[p.listing_id];
    return [
      listing?.title,
      listing?.address,
      p.stripe_payment_intent_id,
      p.stripe_session_id,
      p.currency,
      p.status,
      booking?.owner_email,
    ]
      .filter(Boolean)
      .some(value => value.toString().toLowerCase().includes(query));
  });
  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / pageSize));
  const paginatedPayments = filteredPayments.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search payments by property, owner, or transaction"
            className="pl-10 pr-3 h-11 rounded-2xl border border-slate-200 bg-slate-50 shadow-sm focus:border-slate-300 focus:ring-2 focus:ring-primary/10"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <label htmlFor="payments-page-size" className="font-medium">Show</label>
          <select
            id="payments-page-size"
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10"
          >
            {[10, 15, 25].map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <span>per page</span>
        </div>
      </div>

      {filteredPayments.length === 0 ? (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <div className="text-center py-16">
            <CreditCard className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-semibold text-lg">No payments found</p>
            <p className="text-muted-foreground text-sm mt-1">Adjust the search or check back later.</p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left">
                <th className="px-4 py-3 font-semibold text-muted-foreground">Property</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">Owner</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">Amount</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">Date</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">Transaction ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedPayments.map(p => {
                const booking = bookingMap[p.booking_id];
                const listing = listingMap[p.listing_id];
                const ownerEmail = booking?.owner_email || listing?.owner_email || '—';
                const ownerName = listing?.owner_name || 'Owner';
                const amountUsd = p.amount_centavos ? (p.amount_centavos / 100) : 0;
                const datePart = p.created_date ? format(new Date(p.created_date), 'MMMM d, yyyy') : 'N/A';
                const timePart = p.created_date ? format(new Date(p.created_date), 'h:mm a') : '';

                return (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      {listingMap[p.listing_id]?.title ? (
                        <Link to={`/listings/${p.listing_id}`} className="hover:text-primary transition-colors inline-flex items-center gap-1">
                          {listingMap[p.listing_id].title} <ExternalLink className="w-3 h-3 opacity-60" />
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Unknown Property</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium">{ownerName}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-emerald-600">
                      ${amountUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<span className="text-xs font-normal text-muted-foreground ml-0.5"> MXN</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div>{datePart}</div>
                      {timePart && <div className="text-xs text-muted-foreground/60 mt-0.5">{timePart}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground break-all">
                      {p.stripe_payment_intent_id || p.stripe_session_id || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground mt-4">
          <div>Page {page} of {totalPages}</div>
          <div className="inline-flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Reviews tab ───────────────────────────────────────────────────────────────
function ReviewsTab({ user, listings }) {
  const [reviewingId, setReviewingId] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const debouncedSearch = useDebouncedValue(search, 500);

  const { data: allBookings = [], isLoading } = useQuery({
    queryKey: ['user-bookings-reviews', user.id],
    queryFn: () => base44.entities.Booking.filter({ renter_id: user.id }, '-created_date', 100),
    enabled: !!user.id,
  });

  const { data: existingReviews = [] } = useQuery({
    queryKey: ['all-reviews', user.id],
    queryFn: () => base44.entities.PropertyReview.filter({ reviewer_id: user.id }, '-created_date', 100),
    enabled: !!user.id,
  });

  const listingMap = Object.fromEntries(listings.map(l => [l.id, l]));
  const reviewedListingIds = new Set(existingReviews.map(r => r.listing_id));

  // Deduplicate: one entry per listing that has at least one approved, confirmed, OR ended/resolved booking
  const approvedBookings = allBookings.filter(b =>
    b.status === 'approved' ||
    b.status === 'confirmed' ||
    b.status === 'resolved' ||
    b.status === 'ended' ||
    b.end_lease === true
  );
  const reviewableListingIds = [...new Set(approvedBookings.map(b => b.listing_id))];
  const filteredReviewableListingIds = reviewableListingIds.filter(listingId => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) return true;
    const listing = listingMap[listingId];
    return [listing?.title, listing?.address, listing?.neighborhood]
      .filter(Boolean)
      .some(value => value.toLowerCase().includes(query));
  });
  const totalPages = Math.max(1, Math.ceil(filteredReviewableListingIds.length / pageSize));
  const paginatedReviewableListingIds = filteredReviewableListingIds.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  if (isLoading) return <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;

  const searchAndPaginationControls = (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
      <div className="relative w-full md:w-96">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search reviewable listings by title or neighborhood"
          className="pl-10 pr-3 h-11 rounded-2xl border border-slate-200 bg-slate-50 shadow-sm focus:border-slate-300 focus:ring-2 focus:ring-primary/10"
        />
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <label htmlFor="reviews-page-size" className="font-medium">Show</label>
        <select
          id="reviews-page-size"
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
          className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10"
        >
          {[5, 10, 15].map(size => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
        <span>per page</span>
      </div>
    </div>
  );

  if (filteredReviewableListingIds.length === 0) {
    return (
      <div className="space-y-4">
        {searchAndPaginationControls}
        <div className="text-center py-16">
          <Star className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="font-semibold text-lg">No reviewable listings found</p>
          <p className="text-muted-foreground text-sm mt-1">Try another search or wait until a booking is approved.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">You can review properties where your booking was approved or your lease has ended.</p>
      {searchAndPaginationControls}
      {paginatedReviewableListingIds.map(listingId => {
        const listing = listingMap[listingId];
        const alreadyReviewed = reviewedListingIds.has(listingId);
        const isOpen = reviewingId === listingId;

        return (
          <Card key={listingId}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <Link to={`/listings/${listingId}`} className="font-semibold text-sm hover:text-primary transition-colors flex items-center gap-1">
                  {listing?.title || 'Property'} <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                </Link>
                {alreadyReviewed ? (
                  <Badge className="bg-accent/10 text-accent border-0 gap-1 text-xs">
                    <CheckCircle className="w-3 h-3" /> Reviewed
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant={isOpen ? 'outline' : 'default'}
                    onClick={() => setReviewingId(isOpen ? null : listingId)}
                    className="gap-1.5 shrink-0"
                  >
                    <Star className="w-3.5 h-3.5" />
                    {isOpen ? 'Cancel' : 'Leave Review'}
                  </Button>
                )}
              </div>
              {isOpen && !alreadyReviewed && (
                <div className="border-t pt-4">
                  <ReviewForm listing={listing || { id: listingId, title: 'Property' }} user={user} onDone={() => setReviewingId(null)} />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <div>Page {page} of {totalPages}</div>
          <div className="inline-flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function UserDashboard() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('tenant_dashboard_active_tab') || 'favorites';
  });
  const { onboardingLoading, handleStripeOnboard } = useStripeOnboarding(user);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {}).finally(() => setAuthLoading(false));

    // Handle payment success/cancel redirects
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      import('canvas-confetti').then((confetti) => {
        confetti.default({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      });
      toast.success('Payment completed successfully! Your booking is now confirmed.');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('payment') === 'cancel') {
      toast.error('Payment checkout cancelled.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const { favorites, favoriteIds, toggle } = useFavorites(user?.id);
  const [favoritesSearch, setFavoritesSearch] = useState('');
  const [favoritesPage, setFavoritesPage] = useState(1);
  const [favoritesPageSize, setFavoritesPageSize] = useState(10);

  const { data: allListings = [], isLoading: listingsLoading } = useQuery({
    queryKey: ['approved-listings'],
    queryFn: () => base44.entities.Listing.filter({ status: 'approved' }, '-created_date', 200),
    enabled: !!user,
  });

  const { data: myInquiries = [], isLoading: inquiriesLoading } = useQuery({
    queryKey: ['user-inquiries', user?.id],
    queryFn: () => base44.entities.Inquiry.filter({ tenant_id: user.id }, '-created_date', 50),
    enabled: !!user?.id,
  });

  const { data: myBookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['user-bookings', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('renter_id', user.id)
        .order('created_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: myPayments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['user-payments', user?.id],
    queryFn: () => base44.entities.Payment.filter({ payer_id: user.id }, '-created_date', 100),
    enabled: !!user?.id,
  });

  const savedListings = allListings.filter(l => favoriteIds.has(l.id));
  const debouncedFavoritesSearch = useDebouncedValue(favoritesSearch, 500);
  const filteredSavedListings = savedListings.filter(listing => {
    const query = debouncedFavoritesSearch.trim().toLowerCase();
    if (!query) return true;
    return [listing.title, listing.address, listing.neighborhood, listing.status]
      .filter(Boolean)
      .some(value => value.toLowerCase().includes(query));
  });
  const favoritesTotalPages = Math.max(1, Math.ceil(filteredSavedListings.length / favoritesPageSize));
  const paginatedSavedListings = filteredSavedListings.slice((favoritesPage - 1) * favoritesPageSize, favoritesPage * favoritesPageSize);

  useEffect(() => {
    if (favoritesPage > favoritesTotalPages) {
      setFavoritesPage(favoritesTotalPages);
    }
  }, [favoritesPage, favoritesTotalPages]);

  if (authLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-3 gap-4"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <User className="w-14 h-14 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">Sign in to view your dashboard</h2>
        <p className="text-muted-foreground mb-6 text-sm">Track your favorites, inquiries, and booking requests in one place.</p>
        <Button size="lg" onClick={() => base44.auth.redirectToLogin()}>Sign In</Button>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <StripeConnectBanner 
        user={user} 
        onboardingLoading={onboardingLoading} 
        handleStripeOnboard={handleStripeOnboard}
        title="Set up Your Payments"
        description="To receive referral commission connect your bank account through Stripe."
      />

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight">
              Welcome back{user.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}
            </h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        <StatCard icon={Heart} label="Saved Properties" value={savedListings.length} color="bg-rose-100 text-rose-600" />
        <StatCard icon={MessageSquare} label="Inquiries Sent" value={myInquiries.length} color="bg-blue-100 text-blue-600" />
        <StatCard icon={Calendar} label="Booking Requests" value={myBookings.length} color="bg-amber-100 text-amber-600" />
      </div>

    

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => {
        setActiveTab(val);
        localStorage.setItem('tenant_dashboard_active_tab', val);
      }}>
        <TabsList className="mb-8 flex w-full md:w-auto overflow-x-auto whitespace-nowrap justify-start h-auto p-1 bg-muted rounded-xl">
          <TabsTrigger value="favorites" className="gap-1.5">
            <Heart className="w-4 h-4" /> Favorites
            {savedListings.length > 0 && (
              <span className="ml-1 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {savedListings.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="inquiries" className="gap-1.5">
            <MessageSquare className="w-4 h-4" /> Inquiries
            {myInquiries.length > 0 && (
              <span className="ml-1 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {myInquiries.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="bookings" className="gap-1.5">
            <Calendar className="w-4 h-4" /> Bookings
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-1.5">
            <CreditCard className="w-4 h-4" /> Payments
            {myPayments.length > 0 && (
              <span className="ml-1 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {myPayments.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="reviews" className="gap-1.5">
            <Star className="w-4 h-4" /> Reviews
          </TabsTrigger>
          <TabsTrigger value="referral-payments" className="gap-1.5">
            <CreditCard className="w-4 h-4" /> Referral Earnings
          </TabsTrigger>
          <TabsTrigger value="verification" className="gap-1.5">
            <ShieldCheck className="w-4 h-4" /> Verification
            {user.id_verified && (
              <span className="ml-1 bg-accent text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">✓</span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Favorites Tab */}
        <TabsContent value="favorites" className="pt-6">
          {listingsLoading ? (
            <div className="space-y-5">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-72 rounded-2xl" />)}
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={favoritesSearch}
                    onChange={(e) => { setFavoritesSearch(e.target.value); setFavoritesPage(1); }}
                    placeholder="Search favorites by title, neighborhood, or status"
                    className="pl-10 pr-3 h-11 rounded-2xl border border-slate-200 bg-slate-50 shadow-sm focus:border-slate-300 focus:ring-2 focus:ring-primary/10"
                  />
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <label htmlFor="favorites-page-size" className="font-medium">Show</label>
                  <select
                    id="favorites-page-size"
                    value={favoritesPageSize}
                    onChange={(e) => { setFavoritesPageSize(Number(e.target.value)); setFavoritesPage(1); }}
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10"
                  >
                    {[6, 12, 18].map(size => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                  <span>per page</span>
                </div>
              </div>

              {filteredSavedListings.length === 0 ? (
                <div className="text-center py-16">
                  <Heart className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="font-semibold text-lg">No saved properties found</p>
                  <p className="text-muted-foreground text-sm mt-1">Try another search or save a new listing.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {paginatedSavedListings.map(listing => (
                      <ListingCard
                        key={listing.id}
                        listing={listing}
                        favoriteIds={favoriteIds}
                        onToggleFavorite={(id) => toggle.mutate(id)}
                      />
                    ))}
                  </div>
                  {favoritesTotalPages > 1 && (
                    <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground mt-4">
                      <div>Page {favoritesPage} of {favoritesTotalPages}</div>
                      <div className="inline-flex items-center gap-2">
                        <Button size="sm" variant="outline" disabled={favoritesPage === 1} onClick={() => setFavoritesPage(favoritesPage - 1)}>
                          Previous
                        </Button>
                        <Button size="sm" variant="outline" disabled={favoritesPage === favoritesTotalPages} onClick={() => setFavoritesPage(favoritesPage + 1)}>
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </TabsContent>

        {/* Inquiries Tab */}
        <TabsContent value="inquiries" className="pt-6">
          {inquiriesLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
          ) : myInquiries.length === 0 ? (
            <div className="text-center py-16">
              <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="font-semibold text-lg">No inquiries sent yet</p>
              <p className="text-muted-foreground text-sm mt-1">Contact an agent from any listing page to get started.</p>
              <Link to="/listings"><Button className="mt-5 gap-2"><Search className="w-4 h-4" /> Browse Listings</Button></Link>
            </div>
          ) : (
            <InquiryKanban inquiries={myInquiries} />
          )}
        </TabsContent>

        {/* Bookings Tab */}
        <TabsContent value="bookings" className="pt-6">
          <BookingsTab bookings={myBookings} isLoading={bookingsLoading} listings={allListings} userEmail={user.email} />
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments" className="pt-6">
          <PaymentsTab payments={myPayments} bookings={myBookings} listings={allListings} isLoading={paymentsLoading} />
        </TabsContent>

        {/* Reviews Tab */}
        <TabsContent value="reviews" className="pt-6">
          <ReviewsTab user={user} listings={allListings} />
        </TabsContent>

        {/* Referral Payments Tab */}
        <TabsContent value="referral-payments" className="pt-6">
          <ReferralPaymentsTab userId={user.id} userEmail={user.email} listings={allListings} />
        </TabsContent>

        {/* Verification Tab */}
        <TabsContent value="verification" className="pt-6">
          <TenantVerification user={user} onUserUpdated={setUser} />
        </TabsContent>
      </Tabs>
    </div>
  );
}