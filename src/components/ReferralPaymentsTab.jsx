import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { CreditCard, ExternalLink, Search } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';

function useDebouncedValue(value, delay = 500) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);

  return debounced;
}

export default function ReferralPaymentsTab({ userId, userEmail, listings = [] }) {
  const listingMap = Object.fromEntries(listings.map(l => [l.id, l]));
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const debouncedSearch = useDebouncedValue(search, 500);

  const { data: referralPayments = [], isLoading } = useQuery({
    queryKey: ['referral-payments', userId, userEmail],
    queryFn: async () => {
      if (!userId) return [];
      
      // Fetch referral payments where this user is the referrer
      const { data: payments } = await supabase
        .from('referral_payments')
        .select('*')
        .eq('referrer_id', userId)
        .order('created_date', { ascending: false });
      
      // Fetch the sale_referrals to get commission_pct and client info
      if (payments && payments.length > 0) {
        const referralIds = payments.map(p => p.referral_id).filter(Boolean);
        const { data: referrals } = await supabase
          .from('sale_referrals')
          .select('id, client_name, client_email, client_phone, referral_type, commission_pct')
          .in('id', referralIds);
        
        const referralMap = Object.fromEntries((referrals || []).map(r => [r.id, r]));
        
        // Fetch payer profiles for the client names
        const payerIds = payments.map(p => p.payer_id).filter(Boolean);
        const { data: payerProfiles } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', payerIds);
        const payerMap = Object.fromEntries((payerProfiles || []).map(p => [p.id, p]));
        
        // Fetch bookings to get listing_id
        const bookingIds = payments.map(p => p.booking_id).filter(Boolean);
        const { data: bookings } = await supabase
          .from('bookings')
          .select('id, listing_id')
          .in('id', bookingIds);
        const bookingMap = Object.fromEntries((bookings || []).map(b => [b.id, b]));
        
        return payments.map(p => ({
          ...p,
          referral: referralMap[p.referral_id] || null,
          payer: payerMap[p.payer_id] || null,
          listingId: bookingMap[p.booking_id]?.listing_id || null,
        }));
      }
      
      return payments || [];
    },
    enabled: !!userId,
  });

  // Calculate total earnings
  const filteredReferralPayments = referralPayments.filter(p => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) return true;
    const listing = listingMap[p.listingId];
    return [
      listing?.title,
      p.referral?.client_name,
      p.referral?.client_email,
      p.payer?.full_name,
      p.payer?.email,
      p.referral?.referral_type,
      p.payout_status,
    ]
      .filter(Boolean)
      .some(value => value.toLowerCase().includes(query));
  });

  const totalEarnings = filteredReferralPayments
    .filter(p => p.payout_status === 'paid')
    .reduce((sum, p) => sum + (p.amount_centavos || 0), 0);

  const totalPages = Math.max(1, Math.ceil(filteredReferralPayments.length / pageSize));
  const paginatedReferralPayments = filteredReferralPayments.slice((page - 1) * pageSize, page * pageSize);

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

  if (filteredReferralPayments.length === 0) {
    return (
      <div className="text-center py-16">
        <CreditCard className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
        <p className="font-semibold text-lg">No referral earnings found</p>
        <p className="text-muted-foreground text-sm mt-1">
          Adjust your search or check back later when referral payments arrive.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search referral earnings by property, client, or status"
            className="w-full pl-10 pr-3 h-11 rounded-2xl border border-slate-200 bg-slate-50 shadow-sm focus:border-slate-300 focus:ring-2 focus:ring-primary/10"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <label htmlFor="referral-page-size" className="font-medium">Show</label>
          <select
            id="referral-page-size"
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
      {/* Summary card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Earnings</p>
              <p className="text-3xl font-bold text-emerald-600">
                ${(totalEarnings / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<span className="text-xs font-normal text-muted-foreground ml-1"> MXN</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total Commissions</p>
              <p className="text-2xl font-bold">{filteredReferralPayments.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-left">
              <th className="px-4 py-3 font-semibold text-muted-foreground">Property</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground">Client</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground">Referral Type</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground">Amount Earned</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground">Status</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginatedReferralPayments.map(p => {
              const listing = listingMap[p.listingId];
              const amountUsd = p.amount_centavos ? (p.amount_centavos / 100) : 0;
              const commissionPct = p.referral?.commission_pct || 15;
              const clientName = p.payer?.full_name || p.referral?.client_name || 'Unknown';
              const clientEmail = p.payer?.email || p.referral?.client_email || '';
              const referralType = p.referral?.referral_type === 'seller' ? 'Seller' : 'Buyer';

              return (
                <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    {listing?.title ? (
                      <Link to={`/listings/${listing.id}`} className="hover:text-primary transition-colors inline-flex items-center gap-1">
                        {listing.title} <ExternalLink className="w-3 h-3 opacity-60" />
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium">{clientName}</div>
                    {clientEmail && <div className="text-xs text-muted-foreground">{clientEmail}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      {referralType}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-emerald-600">
                    ${amountUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<span className="text-xs font-normal text-muted-foreground ml-1"> MXN</span>
                  </td>
                  <td className="px-4 py-3">
                    {p.payout_status === 'paid' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Paid
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.created_date ? format(new Date(p.created_date), 'MMM d, yyyy') : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}