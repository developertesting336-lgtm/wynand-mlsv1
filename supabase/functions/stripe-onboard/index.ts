import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.22.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

export const getCorsHeaders = (originHeader: string | null) => {
  const origin = originHeader ?? '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',

    'Access-Control-Max-Age': '86400',
  };
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));


  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });



    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );



    const { email, origin } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }



    // Find profile
    let { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }




    let stripeConnectId = profile.stripe_connect_id;
    let accountExists = false;

    if (stripeConnectId) {
      try {
        await stripe.accounts.retrieve(stripeConnectId);
        accountExists = true;
      } catch (err) {
        console.log(`Account ${stripeConnectId} retrieve failed: ${err.message}. Creating a new one.`);
      }
    }

    if (!stripeConnectId || !accountExists) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: email,
        business_type: 'individual',
        capabilities: {
          transfers: { requested: true },
        },
      });
      stripeConnectId = account.id;

      await supabase
        .from('profiles')
        .update({
          stripe_connect_id: stripeConnectId,
          stripe_onboarding_complete: false
        })
        .eq('id', profile.id);
    }

    let dashboardPath = '/owner-dashboard';
    if (profile.role === 'renter') {
      dashboardPath = '/dashboard';
    } else if (profile.role === 'agent') {
      dashboardPath = '/agent-dashboard';
    }

    const accountLink = await stripe.accountLinks.create({
      account: stripeConnectId,
      refresh_url: `${origin}${dashboardPath}?stripe=refresh`,
      return_url: `${origin}${dashboardPath}?stripe=success`,
      type: 'account_onboarding',
    });

    return new Response(JSON.stringify({ url: accountLink.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
