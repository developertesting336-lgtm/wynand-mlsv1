import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Users, Link2, UserPlus, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const VITE_EMAIL_SERVER_URL = import.meta.env.VITE_EMAIL_SERVER_URL || 'http://localhost:3001';

const STATUS_CFG = {
  pending: { label: 'Pending', cls: 'bg-amber-100 text-amber-800' },
  contacted: { label: 'Contacted', cls: 'bg-blue-100 text-blue-800' },
  converted: { label: 'Converted', cls: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-800' },
};

const TYPE_CFG = {
  rental: { label: 'Rental', cls: 'bg-primary/10 text-primary' },
  sale: { label: 'Sale', cls: 'bg-accent/10 text-accent' },
  both: { label: 'R & S', cls: 'bg-purple-100 text-purple-700' },
};

export default function ReferralsList({ agentId }) {
  const qc = useQueryClient();
  const [commissionInput, setCommissionInput] = useState({});

  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ['agent-referrals', agentId],
    queryFn: () => base44.entities.AgentReferral.filter({ agent_id: agentId }, '-created_date', 200),
    enabled: !!agentId,
  });

  const update = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AgentReferral.update(id, data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['agent-referrals'] });
      toast.success('Referral updated');

      // Email agent when lead status changes
      if (variables.data.status && agentId) {
        const referral = referrals.find(r => r.id === variables.id);
        const newStatus = variables.data.status;
        const statusLabel = STATUS_CFG[newStatus]?.label || newStatus;
        fetch(`${VITE_EMAIL_SERVER_URL}/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: referrals.find(r => r.id === variables.id)?.agent_email || '',
            subject: `Lead status updated: ${referral?.referred_name || 'Your referral'} is now "${statusLabel}"`,
            body: `
<p>Hi,</p>
<p>Your referral lead status has been updated.</p>
<table style="border-collapse:collapse;width:100%;max-width:480px">
  <tr><td style="padding:6px 0;color:#666">Client</td><td style="padding:6px 0;font-weight:600">${referral?.referred_name || '—'}</td></tr>
  <tr><td style="padding:6px 0;color:#666">Email</td><td style="padding:6px 0">${referral?.referred_email || '—'}</td></tr>
  ${referral?.listing_title ? `<tr><td style="padding:6px 0;color:#666">Listing</td><td style="padding:6px 0">${referral.listing_title}</td></tr>` : ''}
  <tr><td style="padding:6px 0;color:#666">New Status</td><td style="padding:6px 0"><strong style="color:${newStatus === 'converted' ? '#16a34a' : newStatus === 'cancelled' ? '#dc2626' : '#0ea5e9'}">${statusLabel}</strong></td></tr>
</table>
${newStatus === 'converted' ? '<p style="margin-top:16px;padding:12px;background:#f0fdf4;border-radius:8px;color:#15803d"><strong>🎉 Congratulations!</strong> This lead has been converted. You can now request a commission payout from your dashboard.</p>' : ''}
<p style="color:#888;font-size:12px;margin-top:24px">PV Verified Rentals · Puerto Vallarta</p>
              `.trim(),
            fromEmail: 'info@pvverified.com',
            fromName: 'PV Verified Rentals',
          }),
        }).catch(() => { });
      }
    },
  });

  const totalConverted = referrals.filter(r => r.status === 'converted').length;
  const totalCommission = referrals
    .filter(r => r.status === 'converted' && r.commission_amount)
    .reduce((s, r) => s + r.commission_amount, 0);

  if (isLoading) return <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>;

  if (referrals.length === 0) {
    return (
      <div className="text-center py-16">
        <Users className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
        <p className="font-semibold text-lg">No referrals yet</p>
        <p className="text-muted-foreground text-sm mt-1">
          Share your referral link or add a manual referral above to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-3 text-center">
          <p className="text-xl font-bold">{referrals.length}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-xl font-bold text-green-600">{totalConverted}</p>
          <p className="text-xs text-muted-foreground">Converted</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-xl font-bold text-accent">${totalCommission.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Commission</p>
        </CardContent></Card>
      </div>

      {/* Referral cards */}
      {referrals.map(r => {
        const st = STATUS_CFG[r.status] || STATUS_CFG.pending;
        const ty = TYPE_CFG[r.type] || TYPE_CFG.rental;
        return (
          <Card key={r.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="font-semibold text-sm">{r.referred_name || 'Unknown'}</p>
                    <Badge className={`${ty.cls} border-0 text-xs`}>{ty.label}</Badge>
                    <Badge className={`${r.source === 'link' ? 'bg-slate-100 text-slate-700' : 'bg-purple-100 text-purple-700'} border-0 text-xs gap-1`}>
                      {r.source === 'link' ? <><Link2 className="w-2.5 h-2.5" /> Link</> : <><UserPlus className="w-2.5 h-2.5" /> Manual</>}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{r.referred_email}{r.referred_phone && ` · ${r.referred_phone}`}</p>
                  {r.listing_title && <p className="text-xs text-muted-foreground mt-0.5">Listing: {r.listing_title}</p>}
                  {r.notes && <p className="text-xs italic text-muted-foreground mt-1 bg-muted/50 rounded p-1.5">"{r.notes}"</p>}
                  <p className="text-xs text-muted-foreground mt-1">{format(new Date(r.created_date), 'MMM d, yyyy')}</p>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  {/* Status dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full cursor-pointer ${st.cls}`}>
                        {st.label} <ChevronDown className="w-3 h-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {Object.entries(STATUS_CFG).map(([val, cfg]) => (
                        <DropdownMenuItem key={val} onClick={() => update.mutate({ id: r.id, data: { status: val } })}>
                          {cfg.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Commission amount (editable when converted) */}
                  {r.status === 'converted' && (
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                      <input
                        type="number"
                        placeholder="Amount"
                        className="w-24 h-7 text-xs rounded border border-input px-2 bg-background"
                        value={commissionInput[r.id] ?? (r.commission_amount || '')}
                        onChange={e => setCommissionInput(p => ({ ...p, [r.id]: e.target.value }))}
                        onBlur={e => {
                          const val = Number(e.target.value);
                          if (val !== r.commission_amount) {
                            update.mutate({ id: r.id, data: { commission_amount: val } });
                          }
                        }}
                      />
                    </div>
                  )}
                  <span className="text-xs text-muted-foreground">{r.commission_pct}% comm.</span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}