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
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Home, MessageSquare, Eye, PlusCircle, ShieldCheck,
  Trash2, CreditCard, Star, Download, Users, Banknote, FileText, Calendar, Search, Pencil, Loader2, XCircle, Hourglass, CheckCircle, ExternalLink
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
import EditPropertyModal from '@/components/owner/EditPropertyModal';
import LeaseDetailsForm from '@/components/owner/LeaseDetailsForm';
import SignaturePad from '@/components/owner/SignaturePad';

import { format } from 'date-fns';
import { NEIGHBORHOOD_LABELS } from '@/lib/constants';
import { toast } from 'sonner';

const BOOKING_STATUS = {
  pending: { label: 'Pending', icon: Hourglass, cls: 'bg-amber-100 text-amber-700' },
  lease_pending: { label: 'Lease Pending', icon: Hourglass, cls: 'bg-blue-100 text-blue-700 animate-pulse' },
  approved: { label: 'Approved & Signed', icon: CheckCircle, cls: 'bg-green-100 text-green-700' },
  declined: { label: 'Declined', icon: XCircle, cls: 'bg-red-100 text-red-700' },
};

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
  const queryClient = useQueryClient();
  const { onboardingLoading, handleStripeOnboard } = useStripeOnboarding(user);

  const [editingListing, setEditingListing] = useState(null);
  const [editingAgreementId, setEditingAgreementId] = useState(null);
  const [editingAgreementData, setEditingAgreementData] = useState(null);
  const [updatingState, setUpdatingState] = useState({ id: null, action: null });
  const [documentModalBooking, setDocumentModalBooking] = useState(null);
  const [ownerVerification, setOwnerVerification] = useState(null);
  const [renterVerification, setRenterVerification] = useState(null);
  const [agentSigningBooking, setAgentSigningBooking] = useState(null);
  const [agentSigning, setAgentSigning] = useState(false);
  const openEditModal = (listing) => setEditingListing(listing);
  const closeEditModal = () => setEditingListing(null);
  const openAgreementEdit = (booking) => {
    setEditingAgreementId(booking.id);
    setEditingAgreementData(booking.agreement_conditions || {});
  };
  const closeAgreementEdit = () => {
    setEditingAgreementId(null);
    setEditingAgreementData(null);
  };

  const canEditListing = (listing) => {
    const ownerEmail = listing.owner_email?.trim().toLowerCase();
    const agentEmail = listing.agent_email?.trim().toLowerCase();
    const userEmail = user?.email?.trim().toLowerCase();

    return (
      ownerEmail &&
      agentEmail &&
      userEmail &&
      ownerEmail === agentEmail &&
      agentEmail === userEmail
    );
  };

  const closeDocumentsModal = () => {
    setDocumentModalBooking(null);
    setOwnerVerification(null);
    setRenterVerification(null);
  };

  const normalizeBookingUserId = (value) => {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
      return value?.id || value?.user_id || value?.owner_id || value?.renter_id || null;
    }
    return null;
  };

  const openDocumentsModal = async (booking) => {
    setDocumentModalBooking(booking);
    const ownerUserId = normalizeBookingUserId(booking.owner_id) || normalizeBookingUserId(booking.owner);
    const renterUserId = normalizeBookingUserId(booking.renter_id) || normalizeBookingUserId(booking.renter);

    try {
      const ids = Array.from(new Set([ownerUserId, renterUserId].filter(Boolean)));
      if (ids.length === 0) {
        setOwnerVerification(null);
        setRenterVerification(null);
        return;
      }

      let data = null;
      let error = null;
      if (ids.length === 1) {
        ({ data, error } = await supabase.from('verifications').select('*').eq('user_id', ids[0]));
      } else {
        ({ data, error } = await supabase.from('verifications').select('*').in('user_id', ids));
      }

      if (error) {
        throw error;
      }
    console.log(data, '541452')
      const ownerVerificationRow = data?.find((row) => row.user_id === ownerUserId) || null;
      console.log(ownerVerificationRow, 'ownerVerificationRow');
      const renterVerificationRow = data?.find((row) => row.user_id === renterUserId) || null;
      setOwnerVerification(ownerVerificationRow);
      setRenterVerification(renterVerificationRow);
    } catch (err) {
      console.error('Failed to load booking verifications:', err);
      setOwnerVerification(null);
      setRenterVerification(null);
    }
  };

  const openAgentSignatureModal = (booking) => {
    setAgentSigningBooking(booking);
  };

  const closeAgentSignatureModal = () => {
    setAgentSigningBooking(null);
  };

  const normalizeVerificationDocs = (docs) => {
    if (!docs) return [];
    if (Array.isArray(docs)) return docs;
    if (typeof docs === 'string') {
      try {
        const parsed = JSON.parse(docs);
        return Array.isArray(parsed) ? parsed : [docs];
      } catch {
        return [docs];
      }
    }
    return [docs];
  };

  const isImageUrl = (url) => typeof url === 'string' && /\.(jpe?g|png|gif|webp|svg)(\?.*)?$/i.test(url);

  const ownerProfilePhotoUrl = ownerVerification?.profile_photo || ownerVerification?.profile_photo_url || ownerVerification?.photo_url;
  // console.log(ownerProfilePhotoUrl, 'ownerProfilePhotoUrl');
  const ownerIdentityDocs = normalizeVerificationDocs(ownerVerification?.identity_documents);
  const renterProfilePhotoUrl = renterVerification?.profile_photo || renterVerification?.profile_photo_url || renterVerification?.photo_url;
  const renterIdentityDocs = normalizeVerificationDocs(renterVerification?.identity_documents);

  const handleAgentSignatureSave = async (signature) => {
    if (!agentSigningBooking) return;
    setAgentSigning(true);
    try {
      let signatureUrl = signature;
      if (!signatureUrl.startsWith('http')) {
        const arr = signature.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const file = new File([u8arr], `signs/signature_agent_${agentSigningBooking.id}.png`, { type: mime });
        const uploadResult = await base44.integrations.Core.UploadFile({ file });
        signatureUrl = uploadResult?.file_url;
        if (!signatureUrl) {
          throw new Error('Failed to obtain signature public URL from storage.');
        }
      }

      if (user?.id) {
        try {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('signatures')
            .eq('id', user.id)
            .single();
          if (!profileError) {
            const currentSigs = profile?.signatures || [];
            if (!currentSigs.includes(signatureUrl)) {
              const updatedSigs = [...currentSigs, signatureUrl].slice(-3);
              await supabase.from('profiles').update({ signatures: updatedSigs }).eq('id', user.id);
            }
          }
        } catch (profileErr) {
          console.error('Failed to update agent signatures:', profileErr);
        }
      }

      const existingConditions = agentSigningBooking.agreement_conditions || {};
      const mergedConditions = {
        ...existingConditions,
        agentSignature: signatureUrl,
        agentSignatureDate: new Date().toISOString(),
      };
      const updatePayload = {
        agreement_conditions: mergedConditions,
        updated_date: new Date().toISOString(),
      };
      if (existingConditions.tenantSignature) {
        updatePayload.lease_status = 'approved';
      }

      const { error } = await supabase.from('bookings').update(updatePayload).eq('id', agentSigningBooking.id);
      if (error) throw error;

      const anvilResponse = await supabase.functions.invoke('anvil-send-lease', {
        body: {
          bookingId: agentSigningBooking.id,
          agreementConditions: mergedConditions,
          tenantSignature: existingConditions.tenantSignature,
          tenantSignatureDate: existingConditions.tenantSignatureDate,
          agentSignature: signatureUrl,
          agentSignatureDate: mergedConditions.agentSignatureDate,
        },
      });
      if (anvilResponse.error) {
        throw new Error(anvilResponse.error.message || 'Failed to regenerate lease agreement through Anvil');
      }

      toast.success('Agreement signed successfully and lease updated.');
      queryClient.invalidateQueries({ queryKey: ['agent-bookings'] });
      closeAgentSignatureModal();
    } catch (err) {
      console.error('Failed to save agent signature:', err);
      toast.error(`Failed to save signature: ${err.message}`);
    } finally {
      setAgentSigning(false);
    }
  };

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
    queryKey: ['agent-bookings', user?.id, myListings.map(l => l.id)],
    queryFn: async () => {
      console.log('=== AGENT DASHBOARD BOOKINGS QUERY ===');
      console.log('Logged in user ID:', user?.id);
      console.log('Logged in user email:', user?.email);
      
      const listingIds = myListings.map(l => l.id);
      let query = supabase.from('bookings').select('*').order('created_date', { ascending: false });
      
      if (listingIds.length > 0) {
        query = query.or(`agent_id.eq.${user.id},listing_id.in.(${listingIds.join(',')})`);
      } else {
        query = query.eq('agent_id', user.id);
      }

      const { data, error } = await query;
      
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

  const { data: verifiedUsers = [] } = useQuery({
    queryKey: ['verified-tenants'],
    queryFn: () => base44.entities.User.filter({ id_verified: true }, '-created_date', 500),
    enabled: !!user?.email,
  });
  const verifiedTenantEmails = new Set(verifiedUsers.map(u => u.email));

  const saveAgreementConditions = useMutation({
    mutationFn: async ({ bookingId, conditions }) => {
      const { error } = await supabase
        .from('bookings')
        .update({ agreement_conditions: conditions, updated_date: new Date().toISOString() })
        .eq('id', bookingId);
      if (error) throw new Error(error.message);
      return { success: true };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agent-bookings'] }),
    onError: (err) => toast.error(`Failed to save agreement: ${err.message}`),
  });

  const approveAndSendLease = useMutation({
    mutationFn: async ({ bookingId, agreementConditions }) => {
      setUpdatingState({ id: bookingId, action: 'approve' });
      await saveAgreementConditions.mutateAsync({ bookingId, conditions: agreementConditions });
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ status: 'lease_pending', lease_status: 'pending_renter', updated_date: new Date().toISOString() })
        .eq('id', bookingId);
      if (updateError) throw new Error(updateError.message);
      const res = await supabase.functions.invoke('anvil-send-lease', { body: { bookingId, agreementConditions } });
      if (res.error) throw new Error(res.error.message || 'Unknown error');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-bookings'] });
      toast.success('Booking approved and lease agreement sent!');
      setUpdatingState({ id: null, action: null });
      closeAgreementEdit();
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
      queryClient.invalidateQueries({ queryKey: ['agent-bookings'] });
      toast.success('Agreement updated and resent!');
      setUpdatingState({ id: null, action: null });
      closeAgreementEdit();
    },
    onError: (err) => {
      toast.error(`Failed to update agreement: ${err.message}`);
      setUpdatingState({ id: null, action: null });
    },
  });

  const rejectBooking = useMutation({
    mutationFn: async (bookingId) => {
      setUpdatingState({ id: bookingId, action: 'reject' });
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ status: 'declined', updated_date: new Date().toISOString() })
        .eq('id', bookingId);
      if (updateError) throw new Error(updateError.message);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-bookings'] });
      toast.success('Booking request rejected.');
      setUpdatingState({ id: null, action: null });
    },
    onError: (err) => {
      toast.error(`Failed to reject booking: ${err.message}`);
      setUpdatingState({ id: null, action: null });
    },
  });

  const isCurrentUserOwnerAndAgent = (booking) => {
    const listing = listingMap[booking?.listing_id];
    const ownerEmail = listing?.owner_email?.trim().toLowerCase();
    const agentEmail = listing?.agent_email?.trim().toLowerCase();
    const userEmail = user?.email?.trim().toLowerCase();
    return ownerEmail && agentEmail && userEmail && ownerEmail === agentEmail && ownerEmail === userEmail;
  };

  const getLeaseEndDate = (moveInDateStr, durationMonths) => {
    if (!moveInDateStr) return null;
    const moveInDate = new Date(moveInDateStr + 'T00:00:00');
    const duration = Number(durationMonths) || 12;
    moveInDate.setMonth(moveInDate.getMonth() + duration);
    return moveInDate;
  };

  const endLeaseMutation = useMutation({
    mutationFn: async (bookingId) => {
      setUpdatingState({ id: bookingId, action: 'end_lease' });
      const { error } = await supabase
        .from('bookings')
        .update({ end_lease: true, status: 'resolved', lease_status: 'ended', updated_date: new Date().toISOString() })
        .eq('id', bookingId);
      if (error) throw new Error(error.message);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booked-listing-ids'] });
      toast.success('Lease ended successfully!');
      setUpdatingState({ id: null, action: null });
    },
    onError: (err) => {
      toast.error(`Failed to end lease: ${err.message}`);
      setUpdatingState({ id: null, action: null });
    },
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

  const debouncedBookingRequestsSearch = useDebouncedValue(bookingRequestsSearch, 500);
  const debouncedBookingsSearch = useDebouncedValue(bookingsSearch, 500);
  const debouncedResolvedSearch = useDebouncedValue(resolvedSearch, 500);

  const filteredBookingRequests = myBookings.filter(booking => {
    const query = debouncedBookingRequestsSearch.trim().toLowerCase();
    if (!query) return booking.status === 'pending';
    const listing = listingMap[booking.listing_id];
    const renter = profileMap[booking.renter_id];
    const agent = profileMap[booking.owner_id];
    return booking.status === 'pending' && [
      listing?.title,
      renter?.full_name,
      renter?.email,
      listing?.address,
      booking.agent_email,
      booking.status,
    ]
      .filter(Boolean)
      .some(value => value.toLowerCase().includes(query));
  });
  const filteredCurrentBookings = myBookings.filter(booking => {
    const query = debouncedBookingsSearch.trim().toLowerCase();
    if (!query) return ['approved', 'confirmed', 'generated', 'signed', 'lease_pending'].includes(booking.status);
    const listing = listingMap[booking.listing_id];
    const owner = profileMap[booking.owner_id];
    const renter = profileMap[booking.renter_id];
    return ['approved', 'confirmed', 'generated', 'signed', 'lease_pending'].includes(booking.status) && [
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
  const filteredResolvedBookings = myBookings.filter(booking => {
    const query = debouncedResolvedSearch.trim().toLowerCase();
    if (!query) return ['resolved', 'ended', 'declined'].includes(booking.status);
    const listing = listingMap[booking.listing_id];
    const owner = profileMap[booking.owner_id];
    const renter = profileMap[booking.renter_id];
    return ['resolved', 'ended', 'declined'].includes(booking.status) && [
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

  const bookingRequestsTotalPages = Math.max(1, Math.ceil(filteredBookingRequests.length / bookingRequestsPageSize));
  const paginatedBookingRequests = filteredBookingRequests.slice((bookingRequestsPage - 1) * bookingRequestsPageSize, bookingRequestsPage * bookingRequestsPageSize);
  const bookingsTotalPages = Math.max(1, Math.ceil(filteredCurrentBookings.length / bookingsPageSize));
  const paginatedBookings = filteredCurrentBookings.slice((bookingsPage - 1) * bookingsPageSize, bookingsPage * bookingsPageSize);
  const resolvedTotalPages = Math.max(1, Math.ceil(filteredResolvedBookings.length / resolvedPageSize));
  const paginatedResolvedBookings = filteredResolvedBookings.slice((resolvedPage - 1) * resolvedPageSize, resolvedPage * resolvedPageSize);

  useEffect(() => {
    if (listingsPage > listingsTotalPages) {
      setListingsPage(listingsTotalPages);
    }
  }, [listingsPage, listingsTotalPages]);

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

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <StripeConnectBanner 
        user={user} 
        onboardingLoading={onboardingLoading} 
        handleStripeOnboard={handleStripeOnboard}
        title="Set up Your Payments"
        description="To receive payments connect your bank account through Stripe."
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
        <TabsList className="flex w-full md:w-auto overflow-x-auto whitespace-nowrap justify-start h-auto p-1 bg-muted rounded-xl">
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
                              ${listing.price_mxn?.toLocaleString() || listing.price_usd?.toLocaleString() || '—'}<span className="text-xs font-normal text-muted-foreground ml-0.5"> MXN</span>/mo
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
                                {canEditListing(listing) && (
                                  <Button size="sm" variant="outline" onClick={() => openEditModal(listing)} className="gap-1">
                                    <Pencil className="w-3.5 h-3.5" /> Edit
                                  </Button>
                                )}
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

        <TabsContent value="bookings" className="pt-6">
          {bookingsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
            </div>
          ) : myBookings.length === 0 ? (
            <div className="text-center py-16">
              <Calendar className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="font-semibold text-lg">No bookings yet</p>
              <p className="text-muted-foreground text-sm mt-1">Tenant requests and confirmed bookings will appear here.</p>
            </div>
          ) : (
            <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <Tabs value={bookingTab} onValueChange={(value) => setBookingTab(value)} className="space-y-4">
                <TabsList className="flex w-full md:w-auto overflow-x-auto whitespace-nowrap justify-start h-auto p-1 bg-muted rounded-xl">
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
                          const value = e.target.value;
                          if (bookingTab === 'requests') {
                            setBookingRequestsSearch(value);
                            setBookingRequestsPage(1);
                          } else if (bookingTab === 'bookings') {
                            setBookingsSearch(value);
                            setBookingsPage(1);
                          } else {
                            setResolvedSearch(value);
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
                              <th className="px-4 py-3 font-semibold text-muted-foreground">Property</th>
                              <th className="px-4 py-3 font-semibold text-muted-foreground">Owner</th>
                              <th className="px-4 py-3 font-semibold text-muted-foreground">Tenant</th>
                              <th className="px-4 py-3 font-semibold text-muted-foreground">Move-in</th>
                              <th className="px-4 py-3 font-semibold text-muted-foreground">Lease</th>
                              <th className="px-4 py-3 font-semibold text-muted-foreground">Status</th>
                              <th className="px-4 py-3 font-semibold text-muted-foreground text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {paginatedBookingRequests.map(b => {
                              const renter = profileMap[b.renter_id];
                              const owner = profileMap[b.owner_id];
                              const listing = listingMap[b.listing_id] || {};
                              const cfg = BOOKING_STATUS[b.status] || BOOKING_STATUS.pending;
                              return (
                                <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                                  <td className="px-4 py-3 align-top">
                                    <div className="font-medium truncate max-w-[200px]">{listing?.title || 'Unknown Property'}</div>
                                    {listing?.id && (
                                      <Link to={`/listings/${listing.id}`} className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1">
                                        View property <ExternalLink className="w-3 h-3" />
                                      </Link>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 align-top">
                                    <div className="font-medium">{owner?.full_name || 'Unknown'}</div>
                                    <div className="text-xs text-muted-foreground">{owner?.email || ''}</div>
                                  </td>
                                  <td className="px-4 py-3 align-top">
                                    <div className="font-medium">{renter?.full_name || 'Anonymous'}</div>
                                    <div className="text-xs text-muted-foreground">{renter?.email || ''}</div>
                                    {verifiedTenantEmails.has(renter?.email) && (
                                      <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent/10 text-accent border border-accent/20">
                                        <ShieldCheck className="w-3 h-3" /> Verified
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 align-top text-muted-foreground whitespace-nowrap">
                                    {b.move_in_date ? format(new Date(b.move_in_date + 'T00:00:00'), 'MMM d, yyyy') : 'N/A'}
                                  </td>
                                  <td className="px-4 py-3 align-top text-muted-foreground">
                                    {b.lease_duration_months || 12} mo
                                  </td>
                                  <td className="px-4 py-3 align-top">
                                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${cfg.cls}`}>
                                      <cfg.icon className="w-3 h-3" /> {cfg.label}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 align-top text-right space-y-2">
                                    <div className="flex flex-col items-end gap-2">
                                      {isCurrentUserOwnerAndAgent(b) ? (
                                        <div className="flex items-center gap-2">
                                          <Button
                                            size="sm"
                                            className="gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-70"
                                            onClick={() => openAgreementEdit(b)}
                                            disabled={updatingState?.id === b.id}
                                          >
                                            <span className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" /> Approve</span>
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
                                            onClick={() => rejectBooking.mutate(b.id)}
                                            disabled={updatingState?.id === b.id}
                                          >
                                            <span className="flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" /> Reject</span>
                                          </Button>
                                        </div>
                                      ) : (
                                        <span className="text-xs text-muted-foreground font-semibold">No action</span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
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
                              <th className="px-4 py-3 font-semibold text-muted-foreground">Owner</th>
                              <th className="px-4 py-3 font-semibold text-muted-foreground">Tenant</th>
                              <th className="px-4 py-3 font-semibold text-muted-foreground">Status</th>
                              <th className="px-4 py-3 font-semibold text-muted-foreground">Documents</th>
                              <th className="px-4 py-3 font-semibold text-muted-foreground">Agreement</th>
                              <th className="px-4 py-3 font-semibold text-muted-foreground text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {paginatedBookings.map(b => {
                              const owner = profileMap[b.owner_id];
                              const tenant = profileMap[b.renter_id];
                              const listing = listingMap[b.listing_id];
                              const statusLabel = b.status === 'lease_pending' ? 'Lease Pending' : b.status === 'approved' ? 'Approved' : 'Confirmed';
                              const statusCls = b.status === 'lease_pending' ? 'bg-blue-100 text-blue-700' : b.status === 'approved' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700';
                              const canEditAgreement =
                                b.agreement_conditions &&
                                !b.agreement_conditions?.tenantSignature &&
                                listing?.owner_email?.trim().toLowerCase() === listing?.agent_email?.trim().toLowerCase() &&
                                listing?.owner_email?.trim().toLowerCase() === user?.email?.trim().toLowerCase();
                              const needsAgentSignature = b.agreement_conditions && !b.agreement_conditions?.agentSignature;
                              return (
                                <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                                  <td className="px-4 py-3 font-medium">
                                    {listing?.title || 'Unknown Property'}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="text-sm">{owner?.full_name || 'Unknown'}</div>
                                    <div className="text-xs text-muted-foreground">{owner?.email || ''}</div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="text-sm">{tenant?.full_name || 'Unknown'}</div>
                                    <div className="text-xs text-muted-foreground">{tenant?.email || ''}</div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${statusCls}`}>
                                      <CheckCircle className="w-3 h-3" /> {statusLabel}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <Button size="sm" variant="outline" className="text-xs font-semibold py-1 px-2.5 h-auto whitespace-nowrap" onClick={() => openDocumentsModal(b)}>
                                      View Docs
                                    </Button>
                                  </td>
                                  <td className="px-4 py-3">
                                    {b.lease_pdf_url ? (
                                      <div className="inline-flex items-center gap-3">
                                        <a href={b.lease_pdf_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                                          <FileText className="w-3.5 h-3.5" /> View
                                        </a>
                                        <a href={b.lease_pdf_url} download={`lease_${b.id}.pdf`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary" title="Download lease">
                                          <Download className="w-3.5 h-3.5" />
                                        </a>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-muted-foreground italic">Pending...</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    {(() => {
                                      if (needsAgentSignature) {
                                        return (
                                          <Button size="sm" variant="outline" className="text-xs font-semibold py-1 px-2.5 h-auto whitespace-nowrap" onClick={() => openAgentSignatureModal(b)}>
                                            Sign Agreement
                                          </Button>
                                        );
                                      }
                                      if (!isCurrentUserOwnerAndAgent(b)) {
                                        return <span className="text-xs text-muted-foreground font-semibold">No action</span>;
                                      }
                                      if (canEditAgreement) {
                                        return (
                                          <Button size="sm" variant="outline" className="text-xs font-semibold py-1 px-2.5 h-auto whitespace-nowrap" onClick={() => openAgreementEdit(b)} disabled={updatingState?.id === b.id}>
                                            Edit Agreement
                                          </Button>
                                        );
                                      }
                                      if (b.end_lease) {
                                        return <span className="text-xs text-muted-foreground font-semibold">Lease Ended</span>;
                                      }
                                      const leaseEndDate = getLeaseEndDate(b.move_in_date, b.agreement_conditions?.leaseDuration || b.lease_duration_months);
                                      const isLeaseOver = leaseEndDate ? leaseEndDate <= new Date() : false;
                                      if (isLeaseOver) {
                                        return (
                                          <Button
                                            size="sm"
                                            variant="destructive"
                                            className="text-xs font-semibold py-1 px-2.5 h-auto whitespace-nowrap"
                                            onClick={() => endLeaseMutation.mutate(b.id)}
                                            disabled={updatingState?.id === b.id && updatingState?.action === 'end_lease'}
                                          >
                                            {updatingState?.id === b.id && updatingState?.action === 'end_lease' ? (
                                              <span className="flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Ending...</span>
                                            ) : 'End Lease'}
                                          </Button>
                                        );
                                      }
                                      return <span className="text-xs text-emerald-600 font-semibold">Lease Active</span>;
                                    })()}
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
                              <th className="px-4 py-3 font-semibold text-muted-foreground">Owner</th>
                              <th className="px-4 py-3 font-semibold text-muted-foreground">Tenant</th>
                              <th className="px-4 py-3 font-semibold text-muted-foreground">Move-in Date</th>
                              <th className="px-4 py-3 font-semibold text-muted-foreground">Lease</th>
                              <th className="px-4 py-3 font-semibold text-muted-foreground">Status</th>
                              <th className="px-4 py-3 font-semibold text-muted-foreground">Agreement</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {paginatedResolvedBookings.map(b => {
                              const owner = profileMap[b.owner_id];
                              const tenant = profileMap[b.renter_id];
                              const listing = listingMap[b.listing_id];
                              const leaseStatusColors = {
                                resolved: 'bg-slate-100 text-slate-800',
                                ended: 'bg-slate-100 text-slate-800',
                                declined: 'bg-rose-100 text-rose-800',
                              };
                              return (
                                <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                                  <td className="px-4 py-3 font-medium">{listing?.title || 'Unknown Property'}</td>
                                  <td className="px-4 py-3"><div className="text-sm">{owner?.full_name || 'Unknown'}</div><div className="text-xs text-muted-foreground">{owner?.email || ''}</div></td>
                                  <td className="px-4 py-3"><div className="text-sm">{tenant?.full_name || 'Unknown'}</div><div className="text-xs text-muted-foreground">{tenant?.email || ''}</div></td>
                                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{b.move_in_date ? format(new Date(b.move_in_date + 'T00:00:00'), 'MMM d, yyyy') : 'N/A'}</td>
                                  <td className="px-4 py-3 text-muted-foreground">{b.lease_duration_months || 12} months</td>
                                  <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${leaseStatusColors[b.status] || 'bg-slate-100 text-slate-800'}`}>{b.status || 'resolved'}</span></td>
                                  <td className="px-4 py-3">
                                    {b.lease_pdf_url ? (
                                      <div className="inline-flex items-center gap-3">
                                        <a href={b.lease_pdf_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"><FileText className="w-3.5 h-3.5" /> View</a>
                                        <a href={b.lease_pdf_url} download={`lease_${b.id}.pdf`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary" title="Download lease"><Download className="w-3.5 h-3.5" /></a>
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
      {editingListing && (
        <EditPropertyModal
          listing={editingListing}
          isOpen={true}
          onClose={closeEditModal}
        />
      )}

      {editingAgreementId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">
                {myBookings.find(b => b.id === editingAgreementId)?.status === 'pending' ? 'Create Lease Agreement' : 'Edit Lease Agreement'}
              </h2>
              <button onClick={closeAgreementEdit} className="text-muted-foreground hover:text-foreground">
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
                  booking={myBookings.find(b => b.id === editingAgreementId)}
                  listing={listingMap[myBookings.find(b => b.id === editingAgreementId)?.listing_id]}
                  ownerProfile={{ full_name: user?.full_name || user?.email || 'Agent' }}
                  renterProfile={profileMap[myBookings.find(b => b.id === editingAgreementId)?.renter_id]}
                  initialData={editingAgreementData}
                  onSubmit={(formData) => setEditingAgreementData(formData)}
                  onChange={(formData) => setEditingAgreementData(formData)}
                  onCancel={closeAgreementEdit}
                  isSubmitting={updatingState?.id === editingAgreementId}
                  hideSubmitButton={true}
                />
                {editingAgreementData && (
                  <div className="space-y-4">
                    {editingAgreementData.landlordSignature ? (
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm font-semibold text-muted-foreground">Saved Agent Signature</p>
                          <img
                            src={editingAgreementData.landlordSignature}
                            alt="Agent signature"
                            className="mt-2 h-24 rounded-md border border-slate-200 object-contain"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            className="gap-1"
                            onClick={async () => {
                              const finalAgreementData = {
                                ...editingAgreementData,
                                landlordSignatureDate: editingAgreementData.landlordSignatureDate || new Date().toISOString().split('T')[0],
                              };
                              const booking = myBookings.find(b => b.id === editingAgreementId);
                              if (isCurrentUserOwnerAndAgent(booking)) {
                                await approveAndSendLease.mutateAsync({
                                  bookingId: editingAgreementId,
                                  agreementConditions: finalAgreementData,
                                });
                              } else {
                                await updateAndResendLease.mutateAsync({
                                  bookingId: editingAgreementId,
                                  agreementConditions: finalAgreementData,
                                });
                              }
                            }}
                            disabled={updatingState?.id === editingAgreementId || !editingAgreementData.landlordName}
                          >
                            {updatingState?.id === editingAgreementId
                              ? 'Submitting...'
                              : isCurrentUserOwnerAndAgent(myBookings.find(b => b.id === editingAgreementId))
                                ? 'Approve & Send'
                                : 'Submit Changes'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <SignaturePad
                        title="Agent Signature (required to update)"
                        savedSignatures={user?.signatures || []}
                        submitLabel={isCurrentUserOwnerAndAgent(myBookings.find(b => b.id === editingAgreementId)) ? 'Approve & Send' : 'Submit Changes'}
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
                              const file = new File([u8arr], `signs/signature_agent_${editingAgreementId}.png`, { type: mime });
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
                            const booking = myBookings.find(b => b.id === editingAgreementId);
                            if (isCurrentUserOwnerAndAgent(booking)) {
                              await approveAndSendLease.mutateAsync({
                                bookingId: editingAgreementId,
                                agreementConditions: finalAgreementData,
                              });
                            } else {
                              await updateAndResendLease.mutateAsync({
                                bookingId: editingAgreementId,
                                agreementConditions: finalAgreementData,
                              });
                            }
                          } catch (err) {
                            toast.error(`Update failed: ${err.message}`);
                            setUpdatingState({ id: null, action: null });
                          }
                        }}
                        onCancel={closeAgreementEdit}
                        isSubmitting={updatingState?.id === editingAgreementId}
                        disableSubmit={!editingAgreementData.landlordName}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog open={!!documentModalBooking} onOpenChange={(open) => !open && closeDocumentsModal()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Booking Documents</DialogTitle>
            <DialogDescription>
              Review owner and renter documents for this booking.
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="owner" className="space-y-4">
            <TabsList>
              <TabsTrigger value="owner">Owner</TabsTrigger>
              <TabsTrigger value="renter">Renter</TabsTrigger>
            </TabsList>
            <TabsContent value="owner" className="space-y-4">
              <div className="grid gap-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h4 className="text-sm font-semibold mb-2">Owner Property Documents</h4>
                  {documentModalBooking?.agreement_conditions?.owner_docs?.length > 0 ? (
                    <div className="grid gap-3">
                      {documentModalBooking.agreement_conditions.owner_docs.map((doc, index) => (
                        <a key={`${doc}-${index}`} href={doc} target="_blank" rel="noreferrer noopener" className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white hover:border-primary transition">
                          {isImageUrl(doc) ? (
                            <img src={doc} alt={`Owner document ${index + 1}`} className="h-40 w-full object-contain bg-slate-100" />
                          ) : (
                            <div className="flex h-40 items-center justify-center bg-slate-100 text-slate-500">
                              <FileText className="w-8 h-8" />
                            </div>
                          )}
                          <div className="p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-medium">Owner document {index + 1}</p>
                              <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-primary" />
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-2">{doc}</p>
                          </div>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No owner agreement documents uploaded.</p>
                  )}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h4 className="text-sm font-semibold mb-2">Owner Identity & Profile</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-xs uppercase text-muted-foreground mb-2">Profile Photo</p>
                      {ownerProfilePhotoUrl ? (
                        <img src={ownerProfilePhotoUrl} alt="Owner profile" className="w-full max-w-full max-h-56 rounded-xl object-contain" />
                      ) : (
                        <p className="text-sm text-muted-foreground">No profile photo uploaded.</p>
                      )}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                      <p className="text-xs uppercase text-muted-foreground">Identity Documents</p>
                      {Array.isArray(ownerVerification?.identity_documents) && ownerVerification.identity_documents.length > 0 ? (
                        <div className="grid gap-3">
                          {ownerVerification.identity_documents.map((doc, index) => (
                            <a key={`owner-id-${index}`} href={doc} target="_blank" rel="noreferrer noopener" className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white hover:border-primary transition">
                              {isImageUrl(doc) ? (
                                <img src={doc} alt={`Owner identity ${index + 1}`} className="h-40 w-full object-contain bg-slate-100" />
                              ) : (
                                <div className="flex h-40 items-center justify-center bg-slate-100 text-slate-500">
                                  <FileText className="w-8 h-8" />
                                </div>
                              )}
                              <div className="p-4 flex items-center justify-between gap-3">
                                <p className="font-medium">Identity document {index + 1}</p>
                                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-primary" />
                              </div>
                            </a>
                          ))}
                        </div>
                      ) : ownerVerification?.id_document_url ? (
                        <a href={ownerVerification.id_document_url} target="_blank" rel="noreferrer noopener" className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white hover:border-primary transition">
                          <div className="flex h-40 items-center justify-center bg-slate-100 text-slate-500">
                            <FileText className="w-8 h-8" />
                          </div>
                          <div className="p-4 flex items-center justify-between gap-3">
                            <p className="font-medium">View primary identity document</p>
                            <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-primary" />
                          </div>
                        </a>
                      ) : (
                        <p className="text-sm text-muted-foreground">No identity documents uploaded.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="renter" className="space-y-4">
              <div className="grid gap-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h4 className="text-sm font-semibold mb-2">Renter Identity Documents</h4>
                  <div className="grid gap-2">
                    {Array.isArray(renterVerification?.identity_documents) && renterVerification.identity_documents.length > 0 ? (
                      <div className="grid gap-3">
                        {renterVerification.identity_documents.map((doc, index) => (
                          <a key={`renter-id-${index}`} href={doc} target="_blank" rel="noreferrer noopener" className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white hover:border-primary transition">
                            {isImageUrl(doc) ? (
                              <img src={doc} alt={`Renter identity ${index + 1}`} className="h-40 w-full object-contain bg-slate-100" />
                            ) : (
                              <div className="flex h-40 items-center justify-center bg-slate-100 text-slate-500">
                                <FileText className="w-8 h-8" />
                              </div>
                            )}
                            <div className="p-4 flex items-center justify-between gap-3">
                              <p className="font-medium">Identity document {index + 1}</p>
                              <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-primary" />
                            </div>
                          </a>
                        ))}
                      </div>
                    ) : renterVerification?.id_document_url ? (
                      <a href={renterVerification.id_document_url} target="_blank" rel="noreferrer noopener" className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white hover:border-primary transition">
                        <div className="flex h-40 items-center justify-center bg-slate-100 text-slate-500">
                          <FileText className="w-8 h-8" />
                        </div>
                        <div className="p-4 flex items-center justify-between gap-3">
                          <p className="font-medium">View primary identity document</p>
                          <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-primary" />
                        </div>
                      </a>
                    ) : (
                      <p className="text-sm text-muted-foreground">No identity documents uploaded.</p>
                    )}
                    {renterVerification?.employment_proof_url ? (
                      <a href={renterVerification.employment_proof_url} target="_blank" rel="noreferrer noopener" className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white hover:border-primary transition">
                        {isImageUrl(renterVerification.employment_proof_url) ? (
                          <img src={renterVerification.employment_proof_url} alt="Employment proof" className="h-40 w-full object-contain bg-slate-100" />
                        ) : (
                          <div className="flex h-40 items-center justify-center bg-slate-100 text-slate-500">
                            <FileText className="w-8 h-8" />
                          </div>
                        )}
                        <div className="p-4 flex items-center justify-between gap-3">
                          <p className="font-medium">View employment proof</p>
                          <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-primary" />
                        </div>
                      </a>
                    ) : null}
                    {Array.isArray(renterVerification?.bank_documents) && renterVerification.bank_documents.length > 0 ? (
                      <div className="grid gap-3">
                        {renterVerification.bank_documents.map((doc, index) => (
                          <a key={`bank-doc-${index}`} href={doc} target="_blank" rel="noreferrer noopener" className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white hover:border-primary transition">
                            {isImageUrl(doc) ? (
                              <img src={doc} alt={`Bank document ${index + 1}`} className="h-40 w-full object-contain bg-slate-100" />
                            ) : (
                              <div className="flex h-40 items-center justify-center bg-slate-100 text-slate-500">
                                <FileText className="w-8 h-8" />
                              </div>
                            )}
                            <div className="p-4 flex items-center justify-between gap-3">
                              <p className="font-medium">Bank document {index + 1}</p>
                              <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-primary" />
                            </div>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No bank documents available.</p>
                    )}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h4 className="text-sm font-semibold mb-2">Renter Profile Photo</h4>
                  {renterProfilePhotoUrl ? (
                    <img src={renterProfilePhotoUrl} alt="Renter profile" className="w-full max-w-full max-h-56 rounded-xl object-contain" />
                  ) : (
                    <p className="text-sm text-muted-foreground">No renter profile photo uploaded.</p>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={closeDocumentsModal}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!agentSigningBooking} onOpenChange={(open) => !open && closeAgentSignatureModal()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agent Signature</DialogTitle>
          </DialogHeader>
          <SignaturePad
            title="Agent Signature"
            submitLabel="Save Signature"
            onSave={handleAgentSignatureSave}
            onCancel={closeAgentSignatureModal}
            isSubmitting={agentSigning}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}