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

    const { email } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripeConnectId = profile.stripe_connect_id;
    if (!stripeConnectId) {
      return new Response(JSON.stringify({ complete: false, error: 'No stripe_connect_id' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Retrieve account from Stripe to verify status
    const account = await stripe.accounts.retrieve(stripeConnectId as string);

    // Consider onboarding complete when charges are enabled
    const complete = Boolean((account as any).charges_enabled);

    if (complete && !profile.stripe_onboarding_complete) {
      // Persist completion flag to the profiles table
      await supabase
        .from('profiles')
        .update({ stripe_onboarding_complete: true })
        .eq('id', profile.id);
    }

    return new Response(JSON.stringify({ complete, account }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
