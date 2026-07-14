import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Stripe from 'npm:stripe@14.22.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

export const getCorsHeaders = (originHeader: string | null) => ({
  'Access-Control-Allow-Origin': originHeader ?? '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
});

serve(async (req: any) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const {
      userEmail,
      role,
      plan,
      mode,
      listingId,
      successUrl,
      cancelUrl,
    } = await req.json();

    if (!userEmail || !successUrl || !cancelUrl) {
      return new Response(JSON.stringify({ error: 'userEmail, successUrl, and cancelUrl are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const normalizedRole = (role || '').toLowerCase();
    const paymentMode = mode || 'subscription';
    const metadata: Record<string, any> = {
      userEmail,
      role: normalizedRole,
      mode: paymentMode,
      type: paymentMode === 'subscription' ? 'subscription' : 'feature_boost',
      subscription: paymentMode === 'subscription' ? 'true' : 'false',
    };
    if (plan) metadata.plan = plan;
    if (listingId) metadata.listingId = listingId;
    if (normalizedRole === 'agent') metadata.agentEmail = userEmail;

    const sessionParams: Record<string, any> = {
      payment_method_types: ['card'],
      customer_email: userEmail,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
    };

    if (paymentMode === 'payment') {
      sessionParams.mode = 'payment';
      sessionParams.line_items = [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Listing Feature Boost',
              description: 'Feature your listing at the top of search results for 30 days',
            },
            unit_amount: 1900,
          },
          quantity: 1,
        },
      ];
    } else {
      sessionParams.mode = 'subscription';

      const planPrices: Record<string, { amount: number; name: string }> = normalizedRole === 'agent'
        ? {
          basic: { amount: 2900, name: 'Basic Agent Plan' },
          pro: { amount: 7900, name: 'Pro Agent Plan' },
        }
        : {
          basic: { amount: 999, name: 'Premium Membership' },
        };

      const planInfo = planPrices[plan] || planPrices[normalizedRole === 'agent' ? 'basic' : 'basic'];

      sessionParams.line_items = [
        {
          price_data: {
            currency: 'usd',
            recurring: { interval: 'month' },
            product_data: {
              name: planInfo.name,
              description: `Monthly subscription for ${planInfo.name}`,
            },
            unit_amount: planInfo.amount,
          },
          quantity: 1,
        },
      ];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Subscriptions checkout error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Failed to create checkout session' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});