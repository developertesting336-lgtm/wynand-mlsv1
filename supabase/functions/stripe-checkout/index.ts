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




    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey);




    const { bookingId, origin } = await req.json();

    if (!bookingId) {
      return new Response(JSON.stringify({ error: 'bookingId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }



    // 1. Fetch the booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    console.log(booking, '0000000000000000000000000000000000000')

    if (bookingError || !booking) {
      return new Response(JSON.stringify({ error: 'Booking not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }


    const agreementConditions = booking.agreement_conditions || {};
    const agentSigned = Boolean(agreementConditions.agentSignature);

    if (booking.status !== 'approved' || booking.lease_status !== 'signed' || !agentSigned) {
      return new Response(JSON.stringify({ error: 'Lease agreement must be signed by all parties before payment.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }



    // 2. Fetch the listing
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', booking.listing_id)
      .single();

    console.log(listing, '000000000000044444444444444400')

    if (listingError || !listing) {
      return new Response(JSON.stringify({ error: 'Listing not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Fetch the owner's profile using owner_id from booking
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', booking.owner_id)
      .single();

    console.log(profile, '00000000005555555548765454');


    if (profileError || !profile || !profile.stripe_connect_id) {
      return new Response(JSON.stringify({ error: 'Owner has not setup Stripe Connect yet.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Charge the renter for deposit + first month rent + last month rent.
    // Platform fee is taken from the amount paid to the connected account.
    // Use agreement_conditions from booking for deposit and rent
    const agreement = agreementConditions;
    const depositAmount = parseFloat(agreement.securityDepositAmount) || 0;
    const rentAmount = parseFloat((agreement.monthlyRent || '').toString().replace(/[^0-9.]/g, '')) || 0;
    const platformFeeAmount = Math.round(rentAmount * 0.10 * 100) / 100;
    const amountToCharge = depositAmount + (rentAmount * 2);
    const amountCents = Math.round(amountToCharge * 100);
    const platformFeeCents = Math.round(platformFeeAmount * 100);

    console.log('Creating checkout session', { bookingId, depositAmount, rentAmount, amountToCharge, amountCents, platformFeeCents, destination: profile.stripe_connect_id });

    const lineItems = [];
    if (depositAmount > 0) {
      lineItems.push({
        price_data: {
          currency: 'mxn',
          product_data: {
            name: 'Deposit',
            description: `Deposit for ${listing.title}`,
          },
          unit_amount: Math.round(depositAmount * 100),
        },
        quantity: 1,
      });
    }
    if (rentAmount > 0) {
      lineItems.push({
        price_data: {
          currency: 'mxn',
          product_data: {
            name: 'First Month Rent',
            description: `First month rent for ${listing.title} · platform fee is added on rent`,
          },
          unit_amount: Math.round(rentAmount * 100),
        },
        quantity: 1,
      });
      lineItems.push({
        price_data: {
          currency: 'mxn',
          product_data: {
            name: 'Last Month Rent',
            description: `Last month rent for ${listing.title}`,
          },
          unit_amount: Math.round(rentAmount * 100),
        },
        quantity: 1,
      });
    }

    // Create the Stripe Checkout Session
    // Get renter email from profile
    const { data: renterProfile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', booking.renter_id)
      .single();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: renterProfile?.email || '',
      line_items: lineItems,
      success_url: `${origin}/dashboard?payment=success&booking=${bookingId}`,
      cancel_url: `${origin}/dashboard?payment=cancel&booking=${bookingId}`,
      metadata: {
        bookingId: bookingId,
        listingId: listing.id,
      },
    });

    return new Response(JSON.stringify({
      url: session.url,
      amount_mxn: amountToCharge,
      amount_centavos: amountCents,
      platform_fee_cents: platformFeeCents,
      currency: 'MXN',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Stripe Checkout Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});