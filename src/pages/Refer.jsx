import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, DollarSign, Users, TrendingUp, Handshake } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

const INITIAL = {
  client_name: '', client_email: '', client_phone: '',
  referral_type: 'buyer', property_description: '', estimated_value_usd: '', notes: '',
};

export default function Refer() {
  const [form, setForm] = useState(INITIAL);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Get auth state
  const { user, login, authChecked } = useAuth();

  // Disable scroll when not authenticated
  useEffect(() => {
    if (authChecked && !user) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [authChecked, user]);

  useEffect(() => {
    if (user) {
      setCurrentUser(user);
    }
  }, [user]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser?.stripe_onboarding_complete || !currentUser?.stripe_connect_id) {
      toast.error('Please connect Stripe first to receive payment');
      return;
    }
    if (!currentUser || !form.client_name) {
      toast.error('Please fill in all required fields');
      return;
    }
    setLoading(true);
    await base44.entities.SaleReferral.create({
      ...form,
      referrer_id: currentUser?.id,
      referral_type: form.referral_type,
      estimated_value_usd: form.estimated_value_usd ? Number(form.estimated_value_usd) : undefined,
      commission_pct: 15,
      status: 'pending',
    });

    // Notify admin
    base44.integrations.Core.SendEmail({
      to: 'admin@pvverifiedrentals.com',
      from_name: 'PV Verified Rentals',
      subject: `New Sale Referral: ${form.client_name} (${form.referral_type})`,
      body: `
<p>A new sale referral has been submitted.</p>
<table style="border-collapse:collapse;width:100%;max-width:480px">
  <tr><td style="padding:6px 0;color:#666">Referrer ID</td><td style="font-weight:600">${currentUser?.id || 'N/A'}</td></tr>
  <tr><td style="padding:6px 0;color:#666">Referrer</td><td style="font-weight:600">${currentUser?.full_name || 'N/A'} (${currentUser?.email || 'N/A'})</td></tr>
  <tr><td style="padding:6px 0;color:#666">Client</td><td>${form.client_name} · ${form.client_email || 'N/A'}</td></tr>
  <tr><td style="padding:6px 0;color:#666">Type</td><td>${form.referral_type === 'buyer' ? 'Buyer' : 'Seller'}</td></tr>
  ${form.estimated_value_usd ? `<tr><td style="padding:6px 0;color:#666">Est. Value</td><td>$${Number(form.estimated_value_usd).toLocaleString()}</td></tr>` : ''}
  ${form.property_description ? `<tr><td style="padding:6px 0;color:#666">Property</td><td>${form.property_description}</td></tr>` : ''}
</table>
<p>Please review in the Admin Dashboard.</p>
      `.trim(),
    }).catch(() => {});

    // Confirm to referrer
    base44.integrations.Core.SendEmail({
      to: currentUser?.email,
      from_name: 'PV Verified Rentals',
      subject: 'Your referral has been received!',
      body: `
<p>Hi ${currentUser?.full_name || 'there'},</p>
<p>Thank you for your referral! We've received your submission for <strong>${form.client_name}</strong> and our team will be in touch shortly.</p>
            <p>If the transaction closes successfully, you'll earn a <strong>15% referral fee</strong> on the commission.</p>
<p style="color:#888;font-size:12px;margin-top:24px">PV Verified Rentals · Puerto Vallarta</p>
      `.trim(),
    }).catch(() => {});

    setSubmitted(true);
    setLoading(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center">
          <CardContent className="p-10">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Referral Submitted!</h2>
            <p className="text-muted-foreground mb-2">
              We've received your referral for <strong>{form.client_name}</strong>.
            </p>
            <p className="text-muted-foreground mb-6">
              If the deal closes, you'll earn a <strong className="text-green-600">15% referral fee</strong> on our commission. We'll keep you updated every step of the way.
            </p>
            <Button onClick={() => { setForm(INITIAL); setSubmitted(false); }}>
              Submit Another Referral
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary/10 via-accent/5 to-background border-b">
        <div className="max-w-4xl mx-auto px-4 py-14 text-center">
          <Badge className="mb-4 bg-primary/10 text-primary border-0 text-sm px-4 py-1">Referral Program</Badge>
      <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
        Earn a <span className="text-primary">15% Referral Fee</span>
      </h1>
      <p className="text-lg text-muted-foreground max-w-xl mx-auto">
        Know someone buying or selling property in Puerto Vallarta? Refer them to us and earn 15% of our commission when the deal closes — open to agents and the public alike.
      </p>
        </div>
      </div>

      {/* How it works */}
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {[
            { icon: Users, title: 'Refer a Client', desc: 'Fill out the form below with your contact details and your client\'s information.' },
            { icon: Handshake, title: 'We Do the Work', desc: 'Our team contacts your client and handles the entire buying or selling process.' },
            { icon: DollarSign, title: 'Earn 15%', desc: 'When the deal closes, you receive 15% of our commission — automatically.' },
          ].map(({ icon: Icon, title, desc }) => (
            <Card key={title} className="text-center">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Example earnings */}
        <Card className="mb-10 border-primary/20 bg-primary/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Example Earnings</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              {[
                { price: '$300,000', commission: '$18,000', fee: '$3,600' },
                { price: '$500,000', commission: '$30,000', fee: '$6,000' },
                { price: '$1,000,000', commission: '$60,000', fee: '$12,000' },
              ].map(({ price, commission, fee }) => (
                <div key={price} className="bg-white rounded-lg p-4 text-center shadow-sm">
                  <p className="text-muted-foreground text-xs mb-1">Sale Price</p>
                  <p className="font-bold text-lg">{price}</p>
                  <p className="text-xs text-muted-foreground mt-2">Our commission: {commission}</p>
                  <p className="text-primary font-semibold mt-1">Your 15%: {fee}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">* Based on a 6% sales commission. Actual amounts may vary.</p>
          </CardContent>
        </Card>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Submit a Referral</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Your info */}
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Your Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Your Name</label>
                    <Input value={currentUser?.full_name || ''} disabled className="bg-muted" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Your Email</label>
                    <Input value={currentUser?.email || ''} disabled className="bg-muted" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-sm font-medium mb-1 block">Your WhatsApp / Phone</label>
                    <Input value={currentUser?.phone_number || ''} disabled className="bg-muted" />
                  </div>
                </div>
              </div>

              {/* Client info */}
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Client Information</h3>

                {/* Buyer / Seller toggle */}
                <div className="flex gap-2 mb-3">
                  {['buyer', 'seller'].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => set('referral_type', t)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        form.referral_type === t
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-input hover:bg-muted'
                      }`}
                    >
                      {t === 'buyer' ? '🏠 Buyer' : '💰 Seller'}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Client Name *</label>
                    <Input value={form.client_name} onChange={e => set('client_name', e.target.value)} placeholder="John Doe" required />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Client Email</label>
                    <Input type="email" value={form.client_email} onChange={e => set('client_email', e.target.value)} placeholder="john@example.com" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Client Phone / WhatsApp</label>
                    <Input value={form.client_phone} onChange={e => set('client_phone', e.target.value)} placeholder="+52 322 ..." />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      {form.referral_type === 'buyer' ? 'Budget (USD)' : 'Estimated Value (USD)'}
                    </label>
                    <Input type="number" value={form.estimated_value_usd} onChange={e => set('estimated_value_usd', e.target.value)} placeholder="500000" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-sm font-medium mb-1 block">
                      {form.referral_type === 'buyer' ? 'Desired property details' : 'Property address / description'}
                    </label>
                    <Textarea value={form.property_description} onChange={e => set('property_description', e.target.value)} placeholder={form.referral_type === 'buyer' ? 'e.g. 3BR condo in Zona Romántica, ocean view preferred...' : 'e.g. 2BR condo at Amapas 300, PV...'} className="h-20" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-sm font-medium mb-1 block">Additional Notes</label>
                    <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Anything else we should know..." className="h-20" />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button type="submit" disabled={loading} className="w-full h-12 text-base">
                  {loading ? 'Submitting...' : 'Submit Referral & Earn 15%'}
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-3">
                  By submitting you agree to our referral terms. Commission is paid within 30 days of deal closing.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Show login prompt if not authenticated */}
      {!authChecked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
        </div>
      )}
      {authChecked && !user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Sign In Required</h2>
            <p className="text-muted-foreground mb-6">
              You need to sign in to submit a referral and earn 15% commission.
            </p>
            <button
              onClick={login}
              className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Sign In / Sign Up
            </button>
          </div>
        </div>
      )}
    </div>
  );
}