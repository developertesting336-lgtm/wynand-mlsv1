import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { DollarSign, CheckCircle, XCircle, Clock, Banknote } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const VITE_EMAIL_SERVER_URL = import.meta.env.VITE_EMAIL_SERVER_URL || 'http://localhost:3001';

const STATUS_CONFIG = {
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800' },
  approved: { label: 'Approved', className: 'bg-blue-100 text-blue-800' },
  paid: { label: 'Paid', className: 'bg-green-100 text-green-800' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800' },
};

const PAYMENT_METHOD_LABELS = {
  bank_transfer: 'Bank Transfer',
  paypal: 'PayPal',
  crypto: 'Crypto',
  check: 'Check',
};

export default function PayoutsAdmin() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [action, setAction] = useState(null); // 'approve' | 'paid' | 'reject'

  const { data: payouts = [], isLoading } = useQuery({
    queryKey: ['admin-payouts'],
    queryFn: () => base44.entities.CommissionPayout.list('-created_date', 200),
  });

  const updatePayout = useMutation({
    mutationFn: ({ id, data }) => base44.entities.CommissionPayout.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-payouts'] });
      toast.success('Payout updated');

      // Email agent on approval or payment
      const newStatus = variables.data.status;
      if ((newStatus === 'approved' || newStatus === 'paid' || newStatus === 'rejected') && selected?.agent_id) {
        const amount = selected.commission_amount?.toFixed(2);
        const subjectMap = {
          approved: `Your payout of $${amount} has been approved`,
          paid: `Your commission of $${amount} has been paid! 💸`,
          rejected: `Payout request update for $${amount}`,
        };
        const colorMap = { approved: '#0ea5e9', paid: '#16a34a', rejected: '#dc2626' };
        const bodyMap = {
          approved: `<p>Great news! Your commission payout request for <strong>$${amount}</strong> has been <strong style="color:#0ea5e9">approved</strong>. Payment will be processed shortly.</p>`,
          paid: `<p>Your commission of <strong>$${amount}</strong> has been <strong style="color:#16a34a">paid</strong> via ${PAYMENT_METHOD_LABELS[selected.payment_method] || selected.payment_method}. Please check your account.</p>`,
          rejected: `<p>Unfortunately, your payout request for <strong>$${amount}</strong> has been <strong style="color:#dc2626">rejected</strong>. Please contact us if you have questions.</p>`,
        };

        fetch(`${VITE_EMAIL_SERVER_URL}/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: selected.agent_email || '',
            subject: subjectMap[newStatus],
            body: `
<p>Hi,</p>
${bodyMap[newStatus]}
<table style="border-collapse:collapse;width:100%;max-width:480px;margin-top:12px">
  <tr><td style="padding:6px 0;color:#666">Client</td><td style="padding:6px 0;font-weight:600">${selected.client_name || '—'}</td></tr>
  ${selected.listing_title ? `<tr><td style="padding:6px 0;color:#666">Listing</td><td style="padding:6px 0">${selected.listing_title}</td></tr>` : ''}
  <tr><td style="padding:6px 0;color:#666">Amount</td><td style="padding:6px 0;font-weight:600;color:${colorMap[newStatus]}">$${amount}</td></tr>
  ${variables.data.admin_notes ? `<tr><td style="padding:6px 0;color:#666">Note from admin</td><td style="padding:6px 0;font-style:italic">${variables.data.admin_notes}</td></tr>` : ''}
</table>
<p style="color:#888;font-size:12px;margin-top:24px">PV Verified Rentals · Puerto Vallarta</p>
            `.trim(),
            fromEmail: 'noreply@pvverified.com',
            fromName: 'PV Verified Rentals',
          }),
        }).catch(() => { });
      }

      setSelected(null);
      setAdminNotes('');
      setAction(null);
    },
  });

  const openAction = (payout, act) => {
    setSelected(payout);
    setAdminNotes('');
    setAction(act);
  };

  const handleConfirm = () => {
    const updates = { admin_notes: adminNotes };
    if (action === 'approve') updates.status = 'approved';
    if (action === 'paid') updates.status = 'paid', updates.paid_date = new Date().toISOString();
    if (action === 'reject') updates.status = 'rejected';
    updatePayout.mutate({ id: selected.id, data: updates });
  };

  const pending = payouts.filter(p => p.status === 'pending');
  const approved = payouts.filter(p => p.status === 'approved');
  const totalPaid = payouts.filter(p => p.status === 'paid').reduce((s, p) => s + (p.commission_amount || 0), 0);

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-yellow-100"><Clock className="w-5 h-5 text-yellow-700" /></div>
          <div><p className="text-xl font-bold">{pending.length}</p><p className="text-xs text-muted-foreground">Pending</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100"><CheckCircle className="w-5 h-5 text-blue-700" /></div>
          <div><p className="text-xl font-bold">{approved.length}</p><p className="text-xs text-muted-foreground">Approved</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-100"><DollarSign className="w-5 h-5 text-green-700" /></div>
          <div><p className="text-xl font-bold">${totalPaid.toFixed(2)}</p><p className="text-xs text-muted-foreground">Total Paid</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10"><Banknote className="w-5 h-5 text-primary" /></div>
          <div><p className="text-xl font-bold">{payouts.length}</p><p className="text-xs text-muted-foreground">All Requests</p></div>
        </CardContent></Card>
      </div>

      {/* Payout list */}
      {isLoading ? (
        <p className="text-muted-foreground text-center py-8">Loading...</p>
      ) : payouts.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No payout requests yet</p>
      ) : (
        <div className="space-y-3">
          {payouts.map(payout => {
            const cfg = STATUS_CONFIG[payout.status] || STATUS_CONFIG.pending;
            return (
              <Card key={payout.id}>
                <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{payout.agent_email || payout.agent_id}</p>
                      <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.className}`}>{cfg.label}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Client: {payout.client_name || '—'} · {payout.listing_title || '—'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Via {PAYMENT_METHOD_LABELS[payout.payment_method] || payout.payment_method} · Submitted {format(new Date(payout.created_date), 'MMM d, yyyy')}
                    </p>
                    <p className="text-xs bg-muted/50 rounded px-2 py-1 mt-1 font-mono break-all">{payout.payment_details}</p>
                    {payout.admin_notes && <p className="text-xs text-muted-foreground italic mt-1">Note: {payout.admin_notes}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <p className="text-xl font-bold">${payout.commission_amount?.toFixed(2)}</p>
                    <div className="flex gap-2">
                      {payout.status === 'pending' && (
                        <>
                          <Button size="sm" onClick={() => openAction(payout, 'approve')} className="gap-1">
                            <CheckCircle className="w-3.5 h-3.5" /> Approve
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => openAction(payout, 'reject')} className="gap-1">
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </Button>
                        </>
                      )}
                      {payout.status === 'approved' && (
                        <Button size="sm" onClick={() => openAction(payout, 'paid')} className="gap-1 bg-green-600 hover:bg-green-700 text-white">
                          <DollarSign className="w-3.5 h-3.5" /> Mark Paid
                        </Button>
                      )}
                      {payout.status === 'paid' && payout.paid_date && (
                        <p className="text-xs text-muted-foreground">Paid {format(new Date(payout.paid_date), 'MMM d, yyyy')}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Confirm dialog */}
      <Dialog open={!!selected} onOpenChange={() => { setSelected(null); setAction(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === 'approve' && 'Approve Payout'}
              {action === 'paid' && 'Mark as Paid'}
              {action === 'reject' && 'Reject Payout'}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/40 rounded-lg text-sm space-y-1">
                <p><span className="font-medium">Agent ID:</span> {selected.agent_id}</p>
                <p><span className="font-medium">Amount:</span> ${selected.commission_amount?.toFixed(2)}</p>
                <p><span className="font-medium">Client:</span> {selected.client_name || '—'}</p>
                <p><span className="font-medium">Payment:</span> {PAYMENT_METHOD_LABELS[selected.payment_method]}</p>
                <p className="font-mono text-xs break-all">{selected.payment_details}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Admin Notes (optional)</label>
                <Textarea
                  rows={2}
                  value={adminNotes}
                  onChange={e => setAdminNotes(e.target.value)}
                  placeholder="Add a note for the agent..."
                  className="mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelected(null); setAction(null); }}>Cancel</Button>
            <Button
              onClick={handleConfirm}
              disabled={updatePayout.isPending}
              variant={action === 'reject' ? 'destructive' : 'default'}
              className={action === 'paid' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
            >
              {updatePayout.isPending ? 'Saving...' : action === 'approve' ? 'Approve' : action === 'paid' ? 'Mark Paid' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}