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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    // ── Verify Stripe signature ────────────────────────────────────────────────
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || Deno.env.get('SIGNATURE_SECRET') || '';
    const sig = req.headers.get('stripe-signature') || '';

    if (!webhookSecret) {
      console.error('Missing webhook secret in environment.');
      return new Response(JSON.stringify({ error: 'Missing webhook secret' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!sig) {
      console.error('Missing stripe-signature header.');
      return new Response(JSON.stringify({ error: 'Missing signature header' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const payloadBuffer = await req.arrayBuffer();
    const payload = new TextDecoder().decode(payloadBuffer);

    const sigPairs = sig.split(',').map((part: string) => part.trim().split('='));
    const parsedSig = sigPairs.reduce((acc: Record<string, string | string[]>, [key, value]) => {
      if (!key || value === undefined) return acc;
      if (acc[key]) {
        acc[key] = Array.isArray(acc[key]) ? [...acc[key], value] : [acc[key], value];
      } else {
        acc[key] = value;
      }
      return acc;
    }, {});

    const timestamp = Array.isArray(parsedSig.t) ? parsedSig.t[0] : parsedSig.t;
    const signatures = parsedSig.v1 ? (Array.isArray(parsedSig.v1) ? parsedSig.v1 : [parsedSig.v1]) : [];

    if (!timestamp || signatures.length === 0) {
      console.error('Invalid stripe-signature header format.');
      return new Response(JSON.stringify({ error: 'Invalid signature header format' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const encoder = new TextEncoder();
    const secretKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const message = encoder.encode(`${timestamp}.${payload}`);
    const signatureBuffer = await crypto.subtle.sign('HMAC', secretKey, message);
    const expected = Array.from(new Uint8Array(signatureBuffer))
      .map((b: number) => b.toString(16).padStart(2, '0'))
      .join('');

    const signatureMatch = signatures.some((candidate: string) => candidate === expected);
    if (!signatureMatch) {
      console.error('Computed signature mismatch.');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let event;
    try {
      event = JSON.parse(payload);
    } catch (err: any) {
      console.error('Failed to parse webhook payload:', err.message);
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const type = event.type;
    const obj = event.data.object;
    console.log('Unified webhook received event:', type, obj.id);

    // ── checkout.session.completed ──────────────────────────────────────────────
    if (type === 'checkout.session.completed') {
      const session = obj;
      const metadata = session.metadata || {};
      const stripeSessionId = session.id || null;
      const amountCents = session.amount_total || null;
      const currency = (session.currency || 'mxn').toLowerCase();
      const paymentMode = metadata.mode || session.mode || null;
      const isBookingPayment = metadata.type === 'booking' || !!metadata.bookingId;
      const isSubscriptionPayment = paymentMode === 'subscription' || metadata.type === 'subscription' || metadata.subscription === 'true';
      const isAgentSubscription = isSubscriptionPayment && metadata.role === 'agent';
      const isOwnerRenterSubscription = isSubscriptionPayment && metadata.role && metadata.role !== 'agent';
      const isFeatureBoost = paymentMode === 'payment' && metadata.type === 'feature_boost' && metadata.role === 'agent';
      const userEmail = metadata.userEmail || session.customer_details?.email || null;
      const agentEmail = metadata.agentEmail || (metadata.role === 'agent' ? userEmail : null);
      const sessionCreatedAt = session.created ? new Date(session.created * 1000).toISOString() : new Date().toISOString();
      const paymentIntentId = session.payment_intent || null;

      // ── Agent Subscription ─────────────────────────────────────────────────────
      if (isAgentSubscription) {
        const plan = metadata.plan;
        const stripeSubscriptionId = session.subscription || null;

        console.log('Agent subscription completed:', { agentEmail, plan });

        if (agentEmail && plan) {
          let agentProfile: any = null;
          const { data } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', agentEmail)
            .maybeSingle();
          agentProfile = data;

          const agentId = agentProfile?.id || null;

          if (!agentId) {
            console.error('Agent profile not found for email:', agentEmail);
          } else {
            const { data: existing } = await supabase
              .from('subscriptions')
              .select('id')
              .eq('user_id', agentId)
              .maybeSingle();

            if (existing) {
              await supabase
                .from('subscriptions')
                .update({
                  stripe_customer_id: session.customer || null,
                  stripe_subscription_id: stripeSubscriptionId,
                  plan: plan,
                  amount_centavos: amountCents,
                  amount: amountCents ? amountCents / 100 : null,
                  status: 'active',
                  current_period_end: session.current_period_end ? new Date(session.current_period_end * 1000).toISOString() : null,
                  last_payment_date: sessionCreatedAt,
                })
                .eq('id', existing.id);
              console.log('Updated existing subscription record for agent:', existing.id);
            } else {
              const { error: insertError } = await supabase.from('subscriptions').insert({
                user_id: agentId,
                stripe_customer_id: session.customer || null,
                stripe_subscription_id: stripeSubscriptionId,
                plan: plan,
                amount_centavos: amountCents,
                amount: amountCents ? amountCents / 100 : null,
                status: 'active',
                current_period_end: session.current_period_end ? new Date(session.current_period_end * 1000).toISOString() : null,
                last_payment_date: sessionCreatedAt,
                featured_listing_ids: [],
              });

              if (insertError) {
                console.error('Failed to insert subscription record for agent:', insertError.message);
              } else {
                console.log('Successfully inserted subscription record for agent:', agentEmail);
              }
            }
          }



          await supabase
            .from('profiles')
            .update({ role: 'agent' })
            .eq('email', agentEmail)
            .neq('role', 'admin');
        }
      }

      // ── Owner / Renter Subscription ───────────────────────────────────────────
      else if (isOwnerRenterSubscription) {
        const plan = metadata.plan || 'basic';
        const stripeCustomerId = session.customer || null;
        const stripeSubscriptionId = session.subscription || null;
        const currentPeriodEnd = session.current_period_end ? new Date(session.current_period_end * 1000).toISOString() : null;

        console.log('Owner/Renter subscription completed:', { userEmail, plan });

        if (!userEmail) {
          console.error('Missing userEmail for subscription event.');
        } else {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', userEmail)
            .maybeSingle();

          if (!profile?.id) {
            console.error('Profile not found for subscription user:', userEmail);
          } else {
            const { data: existing } = await supabase
              .from('subscriptions')
              .select('id')
              .eq('user_id', profile.id)
              .maybeSingle();

            if (existing) {
              await supabase
                .from('subscriptions')
                .update({
                  stripe_customer_id: stripeCustomerId,
                  stripe_subscription_id: stripeSubscriptionId,
                  plan: plan,
                  amount_centavos: amountCents,
                  amount: amountCents ? amountCents / 100 : null,
                  status: 'active',
                  current_period_end: currentPeriodEnd,
                  last_payment_date: sessionCreatedAt,
                })
                .eq('id', existing.id);
              console.log('Updated existing subscription for user:', userEmail);
            } else {
              const { error: insertError } = await supabase.from('subscriptions').insert({
                user_id: profile.id,
                stripe_customer_id: stripeCustomerId,
                stripe_subscription_id: stripeSubscriptionId,
                plan: plan,
                amount_centavos: amountCents,
                amount: amountCents ? amountCents / 100 : null,
                status: 'active',
                current_period_end: currentPeriodEnd,
                last_payment_date: sessionCreatedAt,
                featured_listing_ids: [],
              });
              if (insertError) {
                console.error('Failed to insert subscription record:', insertError.message);
              } else {
                console.log('Inserted subscription record for user:', userEmail);
              }
            }
          }
        }
      }

      // ── Feature Boost (one-time payment) ──────────────────────────────────────
      else if (isFeatureBoost) {
        const listingId = metadata.listingId;
        console.log('Feature boost completed:', { agentEmail, listingId });

        if (listingId) {
          const featuredUntil = new Date();
          featuredUntil.setDate(featuredUntil.getDate() + 30);

          const { error: updateError } = await supabase
            .from('listings')
            .update({
              is_featured: true,
              featured_until: featuredUntil.toISOString(),
            })
            .eq('id', listingId);

          if (updateError) {
            console.error('Failed to feature listing:', updateError.message);
          } else {
            console.log('Successfully featured listing:', listingId, 'until', featuredUntil.toISOString());
          }
        }

        if (agentEmail && listingId) {
          const { data: agentProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', agentEmail)
            .maybeSingle();

          const agentId = agentProfile?.id || null;

          if (agentId) {
            const { data: agentSub } = await supabase
              .from('subscriptions')
              .select('id, featured_listing_ids')
              .eq('user_id', agentId)
              .eq('status', 'active')
              .maybeSingle();

            if (agentSub) {
              const currentIds = Array.isArray(agentSub.featured_listing_ids) ? agentSub.featured_listing_ids : [];
              if (!currentIds.includes(listingId)) {
                await supabase
                  .from('subscriptions')
                  .update({ featured_listing_ids: [...currentIds, listingId] })
                  .eq('id', agentSub.id);
                console.log('Added listing to featured_listing_ids:', listingId);
              }
            } else {
              await supabase.from('subscriptions').insert({
                user_id: agentId,
                plan: 'basic',
                status: 'active',
                featured_listing_ids: [listingId],
              });
            }
          }


        }
      }

      // ── Renter Booking Payment ────────────────────────────────────────────────
      else if (isBookingPayment) {
        const bookingId = metadata.bookingId;
        const listingId = metadata.listingId || null;
        const payerEmail = session.customer_details?.email || null;

        console.log('Booking payment completed:', { bookingId, listingId, payerEmail });

        // Check for duplicate payment
        const { data: existingPayment } = await supabase
          .from('payments')
          .select('id')
          .or(`stripe_event_id.eq.${event.id},stripe_session_id.eq.${stripeSessionId}`)
          .limit(1)
          .maybeSingle();

        if (existingPayment) {
          console.log('Skipping duplicate booking payment for event:', event.id);
        } else {
          // Fetch booking to get owner and agent IDs
          let ownerId = null;
          let agentId = null;
          if (bookingId) {
            const { data: booking } = await supabase
              .from('bookings')
              .select('owner_id, agent_id')
              .eq('id', bookingId)
              .maybeSingle();
            if (booking) {
              ownerId = booking.owner_id || null;
              agentId = booking.agent_id || null;
            }
          }

          // Resolve profile IDs
          let payerId = null;
          let ownerStripeId = null;

          if (payerEmail) {
            const { data: payer } = await supabase.from('profiles').select('id').eq('email', payerEmail).maybeSingle();
            if (payer) payerId = payer.id;
          }

          if (ownerId) {
            const { data: owner } = await supabase.from('profiles').select('stripe_connect_id').eq('id', ownerId).maybeSingle();
            if (owner) {
              ownerStripeId = owner.stripe_connect_id || null;
            }
          }

          const paymentIntentId = session.payment_intent || null;

          const { error: insertError } = await supabase.from('payments').insert({
            booking_id: bookingId,
            listing_id: listingId,
            payer_id: payerId,
            payee_id: ownerId,
            payee_stripe_connect_id: ownerStripeId,
            amount_centavos: amountCents,
            amount_mxn: amountCents ? (amountCents / 100) : null,
            payout_status: 'pending',
            currency: 'mxn',
            stripe_event_id: event.id,
            stripe_session_id: stripeSessionId,
            stripe_payment_intent_id: paymentIntentId,
            payment_type: 'booking',
          });

          if (insertError) {
            console.error('Failed to insert payment record:', insertError.message);
          } else {
            console.log('Successfully inserted payment record.');
            if (bookingId) {
              const { error: bookingUpdateError } = await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', bookingId);
              if (bookingUpdateError) {
                console.error('Failed to update booking status:', bookingUpdateError.message);
              } else {
                console.log('Successfully updated booking status to confirmed.');

                const emailServerUrl = Deno.env.get('EMAIL_SERVER_URL') || 'https://email.pvverified.com';
                const emailHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
                const emailSecret = Deno.env.get('INTERNAL_EMAIL_SECRET');
                if (emailSecret) emailHeaders['x-internal-email-secret'] = emailSecret;

                try {
                  const invoiceResponse = await fetch(`${emailServerUrl}/send-payment-invoice`, {
                    method: 'POST',
                    headers: emailHeaders,
                    body: JSON.stringify({
                      bookingId,
                      amount: amountCents ? amountCents / 100 : 0,
                      currency,
                      paymentDate: sessionCreatedAt,
                      stripeSessionId,
                      stripePaymentIntentId: paymentIntentId,
                    }),
                  });

                  if (!invoiceResponse.ok) {
                    console.error('Payment invoice email failed:', invoiceResponse.status, await invoiceResponse.text());
                  } else {
                    console.log('Payment invoice emails sent for booking:', bookingId);
                  }
                } catch (emailError) {
                  console.error('Payment invoice email request failed:', emailError);
                }
              }
            }
          }
        }
      }
    }

    // ── customer.subscription.deleted ───────────────────────────────────────────
    if (type === 'customer.subscription.deleted') {
      const subscription = obj;
      const stripeSubscriptionId = subscription.id;

      const { data: agentSub } = await supabase
        .from('agent_subscriptions')
        .select('id')
        .eq('stripe_subscription_id', stripeSubscriptionId)
        .maybeSingle();

      if (agentSub) {
        await supabase
          .from('agent_subscriptions')
          .update({ status: 'cancelled' })
          .eq('id', agentSub.id);
        console.log('Cancelled agent subscription:', agentSub.id);
      }

      const { data: ownerRenterSub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('stripe_subscription_id', stripeSubscriptionId)
        .maybeSingle();

      if (ownerRenterSub) {
        await supabase
          .from('subscriptions')
          .update({ status: 'cancelled' })
          .eq('id', ownerRenterSub.id);
        console.log('Cancelled owner/renter subscription:', ownerRenterSub.id);
      }
    }

    // ── payment_intent.succeeded (logged but not processed) ─────────────────────
    if (type === 'payment_intent.succeeded') {
      console.log('Skipping payment_intent.succeeded — handled by checkout.session.completed.');
    }

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error('Unified webhook processing error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});