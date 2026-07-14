import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, CheckCircle, UserCircle, Mail, Phone } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/lib/supabase';
import { isSubscriptionActive } from '@/lib/utils';
import { toast } from 'sonner';

const VITE_EMAIL_SERVER_URL = import.meta.env.VITE_EMAIL_SERVER_URL || 'http://localhost:3001';

export default function ContactAgentForm({ listing, ownerRole = 'agent', refCode = '' }) {
  const agentEmail = listing.agent_email || listing.contact_email || listing.owner_email;
  const agentName = listing.agent_name || listing.owner_name || `the ${ownerRole}`;
  const agentPhone = listing.agent_phone;

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    message: `Hi ${agentName}, I'm interested in "${listing.title}" and would like more information.`,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [tenantVerification, setTenantVerification] = useState({});
  const [verificationLoading, setVerificationLoading] = useState(false);

  const { data: subscription = null } = useQuery({
    queryKey: ['subscription', currentUser?.id],
    queryFn: () =>
      currentUser?.id
        ? base44.entities.Subscription.filter({ user_id: currentUser.id }).then(data => data[0] || null)
        : Promise.resolve(null),
    enabled: !!currentUser?.id,
  });

  const hasActiveSubscription = currentUser?.role === 'renter' ? isSubscriptionActive(subscription) : true;

  // Fetch tenant verification from verifications table
  useEffect(() => {
    if (!currentUser?.id) return;
    const fetchVerification = async () => {
      setVerificationLoading(true);
      try {
        const { data: rows, error } = await supabase
          .from('verifications')
          .select('*')
          .eq('user_id', currentUser.id)
          .maybeSingle();

        if (error) {
          console.error('Failed to fetch verifications:', error);
          setVerificationLoading(false);
          return;
        }

        const verif = rows || {};
        console.log('Fetched verification for user:', currentUser.id, verif);
        setTenantVerification(verif);
      } catch (err) {
        console.error('Error fetching verification:', err);
      } finally {
        setVerificationLoading(false);
      }
    };
    fetchVerification();
  }, [currentUser?.id]);

  useEffect(() => {
    base44.auth.me().then(u => {
      setForm(prev => ({ ...prev, name: u.full_name || '', email: u.email || '', phone: u.phone_number || '' }));
      setCurrentUser(u);
    }).catch(() => { });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!agentEmail) return;
    if (currentUser?.role === 'renter' && !hasActiveSubscription) {
      toast.error('An active subscription is required to contact the agent. Please subscribe first.');
      return;
    }
    if (currentUser?.role === 'renter' && (tenantVerification.id_verification !== 'approved' || tenantVerification.employment_verification !== 'approved')) {
      toast.error('Complete identity verification and employment verification before contacting the agent.');
      return;
    }
    setSubmitting(true);

    try {
      const inquiryId = crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);

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

      // Create ONE inquiry - tenant sends it
      const { error } = await supabase
        .from('inquiries')
        .insert({
          id: inquiryId,
          message: form.message,
          listing_id: listing.id,
          listing_title: listing.title,
          listing_owner_id: ownerId,
          agent_id: agentId,
          status: 'new',
          tenant_id: currentUser.id,
        });

      if (error) {
        console.error('[ContactAgentForm] Inquiry insert error:', error);
        toast.error('Failed to save inquiry');
        setSubmitting(false);
        return;
      }
    } catch (dbErr) {
      console.error('[ContactAgentForm] DB error:', dbErr);
      setSubmitting(false);
      return;
    }

    // Notify the agent via Express API
    const agentEmailPayload = {
      to: agentEmail,
      subject: `New contact request for "${listing.title}"`,
      body: `
<p>Hi ${agentName},</p>
<p>A prospective tenant has reached out about your listing: <strong>${listing.title}</strong>.</p>
<table style="border-collapse:collapse;width:100%;max-width:480px;margin:12px 0">
  <tr><td style="padding:6px 12px 6px 0;color:#666;white-space:nowrap">Name</td><td style="padding:6px 0;font-weight:600">${form.name}</td></tr>
</table>
<blockquote style="border-left:3px solid #0ea5e9;margin:16px 0;padding:10px 16px;background:#f0f9ff;border-radius:4px;color:#1e293b">${form.message}</blockquote>
<p style="color:#888;font-size:12px;margin-top:24px">Sent via PV Verified Rentals · Puerto Vallarta</p>
      `.trim(),
      fromName: 'PV Verified Rentals',
    };

    const agentRes = await fetch(`${VITE_EMAIL_SERVER_URL}/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agentEmailPayload),
    });
    let agentResult;
    try {
      agentResult = await agentRes.json();
    } catch (e) {
      agentResult = { error: `Server returned ${agentRes.status}` };
    }
    console.log('[ContactAgentForm] Agent email response:', agentRes.status, agentResult);

    // Confirmation to sender
    const senderPayload = {
      to: form.email,
      subject: `Your message to the agent for "${listing.title}"`,
      body: `
<p>Hi ${form.name},</p>
<p>Your message has been sent to the agent for <strong>${listing.title}</strong>. They'll be in touch shortly.</p>
<p style="color:#888;font-size:12px;margin-top:24px">PV Verified Rentals · Puerto Vallarta</p>
      `.trim(),
      fromName: 'PV Verified Rentals',
    };

    const senderRes = await fetch(`${VITE_EMAIL_SERVER_URL}/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(senderPayload),
    });
    let senderResult;
    try {
      senderResult = await senderRes.json();
    } catch (e) {
      senderResult = { error: `Server returned ${senderRes.status}` };
    }
    console.log('[ContactAgentForm] Sender confirmation response:', senderRes.status, senderResult);

    setSubmitting(false);
    setSubmitted(true);

    // If arrived via referral link, create a referral record
    const effectiveRefCode = new URLSearchParams(window.location.search).get('ref') || refCode || sessionStorage.getItem('referral_code') || '';
    if (effectiveRefCode) {
      const ownerUsers = await base44.entities.User.filter({ email: listing.owner_email });
      const ownerUser = ownerUsers[0];
      base44.entities.AgentReferral.create({
        agent_id: ownerUser?.id || null,
        agent_email: listing.owner_email || '',
        agent_name: listing.owner_name || '',
        referral_code: effectiveRefCode,
        referred_name: form.name,
        referred_email: form.email,
        referred_phone: form.phone || '',
        type: 'rental',
        listing_id: listing.id,
        listing_title: listing.title,
        commission_pct: 10,
        status: 'pending',
        source: 'link',
      }).catch(() => { });
    }
  };

  if (!agentEmail) return null;

  if (submitted) {
    return (
      <Card className="border-border/60">
        <CardContent className="py-10 text-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-8 h-8 text-primary" />
          </div>
          <h3 className="font-bold text-lg">Message Sent!</h3>
          <p className="text-sm text-muted-foreground mt-1">
            The agent has been notified and will reach out to you soon.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-2 pt-5 px-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <UserCircle className="w-6 h-6 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">Contact the Agent</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Mail className="w-3 h-3" /> {agentEmail}
            </p>
            {agentPhone && (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Phone className="w-3 h-3" /> {agentPhone}
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <form onSubmit={handleSubmit} className="space-y-3">
          {currentUser?.role === 'renter' && !hasActiveSubscription && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
              An active subscription is required to contact the agent. Please subscribe first.
            </div>
          )}
          {currentUser?.role === 'renter' && !verificationLoading && (tenantVerification.id_verification !== 'approved' || tenantVerification.employment_verification !== 'approved') && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Complete identity verification and employment verification before contacting the agent.
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
            <Textarea
              value={form.message}
              onChange={e => setForm({ ...form, message: e.target.value })}
              rows={3}
              className="mt-1"
            />
          </div>
          <Button type="submit" className="w-full gap-2 h-11" disabled={submitting || verificationLoading || (currentUser?.role === 'renter' && (!hasActiveSubscription || tenantVerification.id_verification !== 'approved' || tenantVerification.employment_verification !== 'approved'))}>
            <Send className="w-4 h-4" />
            {submitting ? 'Sending...' : 'Send to Agent'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}