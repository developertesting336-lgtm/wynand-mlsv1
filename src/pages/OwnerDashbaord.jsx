import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Home, Eye, Calendar, PlusCircle, ShieldCheck, CheckCircle,
  XCircle, Hourglass, ExternalLink, Building2, TrendingUp, BadgeCheck, Lock,
  MessageSquare, CreditCard, Pencil, Loader2, FileText, Download, Search
} from 'lucide-react';

import { format } from 'date-fns';
import { NEIGHBORHOOD_LABELS } from '@/lib/constants';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import AvailabilityManager from '@/components/owner/AvailabilityManager';
import EditPropertyModal from '@/components/owner/EditPropertyModal';
import StripeConnectBanner from '@/components/StripeConnectBanner';
import { useStripeOnboarding } from '@/hooks/useStripeOnboarding';
import ReferralPaymentsTab from '@/components/ReferralPaymentsTab';
import TenantVerification from '@/components/profile/TenantVerification';
import InquiryKanban from '@/components/inquiries/InquiryKanban';
import LeaseDetailsForm from '@/components/owner/LeaseDetailsForm';
import SignaturePad from '@/components/owner/SignaturePad';

const LISTING_STATUS = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const BOOKING_STATUS = {
  pending:  { label: 'Pending',  icon: Hourglass,     cls: 'bg-amber-100 text-amber-700' },
  lease_pending: { label: 'Lease Pending', icon: Hourglass, cls: 'bg-blue-100 text-blue-700 animate-pulse' },
  approved: { label: 'Approved & Signed', icon: CheckCircle,   cls: 'bg-green-100 text-green-700' },
  declined: { label: 'Declined', icon: XCircle,       cls: 'bg-red-100 text-red-700' },
};

function useDebouncedValue(value, delay = 500) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);

  return debounced;
}

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

