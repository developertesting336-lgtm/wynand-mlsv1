import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { DollarSign, CheckCircle, Clock, XCircle, Banknote } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  pending: { label: 'Pending Review', className: 'bg-yellow-100 text-yellow-800', icon: Clock },
  approved: { label: 'Approved', className: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  paid: { label: 'Paid', className: 'bg-green-100 text-green-800', icon: CheckCircle },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800', icon: XCircle },
};

export default function PayoutRequestPanel({ agentId, agentEmail }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedReferral, setSelectedReferral] = useState(null);
  const [form, setForm] = useState({ payment_method: 'bank_transfer', payment_details: '', commission_amount: '' });

  const { data: convertedReferrals = [] } = useQuery({
    queryKey: ['converted-referrals', agentId],
    queryFn: () => base44.entities.AgentReferral.filter({ agent_id: agentId, status: 'converted' }, '-created_date', 50),
    enabled: !!agentId,
  });

  const { data: myPayouts = [] } = useQuery({
    queryKey: ['my-payouts', agentId],
    queryFn: () => base44.entities.CommissionPayout.filter({ agent_id: agentId }, '-created_date', 50),
    enabled: !!agentId,
  });

  const requestedReferralIds = new Set(myPayouts.map(p => p.referral_id));
  const eligibleReferrals = convertedReferrals.filter(r => !requestedReferralIds.has(r.id));

  const createPayout = useMutation({
    mutationFn: (data) => base44.entities.CommissionPayout.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-payouts', agentEmail] });
      toast.success('Payout request submitted!');
      setOpen(false);
      setSelectedReferral(null);
      setForm({ payment_method: 'bank_transfer', payment_details: '', commission_amount: '' });
    },
  });

  const handleOpen = (referral) => {
    setSelectedReferral(referral);
    setForm(prev => ({ ...prev, commission_amount: referral.commission_amount || '' }));
    setOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.payment_details.trim()) { toast.error('Please enter payment details'); return; }
    createPayout.mutate({
      agent_id: agentId,
      referral_id: selectedReferral.id,
      referral_code: selectedReferral.referral_code,
      client_name: selectedReferral.referred_name || '',
      listing_title: selectedReferral.listing_title || '',
      commission_amount: parseFloat(form.commission_amount),
      payment_method: form.payment_method,
      payment_details: form.payment_details,
      status: 'pending',
    });
  };

  const totalPaid = myPayouts.filter(p => p.status === 'paid').reduce((s, p) => s + (p.commission_amount || 0), 0);
  const totalPending = myPayouts.filter(p => p.status === 'pending' || p.status === 'approved').reduce((s, p) => s + (p.commission_amount || 0), 0);

  return (
    <div className="space-y-5">
      {/* Summary commented out
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100"><DollarSign className="w-5 h-5 text-green-700" /></div>
            <div>
              <p className="text-xl font-bold">${totalPaid.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Total Paid Out</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-100"><Clock className="w-5 h-5 text-yellow-700" /></div>
            <div>
              <p className="text-xl font-bold">${totalPending.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Pending Payouts</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Banknote className="w-5 h-5 text-primary" /></div>
            <div>
              <p className="text-xl font-bold">{eligibleReferrals.length}</p>
              <p className="text-xs text-muted-foreground">Ready to Request</p>
            </div>
          </CardContent>
        </Card>
      </div>
      */}

      {/* Eligible for payout */}
      {eligibleReferrals.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Converted Referrals — Request Payout</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {eligibleReferrals.map(ref => (
              <div key={ref.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-muted/30">
                <div>
                  <p className="font-medium text-sm">{ref.referred_name || 'Unknown client'}</p>
                  <p className="text-xs text-muted-foreground">{ref.listing_title || ref.referral_code}</p>
                  {ref.commission_amount && <p className="text-xs font-semibold text-green-700 mt-0.5">${ref.commission_amount} commission</p>}
                </div>
                <Button size="sm" onClick={() => handleOpen(ref)}>Request Payout</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Request dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Commission Payout</DialogTitle>
          </DialogHeader>
          {selectedReferral && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="p-3 bg-muted/40 rounded-lg text-sm">
                <p className="font-medium">{selectedReferral.referred_name}</p>
                <p className="text-muted-foreground">{selectedReferral.listing_title}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Commission Amount (USD)</Label>
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={form.commission_amount}
                  onChange={e => setForm({ ...form, commission_amount: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Payment Method</Label>
                <Select value={form.payment_method} onValueChange={v => setForm({ ...form, payment_method: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="paypal">PayPal</SelectItem>
                    <SelectItem value="crypto">Crypto</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Payment Details *</Label>
                <Textarea
                  required
                  rows={3}
                  placeholder="e.g. Bank: BBVA · Account: 1234567890 · CLABE: ..."
                  value={form.payment_details}
                  onChange={e => setForm({ ...form, payment_details: e.target.value })}
                  className="mt-1"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createPayout.isPending}>
                  {createPayout.isPending ? 'Submitting...' : 'Submit Request'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}