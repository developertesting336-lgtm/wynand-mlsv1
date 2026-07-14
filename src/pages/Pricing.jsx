import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, CreditCard, ShieldCheck, CheckCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const PRICE_USD = 9.99;

export default function Pricing() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('subscribed') === 'true') {
      setSubscribed(true);
    }

    base44.auth.me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoadingUser(false));
  }, []);

  const handleSubscribe = async () => {
    if (!user) {
      base44.auth.redirectToLogin();
      return;
    }

    setSubscribing(true);
    try {
      const successUrl = `${window.location.origin}/pricing?subscribed=true`;
      const cancelUrl = window.location.href;

      const response = await supabase.functions.invoke('subscriptions', {
        body: JSON.stringify({
          role: user?.role || 'renter',
          plan: 'basic',
          mode: 'subscription',
          type: 'subscription',
          userEmail: user.email,
          successUrl,
          cancelUrl,
        }),
      });

      if (response.error) {
        throw response.error;
      }

      const data = response.data || {};
      if (data.url) {
        window.location.href = data.url;
        return;
      }

      throw new Error('Unable to create checkout session.');
    } catch (err) {
      console.error('Pricing checkout error:', err);
      toast.error(err?.message || 'Unable to start subscription. Please try again.');
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/listings" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Browse
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.8fr] gap-8">
        <div>
          <div className="mb-6">
            <p className="text-sm uppercase tracking-[0.24em] text-primary font-semibold">Pricing</p>
            <h1 className="text-4xl font-bold mt-3">Premium membership</h1>
            <p className="max-w-2xl text-muted-foreground mt-4 leading-7">
              Unlock access to prioritized customer support, subscription benefits, and a smoother renting experience for just ${PRICE_USD.toFixed(2)} per month.
            </p>
          </div>

          <div className="grid gap-4">
            <Card className="border border-border/80">
              <CardHeader>
                <CardTitle className="text-2xl">${PRICE_USD.toFixed(2)} / month</CardTitle>
                {/* <CardDescription>Recurring subscription for renters and property owners.</CardDescription> */}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="font-semibold">What’s included</p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-accent mt-0.5" /> Priority onboarding and support.</li>
                    <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-accent mt-0.5" /> Faster access to verified listings and owner tools.</li>
                    <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-accent mt-0.5" /> Simplified subscription billing with Stripe.</li>
                    <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-accent mt-0.5" /> Monthly updates and premium benefits.</li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-accent/20 bg-accent/10 p-4">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-accent" />
                    <p className="text-sm text-green-600 text-accent-foreground">Secure payments with Stripe.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="rounded-3xl border border-border/80 bg-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="rounded-full bg-primary/10 p-3"><CreditCard className="w-5 h-5 text-primary" /></div>
                <div>
                  <p className="text-sm font-semibold">Subscription status</p>
                  {/* <p className="text-xs text-muted-foreground">Available for owner and renter accounts.</p> */}
                </div>
              </div>

              {subscribed ? (
                <div className="rounded-2xl border border-accent/20 bg-accent/5 p-4 text-sm text-accent-900">
                  <p className="font-semibold">Thank you!</p>
                  <p>Your subscription was successfully activated.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Subscribe now to enjoy premium access, faster support, and a better rental experience.
                  </p>
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleSubscribe}
                    disabled={subscribing || loadingUser}
                  >
                    {loadingUser ? 'Checking account…' : subscribing ? 'Starting checkout…' : 'Subscribe for $9.99'}
                  </Button>
                  {!user && !loadingUser && (
                    <p className="text-sm text-muted-foreground">Please sign in to subscribe.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Card className="border border-border/80">
            <CardHeader>
              <CardTitle>How it works</CardTitle>
              <CardDescription>One monthly fee, charged securely through Stripe.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>Once you subscribe, you will be redirected to Stripe to complete checkout.</p>
            </CardContent>
          </Card>

          <Card className="border border-border/80">
            <CardHeader>
              <CardTitle>Ready to subscribe?</CardTitle>
              <CardDescription>Get premium access today.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="rounded-2xl bg-muted p-4">
                <p className="font-semibold">$9.99 / month</p>
                {/* <p>Recurring subscription billed to your payment method.</p> */}
              </div>
              <ul className="space-y-2">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-accent" /> Secure Stripe checkout</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-accent" /> Works for All</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-accent" /> No long-term commitment</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
