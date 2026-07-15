import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/lib/supabase';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Home, MessageSquare, Eye, PlusCircle, ShieldCheck,
  Trash2, CreditCard, Star, Download, Users, Banknote, FileText, Calendar, Search
} from 'lucide-react';
import ReferralLinkCard from '@/components/referrals/ReferralLinkCard';
import AddReferralForm from '@/components/referrals/AddReferralForm';
import ReferralsList from '@/components/referrals/ReferralsList';
import PayoutRequestPanel from '@/components/payouts/PayoutRequestPanel';
import ReferralPaymentsTab from '@/components/ReferralPaymentsTab';
import InquiryKanban from '@/components/inquiries/InquiryKanban';
import StaleLeadsAlert from '@/components/inquiries/StaleLeadsAlert';
import StripeConnectBanner from '@/components/StripeConnectBanner';
import { useStripeOnboarding } from '@/hooks/useStripeOnboarding';
import TenantVerification from '@/components/profile/TenantVerification';
import {Dialog,  DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

import { format } from 'date-fns';
import { NEIGHBORHOOD_LABELS } from '@/lib/constants';
import { toast } from 'sonner';

function useDebouncedValue(value, delay = 500) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);

  return debounced;
}

export default function AgentDashboard() {
  const [user, setUser] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [inquiryTab, setInquiryTab] = useState('all');
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('agent_dashboard_active_tab') || 'listings';
  });
  const [listingsSearch, setListingsSearch] = useState('');
  const [listingsPage, setListingsPage] = useState(1);
  const [listingsPageSize, setListingsPageSize] = useState(10);
  const [bookingsSearch, setBookingsSearch] = useState('');
  const [bookingsPage, setBookingsPage] = useState(1);
  const [bookingsPageSize, setBookingsPageSize] = useState(10);
  const queryClient = useQueryClient();
  const { onboardingLoading, handleStripeOnboard } = useStripeOnboarding(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: myListings = [] } = useQuery({
    queryKey: ['agent-listings', user?.email],
    queryFn: () => base44.entities.Listing.filter({ agent_email: user.email }, '-created_date', 100),
    enabled: !!user?.email,
  });

  const { data: myListingsForInquiries = [] } = useQuery({
    queryKey: ['agent-listings-for-inquiries', user?.email],
    queryFn: () => base44.entities.Listing.filter({ agent_email: user.email }, '-created_date', 100),
    enabled: !!user?.email,
  });

  const { data: myInquiries = [] } = useQuery({
    queryKey: ['agent-inquiries', user?.email, myListingsForInquiries],
    queryFn: async () => {
      const listingIds = myListingsForInquiries.map(l => l.id);
      if (listingIds.length === 0) return [];
      const allInquiries = [];
      for (const listingId of listingIds) {
        const inquiries = await base44.entities.Inquiry.filter({ listing_id: listingId }, '-created_date', 100);
        allInquiries.push(...inquiries);
      }
      return allInquiries.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
    enabled: !!user?.email && myListingsForInquiries.length > 0,
  });

  const { data: myBookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['agent-bookings', user?.id],
    queryFn: async () => {
      console.log('=== AGENT DASHBOARD BOOKINGS QUERY ===');
      console.log('Logged in user ID:', user?.id);
      console.log('Logged in user email:', user?.email);
      
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('agent_id', user.id)
        .order('created_date', { ascending: false });
      
      console.log('Bookings query result:', { data, error, count: data?.length });
      
      if (error) {
        console.error('Bookings query error:', error);
        throw error;
      }
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: bookingProfiles = [] } = useQuery({
    queryKey: ['booking-profiles', myBookings.map(b => b.renter_id).concat(myBookings.map(b => b.owner_id)).filter(Boolean)],
    queryFn: async () => {
      if (myBookings.length === 0) return [];
      const userIds = myBookings.map(b => b.renter_id).concat(myBookings.map(b => b.owner_id)).filter(Boolean);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, phone_number')
        .in('id', userIds);
      if (error) throw error;
      return data || [];
    },
    enabled: myBookings.length > 0,
  });

  const { data: inquiryProfiles = [] } = useQuery({
    queryKey: ['inquiry-profiles', myInquiries.map(i => i.tenant_id).filter(Boolean)],
    queryFn: async () => {
      if (myInquiries.length === 0) return [];
      const userIds = [...new Set(myInquiries.map(i => i.tenant_id).filter(Boolean))];
      if (userIds.length === 0) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, phone_number')
        .in('id', userIds);
      if (error) throw error;
      return data || [];
    },
    enabled: myInquiries.length > 0,
  });

  const inquiryProfileMap = Object.fromEntries(inquiryProfiles.map(p => [p.id, p]));

  // Use myListings from base44 to build listing map (listings are stored in base44, not Supabase)
  const listingMap = Object.fromEntries(myListings.map(l => [l.id, l]));

  const profileMap = Object.fromEntries(bookingProfiles.map(p => [p.id, p]));

  const deleteListing = useMutation({
    mutationFn: (id) => base44.entities.Listing.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-listings'] });
      toast.success('Listing deleted');
    },
  });

  const exportInquiriesCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Listing', 'Message', 'Status', 'Date'];
    const rows = myInquiries.map(inq => {
      const tenant = inquiryProfileMap[inq.tenant_id] || {};
      return [
        tenant.full_name || inq.name || '',
        tenant.email || inq.email || '',
        tenant.phone_number || inq.whatsapp || '',
        inq.listing_title || '',
        (inq.message || '').replace(/"/g, '""'),
        inq.status || 'new',
        format(new Date(inq.created_date), 'MMM d, yyyy h:mm a'),
      ];
    });
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inquiries-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  };

  const totalViews = myListings.reduce((sum, l) => sum + (l.views || 0), 0);

  const stats = [
    { label: 'My Listings', value: myListings.length, icon: Home },
    { label: 'Total Views', value: totalViews, icon: Eye },
    { label: 'Inquiries', value: myInquiries.length, icon: MessageSquare },
    { label: 'Verified', value: myListings.filter(l => l.is_verified).length, icon: ShieldCheck },
  ];

  const debouncedListingsSearch = useDebouncedValue(listingsSearch, 500);
  const filteredListings = myListings.filter(listing => {
    const query = debouncedListingsSearch.trim().toLowerCase();
    if (!query) return true;
    return [listing.title, listing.address, listing.neighborhood, listing.status]
      .filter(Boolean)
      .some(value => value.toLowerCase().includes(query));
  });
  const listingsTotalPages = Math.max(1, Math.ceil(filteredListings.length / listingsPageSize));
  const paginatedListings = filteredListings.slice((listingsPage - 1) * listingsPageSize, listingsPage * listingsPageSize);

  const debouncedBookingsSearch = useDebouncedValue(bookingsSearch, 500);
  const filteredBookings = myBookings.filter(booking => {
    const query = debouncedBookingsSearch.trim().toLowerCase();
    if (!query) return true;
    const listing = listingMap[booking.listing_id];
    const owner = profileMap[booking.owner_id];
    const renter = profileMap[booking.renter_id];
    return [
      listing?.title,
      owner?.full_name,
      owner?.email,
      renter?.full_name,
      renter?.email,
      booking.status,
      booking.lease_status,
      booking.agent_email,
    ]
      .filter(Boolean)
      .some(value => value.toLowerCase().includes(query));
  });
  const bookingsTotalPages = Math.max(1, Math.ceil(filteredBookings.length / bookingsPageSize));
  const paginatedBookings = filteredBookings.slice((bookingsPage - 1) * bookingsPageSize, bookingsPage * bookingsPageSize);

  useEffect(() => {
    if (listingsPage > listingsTotalPages) {
      setListingsPage(listingsTotalPages);
    }
  }, [listingsPage, listingsTotalPages]);

  useEffect(() => {
    if (bookingsPage > bookingsTotalPages) {
      setBookingsPage(bookingsTotalPages);
    }
  }, [bookingsPage, bookingsTotalPages]);

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <StripeConnectBanner 
        user={user} 
        onboardingLoading={onboardingLoading} 
        handleStripeOnboard={handleStripeOnboard}
        title="Set up Stripe for Commissions"
        description="Connect your Stripe account to receive referral commissions and subscription payments directly to your bank account."
      />

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold tracking-tight">My Dashboard</h1>
        <div className="flex gap-2">
          <Link to="/agent-billing">
            <Button variant="outline" className="gap-2"><CreditCard className="w-4 h-4" /> Billing</Button>
          </Link>
          <Link to="/submit-property">
            <Button className="gap-2"><PlusCircle className="w-4 h-4" /> New Listing</Button>
          </Link>
        </div>
      </div>

      {/* <StaleLeadsAlert inquiries={myInquiries} agentEmail={user?.email} agentName={user?.full_name} /> */}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={(val) => {
        setActiveTab(val);
        localStorage.setItem('agent_dashboard_active_tab', val);
      }}>
        <TabsList>
          <TabsTrigger value="listings" className="gap-1"><Home className="w-4 h-4" /> My Listings</TabsTrigger>
          <TabsTrigger value="bookings" className="gap-1"><Calendar className="w-4 h-4" /> Bookings ({myBookings.length})</TabsTrigger>
          <TabsTrigger value="leads" className="gap-1"><MessageSquare className="w-4 h-4" /> Inquiries ({myInquiries.length})</TabsTrigger>
          <TabsTrigger value="referrals" className="gap-1"><Users className="w-4 h-4" /> Referrals</TabsTrigger>
          <TabsTrigger value="payouts" className="gap-1"><Banknote className="w-4 h-4" /> Payouts</TabsTrigger>
          <TabsTrigger value="verification" className="gap-1"><ShieldCheck className="w-4 h-4" /> Verification</TabsTrigger>
        </TabsList>

        <TabsContent value="listings" className="space-y-3 mt-4">
          {myListings.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">You haven't submitted any listings yet.</p>
              <Link to="/submit-property">
                <Button className="mt-4 gap-2"><PlusCircle className="w-4 h-4" /> Submit Your First Listing</Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={listingsSearch}
                    onChange={(e) => { setListingsSearch(e.target.value); setListingsPage(1); }}
                    placeholder="Search listings by title, neighborhood, or status"
                    className="pl-10 pr-3 h-11 rounded-2xl border border-slate-200 bg-slate-50 shadow-sm focus:border-slate-300 focus:ring-2 focus:ring-primary/10"
                  />
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <label htmlFor="listings-page-size" className="font-medium">Show</label>
                  <select
                    id="listings-page-size"
                    value={listingsPageSize}
                    onChange={(e) => { setListingsPageSize(Number(e.target.value)); setListingsPage(1); }}
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10"
                  >
                    {[10, 15, 25].map(size => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                  <span>per page</span>
                </div>
              </div>

              {filteredListings.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No listings match your search.</div>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-xl border bg-white">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 text-left">
                          <th className="px-4 py-3 font-semibold text-muted-foreground">Property</th>
                          <th className="px-4 py-3 font-semibold text-muted-foreground">Neighborhood</th>
                          <th className="px-4 py-3 font-semibold text-muted-foreground">Price</th>
                          <th className="px-4 py-3 font-semibold text-muted-foreground text-center">Views</th>
                          <th className="px-4 py-3 font-semibold text-muted-foreground">Status</th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {paginatedListings.map(listing => (
                          <tr key={listing.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-medium">
                              <Link to={`/listings/${listing.id}`} className="hover:text-primary transition-colors">
                                {listing.title}
                              </Link>
                              <div className="text-xs text-muted-foreground mt-1">
                                {listing.address || NEIGHBORHOOD_LABELS[listing.neighborhood] || 'No address'}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {NEIGHBORHOOD_LABELS[listing.neighborhood] || listing.neighborhood}
                            </td>
                            <td className="px-4 py-3 font-semibold whitespace-nowrap">
                              ${listing.price_usd?.toLocaleString() || '—'}/mo
                            </td>
                            <td className="px-4 py-3 text-center font-bold">{listing.views || 0}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[listing.status] || 'bg-slate-100 text-slate-800'}`}>
                                {listing.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {!listing.is_featured && (
                                  <Link to="/agent-billing">
                                    <Button size="sm" variant="outline" className="gap-1">
                                      <Star className="w-3 h-3" /> Boost
                                    </Button>
                                  </Link>
                                )}
                                <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(listing.id)} className="gap-1">
                                  <Trash2 className="w-4 h-4" /> Delete
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {listingsTotalPages > 1 && (
                    <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground mt-4">
                      <div>Page {listingsPage} of {listingsTotalPages}</div>
                      <div className="inline-flex items-center gap-2">
                        <Button size="sm" variant="outline" disabled={listingsPage === 1} onClick={() => setListingsPage(listingsPage - 1)}>
                          Previous
                        </Button>
                        <Button size="sm" variant="outline" disabled={listingsPage === listingsTotalPages} onClick={() => setListingsPage(listingsPage + 1)}>
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

        <TabsContent value="leads" className="mt-4">
          {myInquiries.length > 0 && (
            <div className="flex justify-end mb-4">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={exportInquiriesCSV}>
                <Download className="w-3.5 h-3.5" /> Export CSV
              </Button>
            </div>
          )}
          
          <Tabs value={inquiryTab} onValueChange={setInquiryTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="all" className="gap-1.5">
                All Inquiries ({myInquiries.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              {myInquiries.length === 0 ? (
                <div className="text-center py-16">
                  <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="font-semibold text-lg">No inquiries yet</p>
                  <p className="text-muted-foreground text-sm mt-1">Tenant inquiries for your listings will appear here.</p>
                </div>
              ) : (
                <InquiryKanban inquiries={myInquiries} />
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="referrals" className="space-y-5 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <ReferralLinkCard agent={user} listings={myListings} onCodeUpdated={async () => {
              try {
                const [updated] = await base44.entities.User.filter({ id: user.id });
                if (updated) setUser(updated);
              } catch (e) {
                base44.auth.me().then(setUser).catch(() => {});
              }
            }} />
            <AddReferralForm agent={user} listings={myListings} />
          </div>
          <ReferralsList agentId={user?.id} />
        </TabsContent>

        <TabsContent value="payouts" className="mt-4">
          <div className="space-y-6">
            <PayoutRequestPanel agentId={user?.id} agentEmail={user?.email} />
            <ReferralPaymentsTab userId={user?.id} userEmail={user?.email} listings={myListings} />
          </div>
        </TabsContent>

        <TabsContent value="verification" className="mt-4">
          <TenantVerification user={user} onUserUpdated={setUser} />
        </TabsContent>

        <TabsContent value="bookings" className="mt-4">
          {bookingsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="text-center py-16">
              <Calendar className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="font-semibold text-lg">No bookings found</p>
              <p className="text-muted-foreground text-sm mt-1">Try another search or return later.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={bookingsSearch}
                    onChange={(e) => { setBookingsSearch(e.target.value); setBookingsPage(1); }}
                    placeholder="Search bookings by property, owner, tenant, or status"
                    className="pl-10 pr-3 h-11 rounded-2xl border border-slate-200 bg-slate-50 shadow-sm focus:border-slate-300 focus:ring-2 focus:ring-primary/10"
                  />
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <label htmlFor="bookings-page-size" className="font-medium">Show</label>
                  <select
                    id="bookings-page-size"
                    value={bookingsPageSize}
                    onChange={(e) => { setBookingsPageSize(Number(e.target.value)); setBookingsPage(1); }}
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
                      <th className="px-4 py-3 font-semibold text-muted-foreground">Owner</th>
                      <th className="px-4 py-3 font-semibold text-muted-foreground">Tenant</th>
                      <th className="px-4 py-3 font-semibold text-muted-foreground">Move-in Date</th>
                      <th className="px-4 py-3 font-semibold text-muted-foreground">Lease</th>
                      <th className="px-4 py-3 font-semibold text-muted-foreground">Status</th>
                      <th className="px-4 py-3 font-semibold text-muted-foreground">Agreement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedBookings.map(booking => {
                      const owner = profileMap[booking.owner_id];
                      const tenant = profileMap[booking.renter_id];
                      const listing = listingMap[booking.listing_id];
                      const leaseStatusColors = {
                        pending: 'bg-yellow-100 text-yellow-800',
                        pending_renter: 'bg-blue-100 text-blue-700',
                        generated: 'bg-purple-100 text-purple-800',
                        signed: 'bg-green-100 text-green-700',
                        approved: 'bg-emerald-100 text-emerald-700',
                        confirmed: 'bg-teal-100 text-teal-800',
                      };
                      return (
                        <tr key={booking.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium">
                            {listing?.title || 'Unknown Property'}
                            {listing?.address && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {listing.address}, {listing?.city}, {listing?.state}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm">{owner?.full_name || 'Unknown'}</div>
                            <div className="text-xs text-muted-foreground">{owner?.email || ''}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm">{tenant?.full_name || 'Unknown'}</div>
                            <div className="text-xs text-muted-foreground">{tenant?.email || ''}</div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {booking.move_in_date ? format(new Date(booking.move_in_date + 'T00:00:00'), 'MMM d, yyyy') : 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {booking.lease_duration_months || 12} months
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${leaseStatusColors[booking.lease_status] || 'bg-gray-100 text-gray-800'}`}>
                              {booking.lease_status || 'pending'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {booking.lease_pdf_url ? (
                              <div className="inline-flex items-center gap-3">
                                <a
                                  href={booking.lease_pdf_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                                >
                                  <FileText className="w-3.5 h-3.5" /> View
                                </a>
                                <a
                                  href={booking.lease_pdf_url}
                                  download={`lease_${booking.id}.pdf`}
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
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Listing</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this listing? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { deleteListing.mutate(deleteTarget); setDeleteTarget(null); }}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}