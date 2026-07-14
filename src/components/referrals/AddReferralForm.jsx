import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export default function AddReferralForm({ agent, listings, onAdded }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ referred_name: '', referred_email: '', referred_phone: '', listing_id: '', type: 'rental', commission_pct: 10, notes: '' });
  const [saving, setSaving] = useState(false);

  const code = agent?.referral_code
    ? agent.referral_code
    : (agent?.email
      ? 'REF-' + agent.email.split('@')[0].toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
      : '');

  const handle = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.referred_name || !form.referred_email) {
      toast.error('Name and email are required');
      return;
    }
    setSaving(true);
    const listing = listings.find(l => l.id === form.listing_id);
    await base44.entities.AgentReferral.create({
      agent_id: agent.id,
      agent_name: agent.full_name,
      referral_code: code,
      referred_name: form.referred_name,
      referred_email: form.referred_email,
      referred_phone: form.referred_phone,
      type: form.type,
      listing_id: form.listing_id || undefined,
      listing_title: listing?.title,
      commission_pct: Number(form.commission_pct),
      notes: form.notes,
      status: 'pending',
      source: 'manual',
    });
    toast.success('Referral added');
    qc.invalidateQueries({ queryKey: ['agent-referrals'] });
    setForm({ referred_name: '', referred_email: '', referred_phone: '', listing_id: '', type: 'rental', commission_pct: 10, notes: '' });
    setSaving(false);
    onAdded?.();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-primary" />
          Add Manual Referral
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Client Name *</label>
              <Input placeholder="John Smith" value={form.referred_name} onChange={e => handle('referred_name', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Client Email *</label>
              <Input type="email" placeholder="john@example.com" value={form.referred_email} onChange={e => handle('referred_email', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Phone / WhatsApp</label>
              <Input placeholder="+1 555 000 0000" value={form.referred_phone} onChange={e => handle('referred_phone', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Type</label>
              <select className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={form.type} onChange={e => handle('type', e.target.value)}>
                <option value="rental">Rental</option>
                <option value="sale">Sale</option>
                <option value="both">Rental & Sale</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Listing (optional)</label>
              <select className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={form.listing_id} onChange={e => handle('listing_id', e.target.value)}>
                <option value="">— Any listing —</option>
                {listings.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Commission %</label>
              <Input type="number" min="0" max="100" value={form.commission_pct} onChange={e => handle('commission_pct', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
            <Input placeholder="Internal notes..." value={form.notes} onChange={e => handle('notes', e.target.value)} />
          </div>
          <Button type="submit" disabled={saving} className="w-full gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Add Referral'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}