import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DollarSign, ChevronDown, Users, TrendingUp, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const VITE_EMAIL_SERVER_URL = import.meta.env.VITE_EMAIL_SERVER_URL || 'http://localhost:3001';

const STATUS_CFG = {
  pending: { label: 'Pending', cls: 'bg-amber-100 text-amber-800' },
  contacted: { label: 'Contacted', cls: 'bg-blue-100 text-blue-800' },
  in_progress: { label: 'In Progress', cls: 'bg-purple-100 text-purple-800' },
  closed_won: { label: 'Closed Won', cls: 'bg-green-100 text-green-800' },
  closed_lost: { label: 'Closed Lost', cls: 'bg-red-100 text-red-800' },
};

export default function SaleReferralsAdmin() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [salePrice, setSalePrice] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ['sale-referrals'],
    queryFn: () => base44.entities.SaleReferral.list('-created_date', 200),
  });

  const update = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SaleReferral.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sale-referrals'] });
      toast.success('Referral updated');
      setSelected(null);
    },
  });

  const handleStatusChange = (id, status) => {
    update.mutate({ id, data: { status } });
  };

  const handleCloseWon = () => {
    const price = Number(salePrice);
    const commissionAmount = price * 0.06 * 0.20; // 6% commission × 20% referral fee
    update.mutate({
      id: selected.id,
      data: {
        status: 'closed_won',
        sale_price_usd: price,
        commission_amount: commissionAmount,
        admin_notes: adminNotes,
      },
    });

    // Email referrer
    if (selected.referrer_email) {
      fetch(`${VITE_EMAIL_SERVER_URL}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selected.referrer_email,
          subject: `Great news! Your referral closed — you earned $${commissionAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}!`,
          body: `
<p>Hi ${selected.referrer_name},</p>
<p>🎉 Excellent news! The property deal for <strong>${selected.client_name}</strong> has <strong style="color:#16a34a">closed successfully</strong>.</p>
<table style="border-collapse:collapse;width:100%;max-width:480px;margin-top:12px">
  <tr><td style="padding:6px 0;color:#666">Sale Price</td><td style="font-weight:600">$${price.toLocaleString()}</td></tr>
  <tr><td style="padding:6px 0;color:#666">Your 20% Referral Fee</td><td style="font-weight:600;color:#16a34a">$${commissionAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td></tr>
</table>
<p style="margin-top:12px">Our team will contact you within 30 days to arrange payment. Thank you for your referral!</p>
<p style="color:#888;font-size:12px;margin-top:24px">PV Verified Rentals · Puerto Vallarta</p>
          `.trim(),
          fromEmail: 'noreply@pvverified.com',
          fromName: 'PV Verified Rentals',
        }),
      }).catch(() => { });
    }
  };

  const total = referrals.length;
  const won = referrals.filter(r => r.status === 'closed_won');
  const totalFees = won.reduce((s, r) => s + (r.commission_amount || 0), 0);
  const pending = referrals.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10"><Users className="w-5 h-5 text-primary" /></div>
          <div><p className="text-xl font-bold">{total}</p><p className="text-xs text-muted-foreground">Total Referrals</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-100"><ChevronDown className="w-5 h-5 text-amber-700" /></div>
          <div><p className="text-xl font-bold">{pending}</p><p className="text-xs text-muted-foreground">Pending</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-100"><CheckCircle className="w-5 h-5 text-green-700" /></div>
          <div><p className="text-xl font-bold">{won.length}</p><p className="text-xs text-muted-foreground">Closed Won</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent/10"><DollarSign className="w-5 h-5 text-accent" /></div>
          <div><p className="text-xl font-bold">${totalFees.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p><p className="text-xs text-muted-foreground">Fees Owed</p></div>
        </CardContent></Card>
      </div>

      {isLoading ? (
        <p className="text-center text-muted-foreground py-8">Loading...</p>
      ) : referrals.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No sale referrals yet</p>
      ) : (
        <div className="space-y-3">
          {referrals.map(r => {
            const cfg = STATUS_CFG[r.status] || STATUS_CFG.pending;
            return (
              <Card key={r.id}>
                <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="font-semibold">{r.client_name}</p>
                      <Badge className={`${r.referral_type === 'buyer' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'} border-0 text-xs`}>
                        {r.referral_type === 'buyer' ? '🏠 Buyer' : '💰 Seller'}
                      </Badge>
                      <Badge className={`${cfg.cls} border-0 text-xs`}>{cfg.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Referred by: <strong>{r.referrer_name}</strong> ({r.referrer_email}) · {r.referrer_type}
                    </p>
                    {r.client_email && <p className="text-xs text-muted-foreground">Client: {r.client_email}{r.client_phone && ` · ${r.client_phone}`}</p>}
                    {r.estimated_value_usd && <p className="text-xs text-muted-foreground">Est. value: ${r.estimated_value_usd.toLocaleString()}</p>}
                    {r.property_description && <p className="text-xs text-muted-foreground italic mt-1">"{r.property_description}"</p>}
                    {r.commission_amount && <p className="text-xs font-semibold text-green-700 mt-1">Fee earned: ${r.commission_amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{format(new Date(r.created_date), 'MMM d, yyyy')}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full cursor-pointer ${cfg.cls}`}>
                          {cfg.label} <ChevronDown className="w-3 h-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {Object.entries(STATUS_CFG).map(([val, c]) => (
                          <DropdownMenuItem key={val} onClick={() => val === 'closed_won' ? setSelected(r) : handleStatusChange(r.id, val)}>
                            {c.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Close Won dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Closed Won</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/40 rounded-lg text-sm space-y-1">
                <p><span className="font-medium">Client:</span> {selected.client_name}</p>
                <p><span className="font-medium">Referrer:</span> {selected.referrer_name} ({selected.referrer_email})</p>
                <p><span className="font-medium">Referral Fee:</span> 20% of 6% commission</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Final Sale Price (USD) *</label>
                <Input type="number" value={salePrice} onChange={e => setSalePrice(e.target.value)} placeholder="e.g. 500000" />
                {salePrice && (
                  <p className="text-sm text-green-700 font-semibold mt-1">
                    Referral fee = ${(Number(salePrice) * 0.06 * 0.20).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Admin Notes</label>
                <Textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} placeholder="Any notes..." rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button disabled={!salePrice || update.isPending} onClick={handleCloseWon} className="bg-green-600 hover:bg-green-700 text-white">
              {update.isPending ? 'Saving...' : 'Confirm Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}