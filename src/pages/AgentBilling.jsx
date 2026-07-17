import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldCheck, Star, Zap, CheckCircle, CreditCard, Loader2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';

const PLANS = [
  {
    key: 'basic',
    name: 'Basic Agent',
    price: 29,
    priceId: 'price_basic_placeholder',
    description: 'Get started with agent tools',
    features: [
      'Up to 5 active listings',
      'Verified badge on listings',
      'Inquiry notifications',
      'Agent dashboard access',
    ],
    highlight: false,
  },
  {
    key: 'pro',
    name: 'Pro Agent',
    price: 79,
    priceId: 'price_pro_placeholder',
    description: 'Maximum exposure for your properties',
    features: [
      'Unlimited active listings',
      'Up to 3 featured listings/month',
      'Priority placement in search',
      'Verified badge on listings',
      'Inquiry notifications',
      'Agent dashboard access',
      'Analytics & insights',
    ],
    highlight: true,
  },
];




export default function AgentBilling() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [loadingBoost, setLoadingBoost] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: () => base44.entities.Subscription.filter({ user_id: user.id }),
    enabled: !!user?.id,
    select: data => data[0] || null,
  });

  const activeSub = subscription?.status === 'active' ? subscription : null;

  const { data: myListings = [] } = useQuery({
    queryKey: ['my-listings', user?.email],
    queryFn: () => base44.entities.Listing.filter({ owner_email: user.email }),
    enabled: !!user,
  });

  const handleSubscribe = async (plan) => {
    setLoadingPlan(plan.key);
    const successUrl = `${window.location.origin}/agent-billing?subscribed=true`;
    const cancelUrl = window.location.href;
    try {
      const { data, error } = await supabase.functions.invoke('subscriptions', {
        body: JSON.stringify({
          role: user?.role || 'agent',
          plan: plan.key,
          mode: 'subscription',
          type: 'subscription',
          userEmail: user.email,
          successUrl,
          cancelUrl,
        }),
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error('Failed to create checkout session. Please try again.');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      toast.error(err?.message || 'Failed to start checkout. Please try again.');
    }
    setLoadingPlan(null);
  };



  const handleFeatureSubscription = async (listingId) => {
    const maxFeatured = activeSub?.plan === 'pro' ? 3 : 0;
    const currentDbFeaturedCount = myListings.filter(l => l.is_featured).length;
 
    if (currentDbFeaturedCount >= maxFeatured) {
      toast.error(`You have reached the maximum limit of ${maxFeatured} featured listings on the Pro plan.`);
      return;
    }

    setLoadingBoost(listingId);
    try {
      const { error: listingError } = await supabase
        .from('listings')
        .update({
          is_featured: true,
          is_verified: true,
          last_verified_date: new Date().toISOString(),
        })
        .eq('id', listingId);

      if (listingError) throw listingError;

      // Add listing to subscription's featured_listing_ids
      const currentIds = activeSub?.featured_listing_ids || [];
      if (!currentIds.includes(listingId)) {
        const { error: subError } = await supabase
          .from('subscriptions')
          .update({ featured_listing_ids: [...currentIds, listingId] })
          .eq('id', activeSub.id);

        if (subError) throw subError;
      }

      toast.success('Listing featured successfully!');
      // Invalidate React Query cache to refresh UI state dynamically
      queryClient.invalidateQueries({ queryKey: ['my-listings'] });
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    } catch (err) {
      console.error('Feature subscription error:', err);
      toast.error(err?.message || 'Failed to feature listing. Please try again.');
    }
    setLoadingBoost(null);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <Link to="/agent-dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Agent Billing</h1>
        <p className="text-muted-foreground mt-1">Subscribe for full agent access or boost individual listings to featured.</p>
      </div>

      {/* Current subscription status */}
      {activeSub && (
        <Card className="mb-8 border-accent/30 bg-accent/5">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
              <CheckCircle className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="font-semibold">
                Active: {PLANS.find(p => p.key === activeSub.plan)?.name || activeSub.plan}
              </p>
              <p className="text-sm text-muted-foreground">
                Your subscription is active
                {activeSub.current_period_end ? ` · renews ${new Date(activeSub.current_period_end).toLocaleDateString()}` : ''}
              </p>
            </div>
            <Badge className="ml-auto bg-accent text-accent-foreground">Active</Badge>
          </CardContent>
        </Card>
      )}

      {/* Subscription plans */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" /> Monthly Plans
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {PLANS.map(plan => (
            <Card
              key={plan.key}
              className={`relative overflow-hidden ${plan.highlight ? 'border-primary shadow-lg shadow-primary/10' : ''}`}
            >
              {plan.highlight && (
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary to-accent" />
              )}
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </div>
                  {plan.highlight && <Badge className="bg-primary/10 text-primary border-primary/20">Popular</Badge>}
                </div>
                <div className="mt-3">
                  <span className="text-4xl font-bold">${plan.price}</span>
                  <span className="text-xs font-normal text-muted-foreground ml-1">MXN</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-5">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-accent shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.highlight ? 'default' : 'outline'}
                  disabled={loadingPlan === plan.key || activeSub?.plan === plan.key}
                  onClick={() => handleSubscribe(plan)}
                >
                  {loadingPlan === plan.key ? <Loader2 className="w-4 h-4 animate-spin" /> :
                    activeSub?.plan === plan.key ? 'Current Plan' :
                    activeSub ? 'Switch Plan' : 'Subscribe'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Feature boost / Subscription featuring */}
      <section>
        <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500" /> Featured Listings
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {activeSub
            ? activeSub.plan === 'pro'
              ? `You have ${Math.max(0, 3 - myListings.filter(l => l.is_featured).length)} of 3 featured slots remaining this month.`
              : `You have ${Math.max(0, 5 - myListings.length)} of 5 active listings remaining.`
            : 'Subscribe to the Pro plan to feature listings at the top of search results.'}
        </p>

        {myListings.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              No listings yet.{' '}
              <Link to="/submit-property" className="text-primary hover:underline">Submit a property</Link> first.
            </CardContent>
          </Card>
        ) : activeSub ? (
          /* Subscribed agents: feature listings using subscription quota (no payment) */
          <div className="space-y-3">
            {myListings.map(listing => {
              const isFeatured = listing.is_featured;
              const currentDbFeaturedCount = myListings.filter(l => l.is_featured).length;
              const maxFeatured = activeSub.plan === 'pro' ? 3 : 0; // Basic plan: 0 featured listings
              const canFeature = activeSub.plan === 'pro' && !isFeatured && currentDbFeaturedCount < maxFeatured;

              return (
                <Card key={listing.id}>
                  <CardContent className="p-4 flex items-center gap-4">
                    {listing.photos?.[0] && (
                      <img src={listing.photos[0]} className="w-16 h-12 rounded-lg object-cover shrink-0" alt="" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm line-clamp-1">{listing.title}</p>
                      <p className="text-xs text-muted-foreground">
                        ${listing.price_mxn?.toLocaleString() || listing.price_usd?.toLocaleString()}<span className="text-[10px] font-normal text-muted-foreground ml-0.5"> MXN</span>/mo
                      </p>
                    </div>
                    {isFeatured ? (
                      <Badge className="bg-yellow-100 text-yellow-800 gap-1">
                        <Star className="w-3 h-3" /> Featured
                      </Badge>
                    ) : canFeature ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 shrink-0"
                        disabled={loadingBoost === listing.id}
                        onClick={() => handleFeatureSubscription(listing.id)}
                      >
                        {loadingBoost === listing.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Star className="w-3 h-3" />}
                        Feature
                      </Button>
                    ) : activeSub.plan === 'basic' ? (
                      <Badge className="bg-muted text-muted-foreground">Pro Only</Badge>
                    ) : (
                      <Badge className="bg-muted text-muted-foreground">Quota Full</Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          /* No subscription: show listings but require subscription to feature */
          <div className="space-y-3">
            {myListings.map(listing => (
              <Card key={listing.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  {listing.photos?.[0] && (
                    <img src={listing.photos[0]} className="w-16 h-12 rounded-lg object-cover shrink-0" alt="" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm line-clamp-1">{listing.title}</p>
                    <p className="text-xs text-muted-foreground">
                      ${listing.price_mxn?.toLocaleString() || listing.price_usd?.toLocaleString()}<span className="text-[10px] font-normal text-muted-foreground ml-0.5"> MXN</span>/mo
                    </p>
                  </div>
                  {listing.is_featured ? (
                    <Badge className="bg-yellow-100 text-yellow-800 gap-1">
                      <Star className="w-3 h-3" /> Featured
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      Pro Plan Required
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* <p className="text-xs text-muted-foreground mt-8 text-center">
        Payments are processed securely by Stripe. You can cancel your subscription anytime from the Stripe portal.
      </p> */}
    </div>
  );
}