function PropertiesTable({ listings, pendingBookingsCount, bookingStatusMap, onEdit }) {
  if (listings.length === 0) {
    return (
      <div className="text-center py-16">
        <Building2 className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
        <p className="font-semibold text-lg">No properties yet</p>
        <p className="text-muted-foreground text-sm mt-1">Submit your first listing to get started.</p>
        <Link to="/submit-property">
          <Button className="mt-5 gap-2"><PlusCircle className="w-4 h-4" /> Add Property</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 text-left">
            <th className="px-4 py-3 font-semibold text-muted-foreground">Property</th>
            <th className="px-4 py-3 font-semibold text-muted-foreground">Location</th>
            <th className="px-4 py-3 font-semibold text-muted-foreground">Price</th>
            <th className="px-4 py-3 font-semibold text-muted-foreground text-center">
              <span className="flex items-center gap-1 justify-center"><Eye className="w-3.5 h-3.5" /> Views</span>
            </th>
            <th className="px-4 py-3 font-semibold text-muted-foreground">Status</th>
            <th className="px-4 py-3 font-semibold text-muted-foreground text-center">
              <span className="flex items-center gap-1 justify-center"><Calendar className="w-3.5 h-3.5" /> Bookings</span>
            </th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {listings.map(l => {
            const pending = pendingBookingsCount[l.id] || 0;
            return (
              <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {l.photos?.[0] && (
                      <img src={l.photos[0]} alt="" className="w-10 h-8 object-cover rounded-md shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium truncate max-w-[180px]">{l.title}</p>
                      {l.is_verified && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-sky-600 font-semibold">
                          <ShieldCheck className="w-3 h-3" /> Verified
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {NEIGHBORHOOD_LABELS[l.neighborhood] || l.neighborhood}
                </td>
                <td className="px-4 py-3 font-semibold whitespace-nowrap">
                  ${l.price_usd?.toLocaleString()}<span className="text-muted-foreground font-normal">/mo</span>
                </td>
                <td className="px-4 py-3 text-center font-bold">{l.views || 0}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${LISTING_STATUS[l.status] || ''}`}>
                    {l.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {bookingStatusMap[l.id] === 'confirmed' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                      Confirmed
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">Not booked yet</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => onEdit?.(l)}>
                      <Pencil className="w-3 h-3" /> Edit
                    </Button>
                    <Link to={`/listings/${l.id}`}>
                      <Button size="sm" variant="ghost" className="gap-1 text-xs">
                        <ExternalLink className="w-3.5 h-3.5" /> View
                      </Button>
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BookingRequestCard({ booking, listing, onApprove, onDecline, verifiedTenantEmails, renterProfileMap, updatingState }) {
  const cfg = BOOKING_STATUS[booking.status] || BOOKING_STATUS.pending;
  const Icon = cfg.icon;
  const renterProfile = renterProfileMap[booking.renter_id];
  const isTenantVerified = verifiedTenantEmails?.has(renterProfile?.email);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm">{renterProfile?.full_name || 'Anonymous'}</p>
              {isTenantVerified && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                  <ShieldCheck className="w-3 h-3" /> Verified Tenant
                </span>
              )}
            </div>
            {/* {renterProfile?.email && (
              <p className="text-xs text-muted-foreground">{renterProfile.email}</p>
            )} */}
            {/* {renterProfile?.phone_number && (
              <p className="text-xs text-muted-foreground">Phone: {renterProfile.phone_number}</p>
            )} */}
            <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
              <p>
                Move-in Date: <span className="font-semibold text-foreground">
                  {format(new Date(booking.move_in_date + 'T00:00:00'), 'MMMM d, yyyy')}
                </span>
              </p>
              <p>
                Lease Duration: <span className="font-semibold text-foreground">{booking.lease_duration_months} months</span>
              </p>
              {booking.monthly_budget_usd && (
                <p>
                  Monthly Budget: <span className="font-semibold text-foreground">${booking.monthly_budget_usd} USD</span>
                </p>
              )}
              {booking.agent_email && (
                <p>
                  Referred by Agent: <span className="font-medium text-foreground">{booking.agent_email}</span>
                </p>
              )}
            </div>
            {booking.message && (
              <p className="text-xs italic text-muted-foreground mt-2 bg-muted/50 rounded-lg p-2">
                "{booking.message}"
              </p>
            )}
            {listing && (
              <Link to={`/listings/${listing.id}`} className="text-xs text-primary hover:underline mt-1 inline-flex items-center gap-0.5">
                {listing.title} <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${cfg.cls}`}>
              <Icon className="w-3 h-3" /> {cfg.label}
            </span>
          </div>
        </div>

        {booking.status === 'pending' && (
          <div className="flex gap-2 mt-3 pt-3 border-t">
            <Button
              size="sm"
              className="gap-1.5 flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-70"
              onClick={() => onApprove(booking.id)}
              disabled={updatingState?.id === booking.id}
            >
              {updatingState?.id === booking.id && updatingState?.action === 'approve' ? (
                <span className="flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Approve</span>
              ) : (
                <span className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" /> Approve</span>
              )}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="gap-1.5 flex-1 disabled:opacity-70"
              onClick={() => onDecline(booking.id)}
              disabled={updatingState?.id === booking.id}
            >
              {updatingState?.id === booking.id && updatingState?.action === 'declined' ? (
                <span className="flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Decline</span>
              ) : (
                <span className="flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" /> Decline</span>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PaymentsReceivedTab({ payments = [], bookings = [], listings = [], isLoading }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const bookingMap = Object.fromEntries(bookings.map(b => [b.id, b]));
  const listingMap = Object.fromEntries(listings.map(l => [l.id, l]));
  const debouncedSearch = useDebouncedValue(search, 500);
  
  const { data: referralPayments = [] } = useQuery({
    queryKey: ['referral-payments-for-bookings', payments.map(p => p.booking_id).filter(Boolean)],
    queryFn: async () => {
      if (payments.length === 0) return [];
      const bookingIds = payments.map(p => p.booking_id).filter(Boolean);
      const { data } = await supabase
        .from('referral_payments')
        .select('booking_id')
        .in('booking_id', bookingIds);
      return data || [];
    },
    enabled: payments.length > 0,
  });
  const referralBookingIds = new Set(referralPayments.map(rp => rp.booking_id));

  const { data: payerProfiles = [] } = useQuery({
    queryKey: ['payer-profiles', payments.map(p => p.payer_id).filter(Boolean)],
    queryFn: async () => {
      if (payments.length === 0) return [];
      const payerIds = payments.map(p => p.payer_id).filter(Boolean);
      const { data } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', payerIds);
      return data || [];
    },
    enabled: payments.length > 0,
  });
  const payerProfileMap = Object.fromEntries(payerProfiles.map(p => [p.id, p]));

  const filteredPayments = payments.filter(p => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) return true;
    const listing = listingMap[p.listing_id];
    const payer = payerProfileMap[p.payer_id];
    return [
      listing?.title,
      payer?.full_name,
      payer?.email,
      p.payout_status,
      p.currency,
      p.stripe_payment_intent_id,
      p.stripe_session_id,
    ]
      .filter(Boolean)
      .some(value => value.toLowerCase().includes(query));
  });

  const paymentsTotalPages = Math.max(1, Math.ceil(filteredPayments.length / pageSize));
  const paginatedPayments = filteredPayments.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (page > paymentsTotalPages) {
      setPage(paymentsTotalPages);
    }
  }, [page, paymentsTotalPages]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => (
          <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  if (filteredPayments.length === 0) {
    return (
      <div className="text-center py-16">
        <CreditCard className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
        <p className="font-semibold text-lg">No payments found</p>
        <p className="text-muted-foreground text-sm mt-1">
          Adjust your search or check back later when tenants make payments.
        </p>
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
            placeholder="Search payments by property, tenant, status, or transaction"
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
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-left">
              <th className="px-4 py-3 font-semibold text-muted-foreground">Property</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground">Tenant</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground">Amount</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground">Tenant Payment</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground">Date</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground">Transaction ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginatedPayments.map(p => {
              const booking = bookingMap[p.booking_id];
              const amountUsd = p.amount_cents ? (p.amount_cents / 100) : 0;
              const datePart = p.created_date ? format(new Date(p.created_date), 'MMMM d, yyyy') : 'N/A';
              const timePart = p.created_date ? format(new Date(p.created_date), 'h:mm a') : '';
              
              const dbCommissionPct = p.commission_paid_percentage ?? p.commision_paid_percentage;
              const hasReferral = dbCommissionPct != null ? dbCommissionPct > 0 : referralBookingIds.has(p.booking_id);
              const commissionPct = dbCommissionPct ?? (hasReferral ? 15 : 0);
              const ownerPct = hasReferral ? 0.8 : 0.9;
              
              let description = hasReferral ? '80% after agent + platform fees' : '90% after platform fee';
              if (commissionPct === 15) {
                description = '80% after 15% for agent, 5% for platform';
              } else if (commissionPct > 0) {
                description = `80% after ${commissionPct}% for agent, 5% for platform`;
              }

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
                    <div className="text-xs text-muted-foreground">{payerProfileMap[p.payer_id]?.full_name || ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-emerald-600">
                      ${(amountUsd * ownerPct).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {p.currency?.toUpperCase() || 'USD'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {description}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {p.payout_status === 'paid' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Paid
                      </span>
                    ) : p.payout_status === 'failed' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 border border-rose-200">
                        Failed
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                        Processing
                      </span>
                    )}
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
      {paymentsTotalPages > 1 && (
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <div>Page {page} of {paymentsTotalPages}</div>
          <div className="inline-flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="outline" disabled={page === paymentsTotalPages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OwnerDashboard() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [editingListing, setEditingListing] = useState(null);
  const queryClient = useQueryClient();
  const { onboardingLoading, handleStripeOnboard } = useStripeOnboarding(user);

  const openEditModal = (listing) => setEditingListing(listing);
  const closeEditModal = () => setEditingListing(null);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
    }).catch(() => {}).finally(() => setAuthLoading(false));
  }, []);

  const { data: myListings = [], isLoading: listingsLoading } = useQuery({
    queryKey: ['owner-listings', user?.email],
    queryFn: () => base44.entities.Listing.filter({ owner_email: user.email }, '-created_date', 100),
    enabled: !!user?.email,
  });

  const listingIds = myListings.map(l => l.id);

  const { data: verifiedUsers = [] } = useQuery({
    queryKey: ['verified-tenants'],
    queryFn: () => base44.entities.User.filter({ id_verified: true }, '-created_date', 500),
    enabled: !!user?.email,
  });
  const verifiedTenantEmails = new Set(verifiedUsers.map(u => u.email));

  const { data: allBookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['owner-bookings', user?.id],
    queryFn: () => base44.entities.Booking.filter({ owner_id: user.id }, '-created_date', 200),
    enabled: !!user?.id,
  });

  const { data: renterProfiles = [] } = useQuery({
    queryKey: ['renter-profiles-supabase', allBookings.map(b => b.renter_id).filter(Boolean)],
    queryFn: async () => {
      if (allBookings.length === 0) return [];
      const renterIds = allBookings.map(b => b.renter_id).filter(Boolean);
      const { data } = await supabase
        .from('profiles')
        .select('id, email, full_name, phone_number')
        .in('id', renterIds);
      return data || [];
    },
    enabled: allBookings.length > 0,
  });
  
  const renterProfileMap = Object.fromEntries(renterProfiles.map(p => [p.id, p]));

  // Owner only sees their own inquiries (where they are the listing_owner_id)
  const { data: allInquiries = [], isLoading: inquiriesLoading } = useQuery({
    queryKey: ['owner-inquiries', user?.id],
    queryFn: async () => {
      const inquiries = await base44.entities.Inquiry.filter(
        { listing_owner_id: user.id },
        '-created_date',
        100
      );
      return inquiries.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
    enabled: !!user?.id,
  });

  const { data: myPayments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['owner-payments', user?.id],
    queryFn: () => base44.entities.Payment.filter({ payee_id: user.id }, '-created_date', 100),
    enabled: !!user?.id,
  });

  const { data: allListings = [] } = useQuery({
    queryKey: ['all-listings-for-payments'],
    queryFn: () => base44.entities.Listing.filter({}, '-created_date', 200),
    enabled: !!user?.id,
  });

  const [updatingState, setUpdatingState] = useState({ id: null, action: null });
  const [editingBookingId, setEditingBookingId] = useState(null);
  const [agreementData, setAgreementData] = useState(null);
  const [ownerSignature, setOwnerSignature] = useState(null);
  const [editingAgreementId, setEditingAgreementId] = useState(null);
  const [editingAgreementData, setEditingAgreementData] = useState(null);

  const [propertiesSearch, setPropertiesSearch] = useState('');
  const [propertiesPage, setPropertiesPage] = useState(1);
  const [propertiesPageSize, setPropertiesPageSize] = useState(10);

  const [bookingTab, setBookingTab] = useState('requests');

  const [bookingRequestsSearch, setBookingRequestsSearch] = useState('');
  const [bookingRequestsPage, setBookingRequestsPage] = useState(1);
  const [bookingRequestsPageSize, setBookingRequestsPageSize] = useState(10);

  const [bookingsSearch, setBookingsSearch] = useState('');
  const [bookingsPage, setBookingsPage] = useState(1);
  const [bookingsPageSize, setBookingsPageSize] = useState(10);

  const [resolvedSearch, setResolvedSearch] = useState('');
  const [resolvedPage, setResolvedPage] = useState(1);
  const [resolvedPageSize, setResolvedPageSize] = useState(10);

  const debouncedPropertiesSearch = useDebouncedValue(propertiesSearch, 500);
  const debouncedBookingRequestsSearch = useDebouncedValue(bookingRequestsSearch, 500);
  const debouncedBookingsSearch = useDebouncedValue(bookingsSearch, 500);
  const debouncedResolvedSearch = useDebouncedValue(resolvedSearch, 500);

  const updateBooking = useMutation({
    mutationFn: async ({ id, status }) => {
      setUpdatingState({ id, action: status });
      return base44.entities.Booking.update(id, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-bookings'] });
      toast.success('Booking updated');
      setUpdatingState({ id: null, action: null });
    },
    onError: () => setUpdatingState({ id: null, action: null }),
  });

  const saveAgreementConditions = useMutation({
    mutationFn: async ({ bookingId, conditions }) => {
      const { error } = await supabase
        .from('bookings')
        .update({ agreement_conditions: conditions, updated_date: new Date().toISOString() })
        .eq('id', bookingId);
      if (error) throw new Error(error.message);
      return { success: true };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['owner-bookings'] }),
    onError: (err) => toast.error(`Failed to save agreement: ${err.message}`),
  });

  const approveAndSendLease = useMutation({
    mutationFn: async ({ bookingId, agreementConditions }) => {
      setUpdatingState({ id: bookingId, action: 'approve' });
      await saveAgreementConditions.mutateAsync({ bookingId, conditions: agreementConditions });
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'lease_pending', lease_status: 'pending_renter', updated_date: new Date().toISOString() })
        .eq('id', bookingId);
      if (error) throw new Error(error.message);
      const res = await supabase.functions.invoke('anvil-send-lease', { body: { bookingId, agreementConditions } });
      if (res.error) throw new Error(res.error.message || 'Unknown error');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-bookings'] });
      toast.success('Booking approved and lease agreement sent!');
      setUpdatingState({ id: null, action: null });
      setEditingBookingId(null);
      setAgreementData(null);
    },
    onError: (err) => {
      toast.error(`Failed to approve booking: ${err.message}`);
      setUpdatingState({ id: null, action: null });
    },
  });

  const updateAndResendLease = useMutation({
    mutationFn: async ({ bookingId, agreementConditions }) => {
      setUpdatingState({ id: bookingId, action: 'update' });
      await saveAgreementConditions.mutateAsync({ bookingId, conditions: agreementConditions });
      const res = await supabase.functions.invoke('anvil-send-lease', { body: { bookingId, agreementConditions } });
      if (res.error) throw new Error(res.error.message || 'Unknown error');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-bookings'] });
      toast.success('Agreement updated and resent!');
      setUpdatingState({ id: null, action: null });
      setEditingAgreementId(null);
      setEditingAgreementData(null);
    },
    onError: (err) => {
      toast.error(`Failed to update agreement: ${err.message}`);
      setUpdatingState({ id: null, action: null });
    },
  });

  const listingMap = Object.fromEntries(myListings.map(l => [l.id, l]));
  const allListingMap = Object.fromEntries(allListings.map(l => [l.id, l]));

  const filteredProperties = myListings.filter(listing => {
    const query = debouncedPropertiesSearch.trim().toLowerCase();
    if (!query) return true;
    return [listing.title, listing.address, listing.neighborhood]
      .filter(Boolean)
      .some(value => value.toLowerCase().includes(query));
  });
  const propertiesTotalPages = Math.max(1, Math.ceil(filteredProperties.length / propertiesPageSize));
  const paginatedProperties = filteredProperties.slice((propertiesPage - 1) * propertiesPageSize, propertiesPage * propertiesPageSize);

  const bookingMatchesQuery = (booking, query) => {
    if (!query) return true;
    const q = query.trim().toLowerCase();
    const listing = listingMap[booking.listing_id] || allListingMap[booking.listing_id];
    const renter = renterProfileMap[booking.renter_id];
    return [
      listing?.title,
      renter?.full_name,
      renter?.email,
      booking.status,
      booking.agent_email,
    ]
      .filter(Boolean)
      .some(value => value.toLowerCase().includes(q));
  };

  const filteredBookingRequests = allBookings.filter(b => b.status === 'pending' && bookingMatchesQuery(b, debouncedBookingRequestsSearch));
  const filteredCurrentBookings = allBookings.filter(b => ['approved', 'confirmed', 'lease_pending'].includes(b.status) && bookingMatchesQuery(b, debouncedBookingsSearch));
  const filteredResolvedBookings = allBookings.filter(b => !['pending', 'approved', 'confirmed', 'lease_pending'].includes(b.status) && bookingMatchesQuery(b, debouncedResolvedSearch));

  const bookingRequestsTotalPages = Math.max(1, Math.ceil(filteredBookingRequests.length / bookingRequestsPageSize));
  const bookingsTotalPages = Math.max(1, Math.ceil(filteredCurrentBookings.length / bookingsPageSize));
  const resolvedTotalPages = Math.max(1, Math.ceil(filteredResolvedBookings.length / resolvedPageSize));

  const paginatedBookingRequests = filteredBookingRequests.slice((bookingRequestsPage - 1) * bookingRequestsPageSize, bookingRequestsPage * bookingRequestsPageSize);
  const paginatedCurrentBookings = filteredCurrentBookings.slice((bookingsPage - 1) * bookingsPageSize, bookingsPage * bookingsPageSize);
  const paginatedResolvedBookings = filteredResolvedBookings.slice((resolvedPage - 1) * resolvedPageSize, resolvedPage * resolvedPageSize);

  useEffect(() => {
    if (propertiesPage > propertiesTotalPages) {
      setPropertiesPage(propertiesTotalPages);
    }
  }, [propertiesPage, propertiesTotalPages]);

  useEffect(() => {
    if (bookingRequestsPage > bookingRequestsTotalPages) {
      setBookingRequestsPage(bookingRequestsTotalPages);
    }
  }, [bookingRequestsPage, bookingRequestsTotalPages]);

  useEffect(() => {
    if (bookingsPage > bookingsTotalPages) {
      setBookingsPage(bookingsTotalPages);
    }
  }, [bookingsPage, bookingsTotalPages]);

  useEffect(() => {
    if (resolvedPage > resolvedTotalPages) {
      setResolvedPage(resolvedTotalPages);
    }
  }, [resolvedPage, resolvedTotalPages]);

  const pendingBookingsCount = allBookings
    .filter(b => b.status === 'pending')
    .reduce((acc, b) => {
      acc[b.listing_id] = (acc[b.listing_id] || 0) + 1;
      return acc;
    }, {});

  const listingBookingStatusMap = allBookings.reduce((acc, b) => {
    if (b.listing_id && b.status === 'confirmed') {
      acc[b.listing_id] = 'confirmed';
    }
    return acc;
  }, {});

  const totalViews = myListings.reduce((sum, l) => sum + (l.views || 0), 0);
  const pendingCount = allBookings.filter(b => b.status === 'pending').length;

  if (authLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4">
        <div className="h-9 w-64 bg-muted animate-pulse rounded-lg" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <Building2 className="w-14 h-14 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">Sign in to access your Owner Dashboard</h2>
        <Button size="lg" onClick={() => base44.auth.redirectToLogin()}>Sign In</Button>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Owner Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage your properties and booking requests</p>
        </div>
        <Link to="/submit-property">
          <Button className="gap-2"><PlusCircle className="w-4 h-4" /> Add Property</Button>
        </Link>
      </div>

      <StripeConnectBanner 
        user={user} 
        onboardingLoading={onboardingLoading} 
        handleStripeOnboard={handleStripeOnboard}
        title="Set up Stripe Payments"
        description="Connect your Stripe account to PV Verified Rentals. This enables tenants to pay rent or deposits directly to your bank account securely."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Building2} label="My Properties" value={myListings.length} color="bg-primary/10 text-primary" />
        <StatCard icon={Eye} label="Total Views" value={totalViews} color="bg-blue-100 text-blue-600" />
        <StatCard icon={TrendingUp} label="Avg. Views" value={myListings.length ? Math.round(totalViews / myListings.length) : 0} color="bg-purple-100 text-purple-600" />
        <StatCard icon={Calendar} label="Pending Requests" value={pendingCount} color="bg-amber-100 text-amber-600" />
      </div>

      <Tabs defaultValue="properties">
        <TabsList className="mb-6 flex flex-wrap gap-2 justify-start">
          <TabsTrigger value="properties" className="gap-1.5">
            <Home className="w-4 h-4" /> Properties ({myListings.length})
          </TabsTrigger>
          <TabsTrigger value="bookings" className="gap-1.5">
            <Calendar className="w-4 h-4" /> Bookings
            {pendingCount > 0 && (
              <span className="ml-1 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="inquiries" className="gap-1.5">
            <MessageSquare className="w-4 h-4" /> Inquiries ({allInquiries.length})
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-1.5">
            <CreditCard className="w-4 h-4" /> Payments ({myPayments.length})
          </TabsTrigger>
          <TabsTrigger value="availability" className="gap-1.5">
            <Lock className="w-4 h-4" /> Availability
          </TabsTrigger>
          <TabsTrigger value="referral-payments" className="gap-1.5">
            <CreditCard className="w-4 h-4" /> Referral Earnings
          </TabsTrigger>
          <TabsTrigger value="verification" className="gap-1.5">
            <ShieldCheck className="w-4 h-4" /> Verification
          </TabsTrigger>
        </TabsList>

        <TabsContent value="properties" className="pt-6">
          {listingsLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />)}
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={propertiesSearch}
                    onChange={(e) => { setPropertiesSearch(e.target.value); setPropertiesPage(1); }}
                    placeholder="Search properties by title, address, or neighborhood"
                    className="pl-10 pr-3 h-11 rounded-2xl border border-slate-200 bg-slate-50 shadow-sm focus:border-slate-300 focus:ring-2 focus:ring-primary/10"
                  />
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <label htmlFor="properties-page-size" className="font-medium">Show</label>
                  <select
                    id="properties-page-size"
                    value={propertiesPageSize}
                    onChange={(e) => { setPropertiesPageSize(Number(e.target.value)); setPropertiesPage(1); }}
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10"
                  >
                    {[10, 15, 25].map(size => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                  <span>per page</span>
                </div>
              </div>
              <PropertiesTable listings={paginatedProperties} pendingBookingsCount={pendingBookingsCount} bookingStatusMap={listingBookingStatusMap} onEdit={openEditModal} />
              {propertiesTotalPages > 1 && (
                <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground mt-4">
                  <div>Page {propertiesPage} of {propertiesTotalPages}</div>
                  <div className="inline-flex items-center gap-2">
                    <Button size="sm" variant="outline" disabled={propertiesPage === 1} onClick={() => setPropertiesPage(propertiesPage - 1)}>
                      Previous
                    </Button>
                    <Button size="sm" variant="outline" disabled={propertiesPage === propertiesTotalPages} onClick={() => setPropertiesPage(propertiesPage + 1)}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="payments" className="pt-6">
          <PaymentsReceivedTab payments={myPayments} bookings={allBookings} listings={allListings} isLoading={paymentsLoading} />
        </TabsContent>

        <TabsContent value="availability" className="pt-6">
          {listingsLoading ? (
            <div className="h-64 bg-muted animate-pulse rounded-2xl" />
          ) : (
            <AvailabilityManager listings={myListings} />
          )}
        </TabsContent>

        <TabsContent value="inquiries" className="pt-6">
          {inquiriesLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}</div>
          ) : allInquiries.length === 0 ? (
            <div className="text-center py-16">
              <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="font-semibold text-lg">No inquiries yet</p>
              <p className="text-muted-foreground text-sm mt-1">Your inquiries to agents will appear here.</p>
            </div>
          ) : (
            <InquiryKanban inquiries={allInquiries} />
          )}
        </TabsContent>

        <TabsContent value="referral-payments" className="pt-6">
          <ReferralPaymentsTab userId={user.id} userEmail={user.email} listings={allListings} />
        </TabsContent>

        <TabsContent value="verification" className="pt-6">
          <TenantVerification user={user} onUserUpdated={setUser} />
        </TabsContent>

        <TabsContent value="bookings" className="pt-6">
          {bookingsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1,2,3,4].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />)}
            </div>
          ) : allBookings.length === 0 ? (
            <div className="text-center py-16">
              <Calendar className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="font-semibold text-lg">No bookings yet</p>
              <p className="text-muted-foreground text-sm mt-1">Tenant requests and booking records will appear here.</p>
            </div>
          ) : (
            <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <Tabs value={bookingTab} onValueChange={(value) => setBookingTab(value)} className="space-y-4">
                <TabsList className="flex flex-wrap gap-2 rounded-2xl bg-slate-50 p-2">
                  <TabsTrigger value="requests" className="gap-1.5">
                    <Hourglass className="w-4 h-4" /> Booking Requests
                    <span className="ml-1 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                      {filteredBookingRequests.length}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="bookings" className="gap-1.5">
                    <CheckCircle className="w-4 h-4" /> Bookings
                    <span className="ml-1 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                      {filteredCurrentBookings.length}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="resolved" className="gap-1.5">
                    <XCircle className="w-4 h-4" /> Resolved
                    <span className="ml-1 bg-slate-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                      {filteredResolvedBookings.length}
                    </span>
                  </TabsTrigger>
                </TabsList>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="relative w-full lg:w-96">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        value={bookingTab === 'requests' ? bookingRequestsSearch : bookingTab === 'bookings' ? bookingsSearch : resolvedSearch}
                        onChange={(e) => {
                          if (bookingTab === 'requests') {
                            setBookingRequestsSearch(e.target.value);
                            setBookingRequestsPage(1);
                          } else if (bookingTab === 'bookings') {
                            setBookingsSearch(e.target.value);
                            setBookingsPage(1);
                          } else {
                            setResolvedSearch(e.target.value);
                            setResolvedPage(1);
                          }
                        }}
                        placeholder="Search bookings by tenant, property, status, or agent"
                        className="pl-10 pr-3 h-12 rounded-2xl border border-slate-200 bg-white shadow-sm focus:border-slate-300 focus:ring-2 focus:ring-primary/10"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <label htmlFor="booking-subtab-page-size" className="font-medium">Show</label>
                      <select
                        id="booking-subtab-page-size"
                        value={bookingTab === 'requests' ? bookingRequestsPageSize : bookingTab === 'bookings' ? bookingsPageSize : resolvedPageSize}
                        onChange={(e) => {
                          const newSize = Number(e.target.value);
                          if (bookingTab === 'requests') {
                            setBookingRequestsPageSize(newSize);
                            setBookingRequestsPage(1);
                          } else if (bookingTab === 'bookings') {
                            setBookingsPageSize(newSize);
                            setBookingsPage(1);
                          } else {
                            setResolvedPageSize(newSize);
                            setResolvedPage(1);
                          }
                        }}
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10"
                      >
                        {[10, 15, 25].map(size => (
                          <option key={size} value={size}>{size}</option>
                        ))}
                      </select>
                      <span>per page</span>
                    </div>
                  </div>
                </div>

                {bookingTab === 'requests' && (
                  <div>
                    {filteredBookingRequests.length > 0 ? (
                      <div className="overflow-x-auto rounded-xl border bg-white">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/50 text-left">
                              <th className="px-4 py-3 font-semibold text-muted-foreground">Tenant</th>
                              <th className="px-4 py-3 font-semibold text-muted-foreground">Property</th>
                              <th className="px-4 py-3 font-semibold text-muted-foreground">Move-in</th>
                              <th className="px-4 py-3 font-semibold text-muted-foreground">Lease</th>
                              <th className="px-4 py-3 font-semibold text-muted-foreground">Budget</th>
                              <th className="px-4 py-3 font-semibold text-muted-foreground">Agent</th>
                              <th className="px-4 py-3 font-semibold text-muted-foreground">Status</th>
                              <th className="px-4 py-3 font-semibold text-muted-foreground text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {paginatedBookingRequests.map(b => {
                              const renter = renterProfileMap[b.renter_id];
                              const listing = listingMap[b.listing_id] || allListingMap[b.listing_id];
                              const cfg = BOOKING_STATUS[b.status] || BOOKING_STATUS.pending;
                              const isEditing = editingBookingId === b.id;

                              return (
                                <React.Fragment key={b.id}>
                                  <tr className="hover:bg-muted/30 transition-colors">
                                    <td className="px-4 py-3 align-top">
                                      <div className="font-medium">{renter?.full_name || 'Anonymous'}</div>
                                      <div className="text-xs text-muted-foreground">{renter?.email || 'No email'}</div>
                                      {verifiedTenantEmails.has(renter?.email) && (
                                        <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-full text-[10px] font-semibold bg-accent/10 text-accent border border-accent/20">
                                          <ShieldCheck className="w-3 h-3" /> Verified
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                      <div className="font-medium truncate max-w-[200px]">{listing?.title || 'Unknown Property'}</div>
                                      {listing && (
                                        <Link to={`/listings/${listing.id}`} className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1">
                                          View property <ExternalLink className="w-3 h-3" />
                                        </Link>
                                      )}
                                      {b.message && (
                                        <div className="text-xs text-muted-foreground italic mt-2 max-w-[18rem]">"{b.message}"</div>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 align-top text-muted-foreground whitespace-nowrap">
                                      {format(new Date(b.move_in_date + 'T00:00:00'), 'MMM d, yyyy')}
                                    </td>
                                    <td className="px-4 py-3 align-top text-muted-foreground">
                                      {b.lease_duration_months || 12} mo
                                    </td>
                                    <td className="px-4 py-3 align-top text-muted-foreground">
                                      {b.monthly_budget_usd ? `$${b.monthly_budget_usd.toLocaleString()}` : '—'}
                                    </td>
                                    <td className="px-4 py-3 align-top text-muted-foreground">
                                      {b.agent_email || '—'}
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${cfg.cls}`}>
                                        <cfg.icon className="w-3 h-3" /> {cfg.label}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 align-top text-right space-y-2">
                                      {!isEditing ? (
                                        <div className="flex flex-col items-end gap-2">
                                          <Button
                                            size="sm"
                                            className="gap-1.5 w-full max-w-[140px] bg-green-600 hover:bg-green-700 disabled:opacity-70"
                                            onClick={() => setEditingBookingId(b.id)}
                                            disabled={updatingState?.id === b.id}
                                          >
                                            {updatingState?.id === b.id && updatingState?.action === 'approve' ? (
                                              <span className="flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Approve</span>
                                            ) : (
                                              <span className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" /> Approve</span>
                                            )}
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="destructive"
                                            className="gap-1.5 w-full max-w-[140px] disabled:opacity-70"
                                            onClick={() => updateBooking.mutate({ id: b.id, status: 'declined' })}
                                            disabled={updatingState?.id === b.id}
                                          >
                                            {updatingState?.id === b.id && updatingState?.action === 'declined' ? (
                                              <span className="flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Decline</span>
                                            ) : (
                                              <span className="flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" /> Decline</span>
                                            )}
                                          </Button>
                                        </div>
                                      ) : (
                                        <Button size="sm" variant="outline" onClick={() => setEditingBookingId(null)}>
                                          Cancel
                                        </Button>
                                      )}
                                    </td>
                                  </tr>

                                  {isEditing && !agreementData && (
                                    <tr className="bg-muted/10">
                                      <td colSpan={8} className="px-4 py-4">
                                        <LeaseDetailsForm
                                          booking={b}
                                          listing={listing}
                                          ownerProfile={{ full_name: user?.full_name || user?.email || 'Owner' }}
                                          renterProfile={renter}
                                          onSubmit={(formData) => setAgreementData(formData)}
                                          onCancel={() => {
                                            setEditingBookingId(null);
                                            setAgreementData(null);
                                          }}
                                          isSubmitting={updatingState?.id === b.id}
                                        />
                                      </td>
                                    </tr>
                                  )}

                                  {agreementData && editingBookingId === b.id && (
                                    <tr className="bg-muted/10">
                                      <td colSpan={8} className="px-4 py-4">
                                        <SignaturePad
                                          title="Owner Signature"
                                          savedSignatures={user?.signatures || []}
                                          onSave={async (signature) => {
                                            try {
                                              setUpdatingState({ id: b.id, action: 'approve' });
                                              
                                              let signatureUrl = signature;
                                              if (!signature.startsWith('http')) {
                                                const arr = signature.split(',');
                                                const mime = arr[0].match(/:(.*?);/)[1];
                                                const bstr = atob(arr[1]);
                                                let n = bstr.length;
                                                const u8arr = new Uint8Array(n);
                                                while (n--) {
                                                  u8arr[n] = bstr.charCodeAt(n);
                                                }
                                                const file = new File([u8arr], `signs/signature_owner_${b.id}.png`, { type: mime });
                                                
                                                const uploadResult = await base44.integrations.Core.UploadFile({ file });
                                                signatureUrl = uploadResult?.file_url;
                                                
                                                if (!signatureUrl) {
                                                  throw new Error('Failed to obtain signature public URL from storage.');
                                                }

                                                try {
                                                  const { data: profile } = await supabase
                                                    .from('profiles')
                                                    .select('signatures')
                                                    .eq('id', user.id)
                                                    .single();
                                                  const currentSigs = profile?.signatures || [];
                                                  if (!currentSigs.includes(signatureUrl)) {
                                                    const updatedSigs = [...currentSigs, signatureUrl].slice(-3);
                                                    await supabase
                                                      .from('profiles')
                                                      .update({ signatures: updatedSigs })
                                                      .eq('id', user.id);
                                                    setUser(prev => ({ ...prev, signatures: updatedSigs }));
                                                  }
                                                } catch (profileErr) {
                                                  console.error('Failed to append signature to profile:', profileErr);
                                                }
                                              }
                                              
                                              setOwnerSignature(signatureUrl);
                                              const finalAgreementData = {
                                                ...agreementData,
                                                landlordSignature: signatureUrl,
                                                landlordSignatureDate: new Date().toISOString().split('T')[0],
                                                tenantSignature: undefined,
                                                tenantSignatureDate: undefined
                                              };
                                              
                                              await approveAndSendLease.mutateAsync({
                                                bookingId: b.id,
                                                agreementConditions: finalAgreementData
                                              });
                                            } catch (err) {
                                              toast.error(`Signature upload or approval failed: ${err.message}`);
                                              setUpdatingState({ id: null, action: null });
                                            }
                                          }}
                                          onCancel={() => {
                                            setAgreementData(null);
                                            setEditingBookingId(null);
                                          }}
                                          isSubmitting={updatingState?.id === b.id}
                                        />
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-4 text-center">No booking requests found</p>
                    )}
                    {bookingRequestsTotalPages > 1 && (
                      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground mt-4">
                        <div>Page {bookingRequestsPage} of {bookingRequestsTotalPages}</div>
                        <div className="inline-flex items-center gap-2">
                          <Button size="sm" variant="outline" disabled={bookingRequestsPage === 1} onClick={() => setBookingRequestsPage(bookingRequestsPage - 1)}>
                            Previous
                          </Button>
                          <Button size="sm" variant="outline" disabled={bookingRequestsPage === bookingRequestsTotalPages} onClick={() => setBookingRequestsPage(bookingRequestsPage + 1)}>
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {bookingTab === 'bookings' && (
                  <div>
                    {filteredCurrentBookings.length > 0 ? (
                      <div className="overflow-x-auto rounded-xl border bg-white">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/50 text-left">
                              <th className="px-4 py-3 font-semibold text-muted-foreground">Property</th>
                              <th className="px-4 py-3 font-semibold text-muted-foreground">Tenant</th>
                              <th className="px-4 py-3 font-semibold text-muted-foreground">Move-in Date</th>
                              <th className="px-4 py-3 font-semibold text-muted-foreground">Lease</th>
                              <th className="px-4 py-3 font-semibold text-muted-foreground">Status</th>
                              <th className="px-4 py-3 font-semibold text-muted-foreground">Lease Agreement</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {paginatedCurrentBookings.map(b => {
                              const renter = renterProfileMap[b.renter_id];
                              const listing = listingMap[b.listing_id] || allListingMap[b.listing_id];
                              const statusLabel = b.status === 'lease_pending' ? 'Lease Pending' : b.status === 'approved' ? 'Approved' : 'Confirmed';
                              const statusCls = b.status === 'lease_pending' ? 'bg-blue-100 text-blue-700' : b.status === 'approved' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700';
                              return (
                                <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                                  <td className="px-4 py-3 font-medium">
                                    {listing?.title || 'Unknown Property'}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="text-sm">{renter?.full_name || 'Unknown'}</div>
                                  </td>
                                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                                    {format(new Date(b.move_in_date + 'T00:00:00'), 'MMM d, yyyy')}
                                  </td>
                                  <td className="px-4 py-3 text-muted-foreground">
                                    {b.lease_duration_months || 12} months
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${statusCls}`}>
                                      <CheckCircle className="w-3 h-3" /> {statusLabel}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    {b.lease_pdf_url ? (
                                      <div className="inline-flex items-center gap-3">
                                        <a
                                          href={b.lease_pdf_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
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
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-4 text-center">No active bookings found</p>
                    )}
                    {bookingsTotalPages > 1 && (
                      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground mt-4">
                        <div>Page {bookingsPage} of {bookingsTotalPages}</div>
                        <div className="inline-flex items-center gap-2">
                          <Button size="sm" variant="outline" disabled={bookingsPage === 1} onClick={() => setBookingsPage(bookingsPage - 1)}>
                            Previous
                          </Button>
                          <Button size="sm" variant="outline" disabled={bookingsPage === bookingsTotalPages} onClick={() => setBookingsPage(bookingsPage + 1)}>
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {bookingTab === 'resolved' && (
                  <div>
                    {filteredResolvedBookings.length > 0 ? (
                      <div className="overflow-x-auto rounded-xl border bg-white">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/50 text-left">
                              <th className="px-4 py-3 font-semibold text-muted-foreground">Property</th>
                              <th className="px-4 py-3 font-semibold text-muted-foreground">Tenant</th>
                              <th className="px-4 py-3 font-semibold text-muted-foreground">Move-in Date</th>
                              <th className="px-4 py-3 font-semibold text-muted-foreground">Lease</th>
                              <th className="px-4 py-3 font-semibold text-muted-foreground">Status</th>
                              <th className="px-4 py-3 font-semibold text-muted-foreground">Lease Agreement</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {paginatedResolvedBookings.map(b => {
                              const renter = renterProfileMap[b.renter_id];
                              const listing = listingMap[b.listing_id] || allListingMap[b.listing_id];
                              const statusLabel = b.status === 'declined' ? 'Declined' : b.status === 'cancelled' ? 'Cancelled' : b.status;
                              const statusCls = b.status === 'declined' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700';
                              return (
                                <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                                  <td className="px-4 py-3 font-medium">
                                    {listing?.title || 'Unknown Property'}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="text-sm">{renter?.full_name || 'Unknown'}</div>
                                  </td>
                                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                                    {format(new Date(b.move_in_date + 'T00:00:00'), 'MMM d, yyyy')}
                                  </td>
                                  <td className="px-4 py-3 text-muted-foreground">
                                    {b.lease_duration_months || 12} months
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${statusCls}`}>
                                      {statusLabel}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    {b.lease_pdf_url ? (
                                      <div className="inline-flex items-center gap-3">
                                        <a
                                          href={b.lease_pdf_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
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
                                      <span className="text-xs text-muted-foreground italic">None</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-4 text-center">No resolved bookings found</p>
                    )}
                    {resolvedTotalPages > 1 && (
                      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground mt-4">
                        <div>Page {resolvedPage} of {resolvedTotalPages}</div>
                        <div className="inline-flex items-center gap-2">
                          <Button size="sm" variant="outline" disabled={resolvedPage === 1} onClick={() => setResolvedPage(resolvedPage - 1)}>
                            Previous
                          </Button>
                          <Button size="sm" variant="outline" disabled={resolvedPage === resolvedTotalPages} onClick={() => setResolvedPage(resolvedPage + 1)}>
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Tabs>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {editingListing && (
        <EditPropertyModal
          listing={editingListing}
          isOpen={true}
          onClose={closeEditModal}
        />
      )}

      {/* Edit Agreement Modal */}
      {editingAgreementId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Edit Lease Agreement</h2>
              <button onClick={() => { setEditingAgreementId(null); setEditingAgreementData(null); }} className="text-muted-foreground hover:text-foreground">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            {!editingAgreementData ? (
              <div className="py-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto" />
              </div>
            ) : (
              <div className="space-y-4">
                <LeaseDetailsForm
                  booking={allBookings.find(b => b.id === editingAgreementId)}
                  listing={listingMap[allBookings.find(b => b.id === editingAgreementId)?.listing_id]}
                  ownerProfile={{ full_name: user?.full_name || user?.email || 'Owner' }}
                  renterProfile={renterProfileMap[allBookings.find(b => b.id === editingAgreementId)?.renter_id]}
                  initialData={editingAgreementData}
                  onSubmit={(formData) => {
                    setEditingAgreementData(formData);
                  }}
                  onCancel={() => { setEditingAgreementId(null); setEditingAgreementData(null); }}
                  isSubmitting={updatingState?.id === editingAgreementId}
                />
                
                {editingAgreementData && editingAgreementData.landlordName && (
                  <SignaturePad
                    title="Owner Signature (required to update)"
                    savedSignatures={user?.signatures || []}
                    onSave={async (signature) => {
                      try {
                        let signatureUrl = signature;
                        if (!signature.startsWith('http')) {
                          const arr = signature.split(',');
                          const mime = arr[0].match(/:(.*?);/)[1];
                          const bstr = atob(arr[1]);
                          let n = bstr.length;
                          const u8arr = new Uint8Array(n);
                          while (n--) {
                            u8arr[n] = bstr.charCodeAt(n);
                          }
                          const file = new File([u8arr], `signs/signature_owner_${editingAgreementId}.png`, { type: mime });
                          
                          const uploadResult = await base44.integrations.Core.UploadFile({ file });
                          signatureUrl = uploadResult?.file_url;
                          
                          if (!signatureUrl) {
                            throw new Error('Failed to obtain signature public URL from storage.');
                          }
                        }
                        
                        const finalAgreementData = {
                          ...editingAgreementData,
                          landlordSignature: signatureUrl,
                          landlordSignatureDate: new Date().toISOString().split('T')[0],
                        };
                        
                        await updateAndResendLease.mutateAsync({
                          bookingId: editingAgreementId,
                          agreementConditions: finalAgreementData
                        });
                      } catch (err) {
                        toast.error(`Update failed: ${err.message}`);
                        setUpdatingState({ id: null, action: null });
                      }
                    }}
                    onCancel={() => { setEditingAgreementId(null); setEditingAgreementData(null); }}
                    isSubmitting={updatingState?.id === editingAgreementId}
                    hideButtons={true}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
