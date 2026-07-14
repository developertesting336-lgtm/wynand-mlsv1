import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, CheckCircle, ShieldCheck, Clock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/lib/supabase';
import { isSubscriptionActive } from '@/lib/utils';
import { toast } from 'sonner';

const VITE_EMAIL_SERVER_URL = import.meta.env.VITE_EMAIL_SERVER_URL || 'http://localhost:3001';

export default function InquiryForm({ listing, onSubmitted, compact = false, ownerRole = 'owner', refCode = '' }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    whatsapp: '',
    message: `Hi, I'm interested in "${listing.title}". Is it still available?`,
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const { data: subscription = null } = useQuery({
    queryKey: ['subscription', currentUser?.id],
    queryFn: () =>
      currentUser?.id
        ? base44.entities.Subscription.filter({ user_id: currentUser.id }).then(data => data[0] || null)
        : Promise.resolve(null),
    enabled: !!currentUser?.id,
  });

  const hasActiveSubscription = currentUser?.role === 'renter' ? isSubscriptionActive(subscription) : true;

  // Fetch tenant verification using react-query (reliable loading state)
  const { data: tenantVerification = {}, isLoading: verificationLoading } = useQuery({
    queryKey: ['inquiry-verification', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return {};
      const { data, error } = await supabase
        .from('verifications')
        .select('*')
        .eq('user_id', currentUser.id)
        .maybeSingle();
      if (error) {
        console.error('Failed to fetch verifications:', error);
        return {};
      }
      console.log('Fetched verification for user:', currentUser.id, data);
      return data || {};
    },
    enabled: !!currentUser?.id,
  });

  const urlRefCode = new URLSearchParams(window.location.search).get('ref') || '';
  const effectiveRefCode = urlRefCode || refCode || sessionStorage.getItem('referral_code') || '';

  useEffect(() => {
    base44.auth.me().then(u => {
      setForm(prev => ({ ...prev, name: u.full_name || '', email: u.email || '', whatsapp: u.phone_number || '' }));
      setCurrentUser(u);
    }).catch(() => {
      setCurrentUser(null);
    }).finally(() => {
      setLoadingUser(false);
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      toast.error('Please sign in to send an inquiry.');
      return;
    }
    if (currentUser.role === 'renter' && !hasActiveSubscription) {
      toast.error('An active subscription is required to send inquiries. Please subscribe before contacting owners.');
      return;
    }
    if (currentUser.role === 'renter' && (tenantVerification.id_verification !== 'approved' || tenantVerification.employment_verification !== 'approved')) {
      toast.error('Complete identity verification and employment verification before sending an inquiry.');
      return;
    }
    setSubmitting(true);

    try {
      const inquiryId = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });

      // Look up owner ID and agent ID from profiles
      let ownerId = null;
      if (listing.owner_email) {
        const { data: ownerProfiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', listing.owner_email)
          .limit(1);
        if (ownerProfiles && ownerProfiles.length > 0) {
          ownerId = ownerProfiles[0].id;
        }
      }

      let agentId = null;
      if (listing.agent_email) {
        const { data: agentProfiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', listing.agent_email)
          .limit(1);
        if (agentProfiles && agentProfiles.length > 0) {
          agentId = agentProfiles[0].id;
        }
      }

      // Create ONE inquiry
      const insertPayload = {
        id: inquiryId,
        message: form.message,
        listing_id: listing.id,
        listing_title: listing.title,
        listing_owner_id: ownerId,
        agent_id: agentId,
        status: 'new',
        tenant_id: currentUser.id,
      };

      const { data, error } = await supabase
        .from('inquiries')
        .insert(insertPayload)
        .select()
        .single();

      if (error) {
        console.error('[InquiryForm] Supabase error details:', JSON.stringify(error, null, 2));
        toast.error('Failed to save inquiry');
        setSubmitting(false);
        return;
      }
      console.log('[InquiryForm] Inquiry created successfully:', data);
    } catch (inquiryErr) {
      console.error('[InquiryForm] Failed to create inquiry. Full error:', inquiryErr);
      toast.error(`Failed to save inquiry: ${inquiryErr?.message || 'Unknown error'}`);
      setSubmitting(false);
      return;
    }

    // Email the listing owner via Express API
    if (listing.owner_email) {
      const emailPayload = {
        to: listing.owner_email,
        subject: `New inquiry for "${listing.title}"`,
        body: `
<p>Hi ${listing.owner_name || 'there'},</p>
<p>You have a new inquiry for <strong>${listing.title}</strong>.</p>
<table style="border-collapse:collapse;width:100%;max-width:480px">
  <tr><td style="padding:6px 0;color:#666">Name</td><td style="padding:6px 0;font-weight:600">${form.name}${tenantVerification.id_verification === 'approved' && tenantVerification.employment_verification === 'approved' ? ' <span style="display:inline-flex;align-items:center;gap:4px;background:#ecfdf5;color:#059669;border:1px solid #a7f3d0;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700">✓ Verified Tenant</span>' : ''}</td></tr>
</table>
<blockquote style="border-left:3px solid #0ea5e9;margin:12px 0;padding:8px 16px;background:#f0f9ff;border-radius:4px">${form.message}</blockquote>
<p style="color:#888;font-size:12px">PV Verified Rentals</p>
        `.trim(),
        fromName: 'PV Verified Rentals',
      };

      const res = await fetch(`${VITE_EMAIL_SERVER_URL}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailPayload),
      });

      let result;
      try {
        result = await res.json();
      } catch (e) {
        result = { error: `Server returned ${res.status}` };
      }

      if (!res.ok) {
        toast.error(`Email failed: ${result.error || 'Server error'}`);
      }
    }

    // Confirmation email to the inquirer
    fetch(`${VITE_EMAIL_SERVER_URL}/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: form.email,
        subject: `Your inquiry for "${listing.title}" was received`,
        body: `
<p>Hi ${form.name},</p>
<p>Thanks for your inquiry! The owner of <strong>${listing.title}</strong> has been notified and will reach out to you soon.</p>
<p>In the meantime, feel free to browse more verified listings at <a href="${window.location.origin}/listings">PV Verified Rentals</a>.</p>
<p style="color:#888;font-size:12px">PV Verified Rentals · Puerto Vallarta</p>
        `.trim(),
        fromEmail: 'noreply@pvverified.com',
        fromName: 'PV Verified Rentals',
      }),
    }).catch(() => { });

    setSubmitted(true);
    setSubmitting(false);

    // If arrived via referral link, create a referral record
    if (effectiveRefCode) {
      const ownerUsers = await base44.entities.User.filter({ email: listing.owner_email });
      const ownerUser = ownerUsers[0];
      base44.entities.AgentReferral.create({
        agent_id: ownerUser?.id || null,
        agent_email: listing.owner_email || '',
        agent_name: listing.owner_name || '',
        referral_code: refCode,
        referred_name: form.name,
        referred_email: form.email,
        referred_phone: form.whatsapp || '',
        type: 'rental',
        listing_id: listing.id,
        listing_title: listing.title,
        commission_pct: 10,
        status: 'pending',
        source: 'link',
      }).catch(() => { });
    }

    if (onSubmitted) setTimeout(onSubmitted, 1800);
  };

  if (submitted) {
    return (
      <div className="text-center py-8 px-4">
        <div className="w-14 h-14 rounded-full bg-accent/15 flex items-center justify-center mx-auto mb-3">
          <CheckCircle className="w-8 h-8 text-accent" />
        </div>
        <h3 className="font-bold text-lg">Inquiry Sent!</h3>
        <p className="text-sm text-muted-foreground mt-1">
          The owner has been notified by email and will respond soon.
        </p>
      </div>
    );
  }

  const inner = (
    <form onSubmit={handleSubmit} className="space-y-3">
      {currentUser?.role === 'renter' && !verificationLoading && (tenantVerification.id_verification !== 'approved' || tenantVerification.employment_verification !== 'approved') && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Complete identity verification and employment verification before sending an inquiry.
        </div>
      )}
      {currentUser?.role === 'renter' && !hasActiveSubscription && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          An active subscription is required to send messages and inquiries. Please subscribe first.
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Your Name *</Label>
          <Input required disabled={!!currentUser} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Email *</Label>
          <Input required type="email" disabled={!!currentUser} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="mt-1" />
        </div>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Message</Label>
        <Textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} rows={3} className="mt-1" />
      </div>
      <Button type="submit" className="w-full gap-2 h-11 text-base" disabled={submitting || verificationLoading || (currentUser?.role === 'renter' && (!hasActiveSubscription || tenantVerification.id_verification !== 'approved' || tenantVerification.employment_verification !== 'approved'))}>
        <Send className="w-4 h-4" />
        {submitting ? 'Sending...' : 'Send Inquiry'}
      </Button>
      <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
        <ShieldCheck className="w-3 h-3" /> Your info is kept private
      </p>
    </form>
  );

  if (compact) return inner;

  return (
    <Card className="border-border/60 shadow-lg">
      <CardHeader className="pb-2 pt-5 px-5">
        <CardTitle className="text-base font-bold">Contact the {ownerRole === 'agent' ? 'Agent' : 'Owner'}</CardTitle>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
          <Clock className="w-3 h-3" />
          Usually responds within a few hours
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {inner}
      </CardContent>
    </Card>
  );
}