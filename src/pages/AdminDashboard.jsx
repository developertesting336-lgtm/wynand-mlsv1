import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/lib/supabase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Home, Users, ShieldCheck, Eye, Star, FileText, CreditCard, Calendar, Search,
  ExternalLink, MapPin, BarChart3, Building2
} from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AdminMaintenanceModal } from '@/pages/AdminDashboardModalHelper';
import { toast } from 'sonner';

function useDebouncedValue(value, delay = 500) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebounced(value);
    }, delay);

    return () => clearTimeout(timeout);
  }, [value, delay]);

  return debounced;
}

export default function AdminDashboard() {
  const queryClient = useQueryClient();

  const { data: allListings = [] } = useQuery({
    queryKey: ['admin-listings'],
    queryFn: () => base44.entities.Listing.list('-created_date', 200),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => base44.entities.User.list('-created_date', 200),
  });

  const { data: allBookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['admin-bookings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .order('created_date', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: bookingProfiles = [] } = useQuery({
    queryKey: ['admin-booking-profiles', allBookings.map(b => b.renter_id).concat(allBookings.map(b => b.owner_id)).concat(allBookings.map(b => b.agent_id)).filter(Boolean)],
    queryFn: async () => {
      if (allBookings.length === 0) return [];
      const userIds = allBookings
        .flatMap(b => [b.renter_id, b.owner_id, b.agent_id])
        .filter(Boolean);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, phone_number')
        .in('id', userIds);
      if (error) throw error;
      return data || [];
    },
    enabled: allBookings.length > 0,
  });

  const { data: allPayments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['admin-payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .order('created_date', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: platformEarnings = [], isLoading: platformEarningsLoading } = useQuery({
    queryKey: ['admin-platform-earnings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_earnings')
        .select('*')
        .order('created_date', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: allSubscriptions = [], isLoading: subscriptionsLoading } = useQuery({
    queryKey: ['admin-subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .order('created_date', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: paymentProfiles = [] } = useQuery({
    queryKey: ['admin-payment-profiles', allPayments.map(p => p.payer_id).concat(allPayments.map(p => p.payee_id)).filter(Boolean)],
    queryFn: async () => {
      if (allPayments.length === 0) return [];
      const userIds = allPayments.map(p => p.payer_id).concat(allPayments.map(p => p.payee_id)).filter(Boolean);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);
      if (error) throw error;
      return data || [];
    },
    enabled: allPayments.length > 0,
  });

  const { data: verifications = [] } = useQuery({
    queryKey: ['admin-verifications', users.map(u => u.id)],
    queryFn: async () => {
      if (users.length === 0) return [];
      const userIds = users.map(u => u.id).filter(Boolean);
      const { data, error } = await supabase
        .from('verifications')
        .select('user_id, id_verification, employment_verification, bank_statement_verification, identity_documents, bank_documents, property_documents')
        .in('user_id', userIds);
      if (error) throw error;
      return data || [];
    },
    enabled: users.length > 0,
  });

  const { data: auditLogs = [], isLoading: auditLogsLoading } = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: auditProfiles = [] } = useQuery({
    queryKey: ['admin-audit-profiles', auditLogs.map(log => log.user_id).filter(Boolean)],
    queryFn: async () => {
      const userIds = [...new Set(auditLogs.map(log => log.user_id).filter(Boolean))];
      if (userIds.length === 0) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);
      if (error) throw error;
      return data || [];
    },
    enabled: auditLogs.length > 0,
  });

  const auditProfileMap = Object.fromEntries(auditProfiles.map(p => [p.id, p]));

  const profileMap = Object.fromEntries(bookingProfiles.map(p => [p.id, p]));
  const paymentPayerMap = Object.fromEntries(paymentProfiles.map(p => [p.id, p]));
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));
  const tenantVerificationMap = Object.fromEntries(verifications.map(v => [v.user_id, v]));
  const listingMap = Object.fromEntries(allListings.map(l => [l.id, l]));
  const bookingMap = Object.fromEntries(allBookings.map(b => [b.id, b]));

  const updateListing = useMutation({
    mutationFn: async ({ id, data }) => {
      // When admin changes status, also update Supabase is_verified and last_verified_date
      const now = new Date().toISOString();
      const supabasePatch = {};

      if (data.status) {
        supabasePatch.status = data.status;
        if (data.status === 'approved') {
          supabasePatch.is_verified = true;
          supabasePatch.last_verified_date = now;
        } else if (data.status === 'rejected') {
          supabasePatch.is_verified = false;
          supabasePatch.last_verified_date = null;
        }
      }

      // Include any other fields in data for supabase update (title/address/price edits etc.)
      for (const [k, v] of Object.entries(data)) {
        if (!['status'].includes(k)) supabasePatch[k] = v;
      }

      if (Object.keys(supabasePatch).length > 0) {
        const { error } = await supabase
          .from('listings')
          .update(supabasePatch)
          .eq('id', id);
        if (error) throw error;
      }

      // Sync to base44 as well
      const base44Data = { ...data };
      if (supabasePatch.is_verified !== undefined) base44Data.is_verified = supabasePatch.is_verified;
      if (supabasePatch.last_verified_date !== undefined) base44Data.last_verified_date = supabasePatch.last_verified_date;

      return base44.entities.Listing.update(id, base44Data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
      // Invalidate paginated listings (all pages)
      queryClient.invalidateQueries({ predicate: query => Array.isArray(query.queryKey) && query.queryKey[0] === 'admin-listings-paginated' });
      toast.success('Listing updated');
    },
    onError: (err) => {
      toast.error(`Failed to update listing: ${err.message || err}`);
    }
  });

  const verifyListing = useMutation({
    mutationFn: async ({ id }) => {
      const now = new Date().toISOString();
      // Update Supabase listings table
      const { error } = await supabase
        .from('listings')
        .update({ is_verified: true, last_verified_date: now })
        .eq('id', id);
      if (error) throw error;
      // Also update base44 for consistency
      try {
        await base44.entities.Listing.update(id, { is_verified: true, last_verified_date: now });
      } catch (e) {
        // non-fatal
        console.warn('base44 update failed', e);
      }
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
      toast.success('Listing verified');
    },
    onError: (err) => toast.error(`Failed to verify listing: ${err.message || err}`),
  });

  const editListing = async (listing) => {
    try {
      const newTitle = window.prompt('Edit title', listing.title || '');
      if (newTitle === null) return; // cancelled
      const newAddress = window.prompt('Edit address', listing.address || '')
      if (newAddress === null) return;
      const newPrice = window.prompt('Edit price_usd', listing.price_usd ? String(listing.price_usd) : '0');
      if (newPrice === null) return;

      const data = {
        title: newTitle,
        address: newAddress,
        price_usd: parseFloat(newPrice) || 0,
      };

      // Update Supabase first
      const { error } = await supabase
        .from('listings')
        .update({ title: data.title, address: data.address, price_usd: data.price_usd, updated_date: new Date().toISOString() })
        .eq('id', listing.id);
      if (error) throw error;

      // Update base44 as well for consistency
      try {
        await base44.entities.Listing.update(listing.id, data);
      } catch (e) {
        console.warn('base44 update failed', e);
      }

      queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
      toast.success('Listing updated');
    } catch (err) {
      toast.error(`Failed to update listing: ${err.message || err}`);
    }
  };

  const deleteListing = useMutation({
    mutationFn: (id) => base44.entities.Listing.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
      toast.success('Listing deleted');
    },
  });

  const [confirmAction, setConfirmAction] = useState(null); // { listing, action: 'approve' | 'reject' }
  const [confirmUserAction, setConfirmUserAction] = useState(null); // { user, verified: boolean }
  const [selectedUserDocs, setSelectedUserDocs] = useState(null); // { userName, identityDocs, bankDocs }
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('admin_dashboard_active_tab') || 'users';
  });
  const [usersSearch, setUsersSearch] = useState('');
  const [propertiesSearch, setPropertiesSearch] = useState('');
  const [bookingsSearch, setBookingsSearch] = useState('');
  const [maintenanceViewBooking, setMaintenanceViewBooking] = useState(null);
  const [paymentsSearch, setPaymentsSearch] = useState('');
  const [auditLogsSearch, setAuditLogsSearch] = useState('');
  const [auditLogsPage, setAuditLogsPage] = useState(1);
  const [auditLogsPageSize, setAuditLogsPageSize] = useState(15);

  const debouncedUsersSearch = useDebouncedValue(usersSearch, 500);
  const debouncedPropertiesSearch = useDebouncedValue(propertiesSearch, 500);
  const debouncedBookingsSearch = useDebouncedValue(bookingsSearch, 500);
  const debouncedPaymentsSearch = useDebouncedValue(paymentsSearch, 500);
  const debouncedAuditLogsSearch = useDebouncedValue(auditLogsSearch, 500);

  const updateUserVerification = useMutation({
    mutationFn: async ({ id, verified }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ id_verified: verified })
        .eq('id', id);
      if (error) throw error;

      try {
        await base44.entities.User.update(id, { id_verified: verified });
      } catch (e) {
        console.warn('base44 user update failed', e);
      }

      return { id, verified };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-verifications'] });
      toast.success(`User identity ${variables.verified ? 'verified' : 'unverified'}`);
    },
    onError: (err) => toast.error(`Failed to update user verification: ${err.message || err}`),
  });

  const updateVerificationStatus = useMutation({
    mutationFn: async ({ userId, field, status }) => {
      const { data: existing } = await supabase
        .from('verifications')
        .select('id, id_document_url')
        .eq('user_id', userId)
        .maybeSingle();

      const payload = {
        user_id: userId,
        [field]: status,
        updated_date: new Date().toISOString()
      };

      if (!existing) {
        payload.id_document_url = '';
      } else {
        payload.id = existing.id;
      }

      const { error } = await supabase
        .from('verifications')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) throw error;
      return { userId, field, status };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-verifications'] });
      toast.success('Verification status updated');
    },
    onError: (err) => toast.error(`Failed to update verification: ${err.message || err}`),
  });



  // Pagination state for properties table (uses Supabase for scalable pagination)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const [bookingsPage, setBookingsPage] = useState(1);
  const [bookingsPageSize, setBookingsPageSize] = useState(15);
  const filteredBookings = allBookings.filter(booking => {
    const query = debouncedBookingsSearch.trim().toLowerCase();
    if (!query) return true;
    const listing = listingMap[booking.listing_id];
    const owner = profileMap[booking.owner_id];
    const renter = profileMap[booking.renter_id];
    const agent = profileMap[booking.agent_id];
    return [
      listing?.title,
      owner?.full_name,
      owner?.email,
      renter?.full_name,
      renter?.email,
      agent?.full_name,
      agent?.email,
    ]
      .filter(Boolean)
      .some(value => value.toLowerCase().includes(query));
  });
  const paginatedBookings = filteredBookings.slice((bookingsPage - 1) * bookingsPageSize, bookingsPage * bookingsPageSize);
  const bookingsTotalPages = Math.max(1, Math.ceil(filteredBookings.length / bookingsPageSize));

  const [usersPage, setUsersPage] = useState(1);
  const [usersPageSize, setUsersPageSize] = useState(15);
  const filteredUsers = users.filter(u => {
    const query = debouncedUsersSearch.trim().toLowerCase();
    if (!query) return true;
    return [u.full_name, u.email]
      .filter(Boolean)
      .some(value => value.toLowerCase().includes(query));
  });
  const paginatedUsers = filteredUsers.slice((usersPage - 1) * usersPageSize, usersPage * usersPageSize);
  const usersTotalPages = Math.max(1, Math.ceil(filteredUsers.length / usersPageSize));

  const [earningsTab, setEarningsTab] = useState('platform-fees');
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsPageSize, setPaymentsPageSize] = useState(15);
  const [platformFeesPage, setPlatformFeesPage] = useState(1);
  const [platformFeesPageSize, setPlatformFeesPageSize] = useState(15);
  const [subscriptionsPage, setSubscriptionsPage] = useState(1);
  const [subscriptionsPageSize, setSubscriptionsPageSize] = useState(15);

  const filteredPayments = allPayments.filter(payment => {
    const query = debouncedPaymentsSearch.trim().toLowerCase();
    if (!query) return true;
    const payer = paymentPayerMap[payment.payer_id];
    const payee = paymentPayerMap[payment.payee_id];
    return [
      payer?.full_name,
      payer?.email,
      payee?.full_name,
      payee?.email,
      payment.payment_type,
      payment.status,
    ]
      .filter(Boolean)
      .some(value => value.toLowerCase().includes(query));
  });
  const paginatedPayments = filteredPayments.slice((paymentsPage - 1) * paymentsPageSize, paymentsPage * paymentsPageSize);
  const paymentsTotalPages = Math.max(1, Math.ceil(filteredPayments.length / paymentsPageSize));

  const filteredPlatformEarnings = platformEarnings;
  const paginatedPlatformEarnings = filteredPlatformEarnings.slice((platformFeesPage - 1) * platformFeesPageSize, platformFeesPage * platformFeesPageSize);
  const platformEarningsTotalPages = Math.max(1, Math.ceil(filteredPlatformEarnings.length / platformFeesPageSize));

  const filteredSubscriptions = allSubscriptions;
  const paginatedSubscriptions = filteredSubscriptions.slice((subscriptionsPage - 1) * subscriptionsPageSize, subscriptionsPage * subscriptionsPageSize);
  const subscriptionsTotalPages = Math.max(1, Math.ceil(filteredSubscriptions.length / subscriptionsPageSize));

  const filteredAuditLogs = auditLogs.filter(log => {
    const query = debouncedAuditLogsSearch.trim().toLowerCase();
    if (!query) return true;
    const profile = auditProfileMap[log.user_id];
    return [
      profile?.full_name,
      profile?.email,
      log.action,
      log.entity_type,
      log.entity_id,
    ]
      .filter(Boolean)
      .some(value => value.toLowerCase().includes(query));
  });
  const paginatedAuditLogs = filteredAuditLogs.slice((auditLogsPage - 1) * auditLogsPageSize, auditLogsPage * auditLogsPageSize);
  const auditLogsTotalPages = Math.max(1, Math.ceil(filteredAuditLogs.length / auditLogsPageSize));

  const totalPlatformFees = platformEarnings.reduce((sum, item) => sum + (item.amount_centavos || 0), 0);
  const totalSubscriptionRevenue = allSubscriptions.reduce((sum, item) => sum + (item.amount_centavos || 0), 0);
  const totalEarnings = totalPlatformFees + totalSubscriptionRevenue;

  const formatCurrency = (value) => (
    <>
      ${(value / 100).toFixed(2)}
      <span className="text-xs font-normal text-muted-foreground ml-1">MXN</span>
    </>
  );

  const {
    data: paginatedResult = { data: [], count: 0 },
    isLoading: paginatedLoading,
  } = useQuery({
    queryKey: ['admin-listings-paginated', page, pageSize, debouncedPropertiesSearch],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      let query = supabase
        .from('listings')
        .select('*', { count: 'exact' })
        .order('created_date', { ascending: false });
      if (propertiesSearch.trim()) {
        query = query.ilike('title', `%${propertiesSearch.trim()}%`);
      }
      const { data, error, count } = await query.range(from, to);
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
    keepPreviousData: true,
  });

  const paginatedListings = paginatedResult.data || [];
  const totalCount = paginatedResult.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const pending = allListings.filter(l => l.status === 'pending');
  const approved = allListings.filter(l => l.status === 'approved');

  const stats = [
    { label: 'Users', value: users.length, icon: Users },
    { label: 'Properties', value: allListings.length, icon: Home },
    { label: 'Bookings', value: allBookings.length, icon: Calendar },
    { label: 'Payments', value: allPayments.length, icon: CreditCard },
  ];

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold tracking-tight mb-8">Admin Dashboard</h1>

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
        localStorage.setItem('admin_dashboard_active_tab', val);
      }}>
        <TabsList className="flex w-full md:w-auto overflow-x-auto whitespace-nowrap justify-start h-auto p-1 bg-muted rounded-xl">
          <TabsTrigger value="users" className="gap-1"><Users className="w-4 h-4" /> Users ({users.length})</TabsTrigger>
          <TabsTrigger value="properties" className="gap-1"><Home className="w-4 h-4" /> Properties ({totalCount})</TabsTrigger>
          <TabsTrigger value="bookings" className="gap-1"><Calendar className="w-4 h-4" /> Bookings ({allBookings.length})</TabsTrigger>
          <TabsTrigger value="earnings" className="gap-1"><BarChart3 className="w-4 h-4" /> Earnings</TabsTrigger>
          <TabsTrigger value="payments" className="gap-1"><CreditCard className="w-4 h-4" /> Payments ({allPayments.length})</TabsTrigger>
          <TabsTrigger value="audit_logs" className="gap-1"><FileText className="w-4 h-4" /> Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="bookings" className="mt-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={bookingsSearch}
                onChange={(e) => { setBookingsSearch(e.target.value); setBookingsPage(1); }}
                placeholder="Search bookings by property, owner, renter or agent"
                className="pl-10 pr-3 h-11 rounded-2xl border border-slate-200 bg-slate-50 shadow-sm focus:border-slate-300 focus:ring-2 focus:ring-primary/10"
              />
            </div>
          </div>
          {bookingsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
            </div>
          ) : allBookings.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No bookings found</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Property</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Owner</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Tenant</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Move-in</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Status</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Lease Status</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Agreement</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Inspection Report</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Maintenance</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Move-out Report</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedBookings.map(booking => {
                    const owner = profileMap[booking.owner_id];
                    const tenant = profileMap[booking.renter_id];
                    const listing = listingMap[booking.listing_id];
                    const maintenanceCount = (booking.maintenance_requests || []).length;
                    return (
                      <tr key={booking.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{listing?.title || booking.listing_id?.slice(0, 8) || 'Unknown'}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{owner?.full_name || 'Unknown'}</div>
                          <div className="text-xs text-muted-foreground">{owner?.email || ''}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{tenant?.full_name || 'Unknown'}</div>
                          <div className="text-xs text-muted-foreground">{tenant?.email || ''}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {booking.move_in_date ? format(new Date(booking.move_in_date + 'T00:00:00'), 'MMM d, yyyy') : 'N/A'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={booking.status === 'approved' || booking.status === 'confirmed' ? 'success' : booking.status === 'declined' ? 'destructive' : 'secondary'}>
                            {booking.status || 'pending'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline">{booking.lease_status || 'pending'}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          {booking.lease_pdf_url ? (
                            <a href={booking.lease_pdf_url} target="_blank" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                              <FileText className="w-3 h-3" /> View
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {booking.inspection_report?.pdfUrl ? (
                            <a href={booking.inspection_report.pdfUrl} target="_blank" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                              <FileText className="w-3 h-3" /> View
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Pending</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {maintenanceCount > 0 ? (
                            <Button
                              size="xs"
                              variant="outline"
                              className="text-xs whitespace-nowrap px-3 py-2"
                              onClick={() => setMaintenanceViewBooking(booking)}
                            >
                              View ({maintenanceCount})
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">None</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {booking.move_out_report?.pdfUrl ? (
                            <a href={booking.move_out_report.pdfUrl} target="_blank" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                              <FileText className="w-3 h-3" /> View
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">N/A</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Show</span>
                  <select
                    className="text-sm p-1 rounded border"
                    value={bookingsPageSize}
                    onChange={(e) => { setBookingsPageSize(Number(e.target.value)); setBookingsPage(1); }}
                  >
                    <option value={1}>1</option>
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className="text-sm text-muted-foreground">per page</span>
                </div>

                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={bookingsPage <= 1 || bookingsLoading} onClick={() => setBookingsPage(p => Math.max(1, p - 1))}>Prev</Button>
                  <div className="text-sm text-muted-foreground">Page {bookingsPage} of {bookingsTotalPages}</div>
                  <Button size="sm" variant="outline" disabled={bookingsPage >= bookingsTotalPages || bookingsLoading} onClick={() => setBookingsPage(p => Math.min(bookingsTotalPages, p + 1))}>Next</Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={usersSearch}
                onChange={(e) => { setUsersSearch(e.target.value); setUsersPage(1); }}
                placeholder="Search users by name or email"
                className="pl-10 pr-3 h-11 rounded-2xl border border-slate-200 bg-slate-50 shadow-sm focus:border-slate-300 focus:ring-2 focus:ring-primary/10"
              />
            </div>
          </div>
          {users.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No users found</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Name</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Email</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Role</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground text-center">Identity</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground text-center">Employment</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground text-center">Financial Data</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground text-center">Documents</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Verified</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedUsers.map(u => {
                    const verification = tenantVerificationMap[u.id] || {};
                    return (
                      <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{u.full_name || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                        <td className="px-4 py-3">
                          <Badge variant={u.role === 'admin' ? 'default' : 'outline'}>{u.role || 'renter'}</Badge>
                        </td>
                        <td className="px-4 py-3 text-center align-middle">
                          <div className="flex items-center justify-center">
                            <select
                              className={`text-xs p-1.5 rounded-lg border font-semibold cursor-pointer shadow-sm focus:outline-none focus:ring-1 focus:ring-primary ${
                                verification.id_verification === 'approved'
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                  : verification.id_verification === 'declined'
                                    ? 'bg-rose-50 border-rose-300 text-rose-700'
                                    : 'bg-slate-50 border-slate-300 text-slate-700'
                              }`}
                              value={verification.id_verification || 'pending'}
                              onChange={(e) => updateVerificationStatus.mutate({
                                userId: u.id,
                                field: 'id_verification',
                                status: e.target.value
                              })}
                            >
                              <option value="approved">Approved</option>
                              <option value="pending">Pending</option>
                              <option value="started">Started</option>
                              <option value="declined">Declined</option>
                            </select>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center align-middle">
                          <div className="flex items-center justify-center">
                            <select
                              className={`text-xs p-1.5 rounded-lg border font-semibold cursor-pointer shadow-sm focus:outline-none focus:ring-1 focus:ring-primary ${
                                verification.employment_verification === 'approved'
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                  : verification.employment_verification === 'declined'
                                    ? 'bg-rose-50 border-rose-300 text-rose-700'
                                    : 'bg-slate-50 border-slate-300 text-slate-700'
                              }`}
                              value={verification.employment_verification || 'pending'}
                              onChange={(e) => updateVerificationStatus.mutate({
                                userId: u.id,
                                field: 'employment_verification',
                                status: e.target.value
                              })}
                            >
                              <option value="approved">Approved</option>
                              <option value="pending">Pending</option>
                              <option value="started">Started</option>
                              <option value="declined">Declined</option>
                            </select>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center align-middle">
                          <div className="flex items-center justify-center">
                            <select
                              className={`text-xs p-1.5 rounded-lg border font-semibold cursor-pointer shadow-sm focus:outline-none focus:ring-1 focus:ring-primary ${
                                verification.bank_statement_verification === 'approved'
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                  : verification.bank_statement_verification === 'declined'
                                    ? 'bg-rose-50 border-rose-300 text-rose-700'
                                    : 'bg-slate-50 border-slate-300 text-slate-700'
                              }`}
                              value={verification.bank_statement_verification || 'pending'}
                              onChange={(e) => updateVerificationStatus.mutate({
                                userId: u.id,
                                field: 'bank_statement_verification',
                                status: e.target.value
                              })}
                            >
                              <option value="approved">Approved</option>
                              <option value="pending">Pending</option>
                              <option value="started">Started</option>
                              <option value="declined">Declined</option>
                            </select>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center align-middle">
                          <div className="flex items-center justify-center">
                            {((verification.identity_documents && verification.identity_documents.length > 0) ||
                              (verification.bank_documents && verification.bank_documents.length > 0) ||
                              (verification.property_documents && verification.property_documents.length > 0)) ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 gap-1"
                                onClick={() => setSelectedUserDocs({
                                  userName: u.full_name || u.email,
                                  userEmail: u.email,
                                  identityDocs: verification.identity_documents || [],
                                  bankDocs: verification.bank_documents || [],
                                  propertyDocs: verification.property_documents || []
                                })}
                              >
                                <Eye className="w-3.5 h-3.5" /> View ({ 
                                  (verification.identity_documents?.length || 0) + 
                                  (verification.bank_documents?.length || 0) + 
                                  (verification.property_documents?.length || 0) 
                                })
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">None</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <select
                              className="text-xs p-1 rounded border cursor-pointer"
                              value={u.id_verified ? 'verified' : 'unverified'}
                              onChange={(e) => {
                                const verified = e.target.value === 'verified';
                                setConfirmUserAction({ user: u, verified });
                              }}
                            >
                              <option value="verified">Verified</option>
                              <option value="unverified">Unverified</option>
                            </select>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Show</span>
                  <select
                    className="text-sm p-1 rounded border"
                    value={usersPageSize}
                    onChange={(e) => { setUsersPageSize(Number(e.target.value)); setUsersPage(1); }}
                  >
                    <option value={1}>1</option>
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className="text-sm text-muted-foreground">per page</span>
                </div>

                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={usersPage <= 1} onClick={() => setUsersPage(p => Math.max(1, p - 1))}>Prev</Button>
                  <div className="text-sm text-muted-foreground">Page {usersPage} of {usersTotalPages}</div>
                  <Button size="sm" variant="outline" disabled={usersPage >= usersTotalPages} onClick={() => setUsersPage(p => Math.min(usersTotalPages, p + 1))}>Next</Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="properties" className="mt-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={propertiesSearch}
                onChange={(e) => { setPropertiesSearch(e.target.value); setPage(1); }}
                placeholder="Search properties by title"
                className="pl-10 pr-3 h-11 rounded-2xl border border-slate-200 bg-slate-50 shadow-sm focus:border-slate-300 focus:ring-2 focus:ring-primary/10"
              />
            </div>
          </div>
          {allListings.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No properties found</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Title</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Address</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Owner</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Price</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Status</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedListings.map(listing => (
                    <tr key={listing.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{listing.title}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {listing.address ? (
                          <a
                            href={listing.latitude && listing.longitude ?
                              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${listing.latitude},${listing.longitude}`)}` :
                              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(listing.address)}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:underline text-primary"
                          >
                            <MapPin className="w-3 h-3" /> {listing.address}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">{listing.neighborhood || '—'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">{listing.owner_name || 'Unknown'}</div>
                        <div className="text-xs text-muted-foreground">{listing.owner_email || ''}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        ${listing.price_mxn || listing.price_usd}
                        <span className="text-xs font-normal text-muted-foreground ml-1">MXN</span>/mo
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Badge>{listing.status}</Badge>
                          {listing.is_verified && <ShieldCheck className="w-3 h-3 text-accent" />}
                          {listing.is_featured && <Star className="w-3 h-3 text-amber-500" />}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <select
                            className="text-xs p-1 rounded border cursor-pointer"
                            value={listing.is_verified ? 'approve' : 'reject'}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === 'approve' || v === 'reject') {
                                setConfirmAction({ listing, action: v });
                              }
                            }}
                          >
                            <option value="approve">Approve</option>
                            <option value="reject">Disapprove</option>
                          </select>
                          {listing.is_verified && (
                            <span className="text-xs text-muted-foreground">Verified{listing.last_verified_date ? ` • ${format(new Date(listing.last_verified_date), 'MMM d, yyyy')}` : ''}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Show</span>
                  <select
                    className="text-sm p-1 rounded border"
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  >
                    <option value={1}>1</option>
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className="text-sm text-muted-foreground">per page</span>
                </div>

                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1 || paginatedLoading} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</Button>
                  <div className="text-sm text-muted-foreground">Page {page} of {totalPages}</div>
                  <Button size="sm" variant="outline" disabled={page >= totalPages || paginatedLoading} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="earnings" className="mt-4">
          <div className="grid gap-4 mb-6 md:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Total earnings</p>
                <p className="text-3xl font-bold mt-3">{formatCurrency(totalEarnings)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Platform fees</p>
                <p className="text-3xl font-bold mt-3">{formatCurrency(totalPlatformFees)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Subscription revenue</p>
                <p className="text-3xl font-bold mt-3">{formatCurrency(totalSubscriptionRevenue)}</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="platform-fees" value={earningsTab} onValueChange={setEarningsTab}>
            <TabsList className="flex w-full md:w-auto overflow-x-auto whitespace-nowrap justify-start h-auto p-1 bg-muted rounded-xl">
              <TabsTrigger value="platform-fees" className="gap-1">Platform Fees ({platformEarnings.length})</TabsTrigger>
              <TabsTrigger value="subscriptions" className="gap-1">Subscriptions ({allSubscriptions.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="platform-fees" className="mt-4">
              {platformEarningsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
                </div>
              ) : platformEarnings.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No platform earnings records found</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border bg-white">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-left">
                        <th className="px-4 py-3 font-semibold text-muted-foreground">Date</th>
                        <th className="px-4 py-3 font-semibold text-muted-foreground">Property</th>
                        <th className="px-4 py-3 font-semibold text-muted-foreground">Source</th>
                        <th className="px-4 py-3 font-semibold text-muted-foreground">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {paginatedPlatformEarnings.map(item => (
                        <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{item.created_date ? format(new Date(item.created_date), 'MMM d, yyyy') : 'N/A'}</td>
                          <td className="px-4 py-3 font-medium">
                            {(() => {
                              const listingId = item.listing_id || bookingMap[item.booking_id]?.listing_id;
                              const title = listingMap[item.listing_id]?.title
                                || listingMap[bookingMap[item.booking_id]?.listing_id]?.title
                                || item.listing_id?.slice(0, 8)
                                || 'Platform fee';
                              return listingId ? (
                                <Link to={`/listings/${listingId}`} className="hover:text-primary transition-colors inline-flex items-center gap-1 font-semibold">
                                  {title} <ExternalLink className="w-3 h-3 opacity-60" />
                                </Link>
                              ) : (
                                title
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3 font-medium">Platform fees + Tax (16%)</td>
                          <td className="px-4 py-3 font-semibold text-emerald-600">{formatCurrency(item.amount_centavos || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="text-sm text-muted-foreground">Show</div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" disabled={platformFeesPage <= 1 || platformEarningsLoading} onClick={() => setPlatformFeesPage(p => Math.max(1, p - 1))}>Prev</Button>
                      <div className="text-sm text-muted-foreground">Page {platformFeesPage} of {platformEarningsTotalPages}</div>
                      <Button size="sm" variant="outline" disabled={platformFeesPage >= platformEarningsTotalPages || platformEarningsLoading} onClick={() => setPlatformFeesPage(p => Math.min(platformEarningsTotalPages, p + 1))}>Next</Button>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="subscriptions" className="mt-4">
              {subscriptionsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
                </div>
              ) : allSubscriptions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No subscription records found</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border bg-white">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-left">
                        <th className="px-4 py-3 font-semibold text-muted-foreground">Date</th>
                        <th className="px-4 py-3 font-semibold text-muted-foreground">User</th>
                        <th className="px-4 py-3 font-semibold text-muted-foreground">Status</th>
                        <th className="px-4 py-3 font-semibold text-muted-foreground">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {paginatedSubscriptions.map(item => (
                        <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{item.created_date ? format(new Date(item.created_date), 'MMM d, yyyy') : 'N/A'}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{userMap[item.user_id]?.full_name || 'Unknown'}</div>
                            <div className="text-xs text-muted-foreground">{userMap[item.user_id]?.email || item.user_email || ''}</div>
                          </td>
                          <td className="px-4 py-3"><Badge variant="outline">{item.status || 'active'}</Badge></td>
                          <td className="px-4 py-3 font-semibold text-emerald-600">{formatCurrency(item.amount_centavos || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="text-sm text-muted-foreground">Show</div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" disabled={subscriptionsPage <= 1 || subscriptionsLoading} onClick={() => setSubscriptionsPage(p => Math.max(1, p - 1))}>Prev</Button>
                      <div className="text-sm text-muted-foreground">Page {subscriptionsPage} of {subscriptionsTotalPages}</div>
                      <Button size="sm" variant="outline" disabled={subscriptionsPage >= subscriptionsTotalPages || subscriptionsLoading} onClick={() => setSubscriptionsPage(p => Math.min(subscriptionsTotalPages, p + 1))}>Next</Button>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>

        <Dialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{confirmAction?.action === 'approve' ? 'Approve Listing' : 'Disapprove Listing'}</DialogTitle>
              <DialogDescription>
                Are you sure you want to {confirmAction?.action === 'approve' ? 'approve' : 'disapprove'} this property? This will change the property's status.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <p className="font-semibold">{confirmAction?.listing?.title}</p>
              <p className="text-xs text-muted-foreground mt-2">{confirmAction?.listing?.address || confirmAction?.listing?.neighborhood}</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
              <Button onClick={async () => {
                if (!confirmAction) return;
                const { listing, action } = confirmAction;
                try {
                  const status = action === 'approve' ? 'approved' : 'rejected';
                  await updateListing.mutateAsync({ id: listing.id, data: { status } });
                } catch (err) {
                  // mutation handles toasts
                } finally {
                  setConfirmAction(null);
                }
              }}>{confirmAction?.action === 'approve' ? 'Confirm Approve' : 'Confirm Disapprove'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!confirmUserAction} onOpenChange={(open) => { if (!open) setConfirmUserAction(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{confirmUserAction?.verified ? 'Verify User' : 'Unverify User'}</DialogTitle>
              <DialogDescription>
                Are you sure you want to {confirmUserAction?.verified ? 'verify' : 'unverify'} this user? This will update their identity verification status.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <p className="font-semibold">{confirmUserAction?.user?.full_name || confirmUserAction?.user?.email}</p>
              <p className="text-xs text-muted-foreground mt-2">{confirmUserAction?.user?.email}</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmUserAction(null)}>Cancel</Button>
              <Button onClick={async () => {
                if (!confirmUserAction) return;
                const { user, verified } = confirmUserAction;
                try {
                  await updateUserVerification.mutateAsync({ id: user.id, verified });
                } catch (err) {
                  // mutation handles toasts
                } finally {
                  setConfirmUserAction(null);
                }
              }}>{confirmUserAction?.verified ? 'Confirm Verify' : 'Confirm Unverify'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!selectedUserDocs} onOpenChange={(open) => { if (!open) setSelectedUserDocs(null); }}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Documents - {selectedUserDocs?.userName} ({selectedUserDocs?.userEmail})</DialogTitle>
              <DialogDescription>
                Review uploaded identity verification and bank documents.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-6">
              {/* Identity Documents */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-1.5 border-b pb-1.5">
                  <ShieldCheck className="w-4 h-4 text-primary" /> Identity Documents ({selectedUserDocs?.identityDocs?.length || 0})
                </h4>
                {selectedUserDocs?.identityDocs && selectedUserDocs.identityDocs.length > 0 ? (
                  <div className="space-y-4">
                    {selectedUserDocs.identityDocs.map((url, idx) => {
                      const fileExtension = url.split('.').pop()?.toLowerCase();
                      const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension);
                      const isPdf = fileExtension === 'pdf';
                      const fileName = url.split('/').pop().replace(/^\d+_\d+_(.+)$/, '$1') || `ID Document ${idx + 1}`;
                      return (
                        <div key={idx} className="border rounded-xl p-3 bg-slate-50 space-y-2">
                          <div className="flex items-center justify-between gap-4">
                            <span className="font-semibold text-xs text-slate-700 truncate max-w-[70%]">{fileName}</span>
                            <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                                <ExternalLink className="w-3 h-3" /> Open in New Tab
                              </Button>
                            </a>
                          </div>
                          <div className="flex justify-center bg-white p-2 rounded-lg border">
                            {isImage ? (
                              <img src={url} alt={fileName} className="max-w-full max-h-[300px] object-contain rounded" />
                            ) : isPdf ? (
                              <iframe src={url} title={fileName} className="w-full h-[350px] rounded border" />
                            ) : (
                              <div className="py-8 text-center text-xs text-muted-foreground">
                                No inline preview available for this file. Click the button above to view.
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic pl-6">No identity documents uploaded</p>
                )}
              </div>

              {/* Bank Documents */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-1.5 border-b pb-1.5">
                  <FileText className="w-4 h-4 text-primary" /> Bank Details & Statements ({selectedUserDocs?.bankDocs?.length || 0})
                </h4>
                {selectedUserDocs?.bankDocs && selectedUserDocs.bankDocs.length > 0 ? (
                  <div className="space-y-4">
                    {selectedUserDocs.bankDocs.map((url, idx) => {
                      const fileExtension = url.split('.').pop()?.toLowerCase();
                      const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension);
                      const isPdf = fileExtension === 'pdf';
                      const fileName = url.split('/').pop().replace(/^\d+_\d+_(.+)$/, '$1') || `Bank Document ${idx + 1}`;
                      return (
                        <div key={idx} className="border rounded-xl p-3 bg-slate-50 space-y-2">
                          <div className="flex items-center justify-between gap-4">
                            <span className="font-semibold text-xs text-slate-700 truncate max-w-[70%]">{fileName}</span>
                            <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                                <ExternalLink className="w-3 h-3" /> Open in New Tab
                              </Button>
                            </a>
                          </div>
                          <div className="flex justify-center bg-white p-2 rounded-lg border">
                            {isImage ? (
                              <img src={url} alt={fileName} className="max-w-full max-h-[300px] object-contain rounded" />
                            ) : isPdf ? (
                              <iframe src={url} title={fileName} className="w-full h-[350px] rounded border" />
                            ) : (
                              <div className="py-8 text-center text-xs text-muted-foreground">
                                No inline preview available for this file. Click the button above to view.
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic pl-6">No bank documents uploaded</p>
                )}
              </div>

              {/* Property Documents */}
              {selectedUserDocs?.propertyDocs && selectedUserDocs.propertyDocs.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-1.5 border-b pb-1.5 pt-4">
                    <Building2 className="w-4 h-4 text-primary" /> Property Documents ({selectedUserDocs.propertyDocs.length})
                  </h4>
                  <div className="space-y-4">
                    {selectedUserDocs.propertyDocs.map((url, idx) => {
                      const fileExtension = url.split('.').pop()?.toLowerCase();
                      const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension);
                      const isPdf = fileExtension === 'pdf';
                      const fileName = url.split('/').pop().replace(/^\d+_\d+_(.+)$/, '$1') || `Property Document ${idx + 1}`;
                      return (
                        <div key={idx} className="border rounded-xl p-3 bg-slate-50 space-y-2">
                          <div className="flex items-center justify-between gap-4">
                            <span className="font-semibold text-xs text-slate-700 truncate max-w-[70%]">{fileName}</span>
                            <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                                <ExternalLink className="w-3 h-3" /> Open in New Tab
                              </Button>
                            </a>
                          </div>
                          <div className="flex justify-center bg-white p-2 rounded-lg border">
                            {isImage ? (
                              <img src={url} alt={fileName} className="max-w-full max-h-[300px] object-contain rounded" />
                            ) : isPdf ? (
                              <iframe src={url} title={fileName} className="w-full h-[350px] rounded border" />
                            ) : (
                              <div className="py-8 text-center text-xs text-muted-foreground">
                                No inline preview available for this file. Click the button above to view.
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setSelectedUserDocs(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <TabsContent value="payments" className="mt-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={paymentsSearch}
                onChange={(e) => { setPaymentsSearch(e.target.value); setPaymentsPage(1); }}
                placeholder="Search payments by payer, payee or type"
                className="pl-10 pr-3 h-11 rounded-2xl border border-slate-200 bg-slate-50 shadow-sm focus:border-slate-300 focus:ring-2 focus:ring-primary/10"
              />
            </div>
          </div>
          {paymentsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
            </div>
          ) : allPayments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No payments found</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Tx ID</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Payer</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Payee</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Amount</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Status</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Payout</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedPayments.map(p => {
                    const payer = paymentPayerMap[p.payer_id];
                    const payee = paymentPayerMap[p.payee_id];
                    const amount = p.amount_centavos ? (p.amount_centavos / 100).toFixed(2) : (p.amount_mxn || 0).toFixed(2);
                    return (
                      <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{p.stripe_payment_intent_id?.slice(-8) || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{payer?.full_name || 'Unknown'}</div>
                          <div className="text-xs text-muted-foreground">{payer?.email || ''}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{payee?.full_name || 'Unknown'}</div>
                          <div className="text-xs text-muted-foreground">{payee?.email || ''}</div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-emerald-600">
                          ${amount}
                          <span className="text-xs font-normal text-muted-foreground ml-1">MXN</span>
                        </td>
                        <td className="px-4 py-3"><Badge variant="outline">{p.status || 'succeeded'}</Badge></td>
                        <td className="px-4 py-3">
                          <Badge variant={p.payout_status === 'paid' ? 'default' : 'secondary'}>{p.payout_status || 'pending'}</Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {p.created_date ? format(new Date(p.created_date), 'MMM d, yyyy') : 'N/A'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Show</span>
                  <select
                    className="text-sm p-1 rounded border"
                    value={paymentsPageSize}
                    onChange={(e) => { setPaymentsPageSize(Number(e.target.value)); setPaymentsPage(1); }}
                  >
                    <option value={1}>1</option>
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className="text-sm text-muted-foreground">per page</span>
                </div>

                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={paymentsPage <= 1 || paymentsLoading} onClick={() => setPaymentsPage(p => Math.max(1, p - 1))}>Prev</Button>
                  <div className="text-sm text-muted-foreground">Page {paymentsPage} of {paymentsTotalPages}</div>
                  <Button size="sm" variant="outline" disabled={paymentsPage >= paymentsTotalPages || paymentsLoading} onClick={() => setPaymentsPage(p => Math.min(paymentsTotalPages, p + 1))}>Next</Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="audit_logs" className="mt-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={auditLogsSearch}
                onChange={(e) => { setAuditLogsSearch(e.target.value); setAuditLogsPage(1); }}
                placeholder="Search audit logs by user, email, action, entity..."
                className="pl-10 pr-3 h-11 rounded-2xl border border-slate-200 bg-slate-50 shadow-sm focus:border-slate-300 focus:ring-2 focus:ring-primary/10"
              />
            </div>
          </div>
          {auditLogsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
            </div>
          ) : filteredAuditLogs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No audit logs found</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="px-4 py-3 font-semibold text-muted-foreground">User / Email</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Action</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Entity Type</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Entity</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Date & Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedAuditLogs.map(log => {
                    const profile = auditProfileMap[log.user_id];
                    const userName = profile?.full_name || '—';
                    const userEmail = profile?.email || 'Guest / System';
                    const formattedDate = log.created_at ? format(new Date(log.created_at), 'MMM d, yyyy hh:mm a') : 'N/A';

                    let listing = null;
                    const entityTypeLower = log.entity_type?.toLowerCase();
                    if (entityTypeLower === 'listings' || entityTypeLower === 'listing') {
                      listing = listingMap[log.entity_id];
                    } else if (entityTypeLower === 'bookings' || entityTypeLower === 'booking') {
                      const booking = bookingMap[log.entity_id];
                      if (booking) {
                        listing = listingMap[booking.listing_id];
                      }
                    }

                    return (
                      <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium">{userName}</div>
                          <div className="text-xs text-muted-foreground">{userEmail}</div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="font-mono text-xs">{log.action}</Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap capitalize">
                          {log.entity_type || '—'}
                        </td>
                        <td className="px-4 py-3 font-medium text-xs">
                          {listing ? (
                            <Link to={`/listings/${listing.id}`} target="_blank" className="text-primary hover:underline font-semibold flex items-center gap-1">
                              {listing.title} <ExternalLink className="w-3 h-3 inline" />
                            </Link>
                          ) : (
                            <span className="font-mono text-muted-foreground">{log.entity_id || '—'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {formattedDate}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Show</span>
                  <select
                    className="text-sm p-1 rounded border"
                    value={auditLogsPageSize}
                    onChange={(e) => { setAuditLogsPageSize(Number(e.target.value)); setAuditLogsPage(1); }}
                  >
                    <option value={1}>1</option>
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className="text-sm text-muted-foreground">per page</span>
                </div>

                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={auditLogsPage <= 1 || auditLogsLoading} onClick={() => setAuditLogsPage(p => Math.max(1, p - 1))}>Prev</Button>
                  <div className="text-sm text-muted-foreground">Page {auditLogsPage} of {auditLogsTotalPages}</div>
                  <Button size="sm" variant="outline" disabled={auditLogsPage >= auditLogsTotalPages || auditLogsLoading} onClick={() => setAuditLogsPage(p => Math.min(auditLogsTotalPages, p + 1))}>Next</Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
      {maintenanceViewBooking && (
        <AdminMaintenanceModal booking={maintenanceViewBooking} onClose={() => setMaintenanceViewBooking(null)} />
      )}
    </div>
  );
}