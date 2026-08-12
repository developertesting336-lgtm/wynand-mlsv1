import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Stripe from 'npm:stripe@14.22.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

export const getCorsHeaders = (originHeader: string | null) => ({
    'Access-Control-Allow-Origin': originHeader ?? '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
});

serve(async (req) => {

    const corsHeaders = getCorsHeaders(req.headers.get('origin'));

    if (req.method === 'OPTIONS') {

        return new Response(null, {
            status: 204,
            headers: corsHeaders,
        });
    }

    try {
        const stripe = new Stripe(
            Deno.env.get('STRIPE_SECRET_KEY') || '',
            {
                apiVersion: '2023-10-16',
                httpClient: Stripe.createFetchHttpClient(),
            }
        );

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') || '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        );

        const { data: payments, error: paymentsError } = await supabase
            .from('payments')
            .select(`
                id,
                booking_id,
                amount_centavos,
                currency,
                payee_stripe_connect_id,
                payee_id,
                payer_id,
                payout_status,
                payment_type
            `)
            .eq('payout_status', 'pending');

        if (paymentsError) {
            console.error('Payments query failed:', paymentsError);
            throw paymentsError;
        }


        const processed = [];
        const skipped = [];

        for (const payment of payments || []) {

            if (!payment.booking_id) {

                skipped.push({
                    id: payment.id,
                    reason: 'No booking_id associated with payment',
                });

                continue;
            }



            const { data: booking, error: bookingError } = await supabase
                .from('bookings')
                .select('id, status, move_in_date, owner_id, agent_id, referral_code, agent_referral, listing_id, agreement_conditions, lease_duration_months')
                .eq('id', payment.booking_id)
                .maybeSingle();

            if (bookingError || !booking) {
                console.error(
                    `[SKIPPED] Payment ${payment.id}: Booking not found`,
                    bookingError
                );

                skipped.push({
                    id: payment.id,
                    reason: `Booking not found or error: ${bookingError?.message}`,
                });

                continue;
            }


            if (booking.status !== 'confirmed') {


                skipped.push({
                    id: payment.id,
                    reason: `Booking status is '${booking.status}', expected 'confirmed'`,
                });

                continue;
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const moveInDate = new Date(booking.move_in_date);
            moveInDate.setHours(0, 0, 0, 0);


            if (today < moveInDate) {


                skipped.push({
                    id: payment.id,
                    reason: `Move-in date (${booking.move_in_date}) has not arrived yet`,
                });

                continue;
            }


            // Fetch owner's Stripe Connect ID from profiles if not stored
            let payeeStripeConnectId = payment.payee_stripe_connect_id;
            let ownerId = payment.payee_id; // Try from payment first

            // Fallback to booking.owner_id if payee_id is not set
            if (!ownerId && booking.owner_id) {
                ownerId = booking.owner_id;
            }

            if (!payeeStripeConnectId && ownerId) {
                const { data: payeeProfile } = await supabase
                    .from('profiles')
                    .select('stripe_connect_id')
                    .eq('id', ownerId)
                    .single();

                payeeStripeConnectId = payeeProfile?.stripe_connect_id || null;

                // Update the payment record with the Stripe Connect ID and payee_id for future use
                if (payeeStripeConnectId) {
                    await supabase
                        .from('payments')
                        .update({
                            payee_stripe_connect_id: payeeStripeConnectId,
                            payee_id: ownerId
                        })
                        .eq('id', payment.id);
                }
            }

            if (!payeeStripeConnectId) {
                // Don't mark as failed - owner might set up Stripe Connect later
                // Just skip and keep as pending for next cron run
                skipped.push({
                    id: payment.id,
                    reason: 'Owner has not setup Stripe Connect yet - will retry later',
                });

                continue;
            }

            // ── COMMISSION DISTRIBUTION ───────────────────────────────────────────────
            //
            // booking.agent_id       = the assigned agent for this property/booking
            // booking.agent_referral = UUID of another agent who referred this booking
            // booking.referral_code  = UUID of a normal user (owner/renter) who referred
            //
            // Case 1: No agent_id, no agent_referral, no referral_code
            //   Platform fee = payment × 10%
            //   IVA           = platform_fee × 16%
            //   Platform gets = platform_fee + IVA
            //   Owner gets    = payment − platform_fee − IVA
            //
            // Case 2: agent_id only (no agent_referral, no referral_code)
            //   Commission    = lease-duration tier × monthly_rent
            //   Platform fee  = commission × 10%
            //   IVA           = platform_fee × 16%
            //   Platform gets = platform_fee + IVA
            //   Agent gets    = commission − platform_fee − IVA   (net commission)
            //   Owner gets    = payment − commission
            //
            // Case 3: agent_id + referral_code
            //   Same deductions as Case 2 on commission
            //   net_commission = commission − platform_fee − IVA
            //   Referrer gets  = net_commission × 10%
            //   Agent gets     = net_commission × 90%
            //   Owner gets     = payment − commission
            //
            // Case 4: agent_id + agent_referral
            //   Same deductions as Case 2 on commission
            //   net_commission       = commission − platform_fee − IVA
            //   Referring agent gets = net_commission × 10%
            //   Agent gets           = net_commission × 90%
            //   Owner gets           = payment − commission

            const hasAgent = !!booking.agent_id;
            const hasAgentReferral = !!booking.agent_referral;
            const hasReferralCode = !!booking.referral_code;

            // ── LEASE DURATION & MONTHLY RENT ────────────────────────────────────────
            const conditions = booking.agreement_conditions || {};
            let leaseDuration = 12;
            if (conditions.leaseDuration) {
                leaseDuration = parseInt(conditions.leaseDuration, 10) || 12;
            } else if (booking.lease_duration_months) {
                leaseDuration = booking.lease_duration_months;
            }

            let monthlyRent = 0;
            if (conditions.monthlyRent) {
                if (typeof conditions.monthlyRent === 'number') {
                    monthlyRent = conditions.monthlyRent;
                } else {
                    monthlyRent = parseFloat(conditions.monthlyRent.toString().replace(/[^0-9.]/g, '')) || 0;
                }
            } else {
                const { data: listingData } = await supabase
                    .from('listings')
                    .select('price_mxn, price_usd')
                    .eq('id', booking.listing_id)
                    .maybeSingle();
                monthlyRent = listingData?.price_mxn || listingData?.price_usd || (payment.amount_centavos / 100);
            }

            const monthlyRentCents = Math.round(monthlyRent * 100);
            let commissionPct = 0.20;
            if (leaseDuration >= 12) {
                commissionPct = 1.0;
            } else if (leaseDuration >= 6) {
                commissionPct = 0.5;
            }
            let baseCommissionCents = Math.round(monthlyRentCents * commissionPct);
            if (baseCommissionCents > payment.amount_centavos) {
                console.warn(`[WARNING] Commission ${baseCommissionCents}¢ exceeds payment ${payment.amount_centavos}¢. Capping.`);
                baseCommissionCents = payment.amount_centavos;
            }

            // ── PAYOUT AMOUNTS ────────────────────────────────────────────────────────
            let ownerPayoutAmount = 0;
            let agentPayoutAmount = 0;
            let referrerPayoutAmount = 0;
            let platformPayoutAmount = 0;

            if (payment.payment_type === 'monthly_rent') {
                // Monthly rent: owner always receives 100%
                ownerPayoutAmount = payment.amount_centavos;
                console.log(`[MONTHLY_RENT] Owner receives 100% = ${ownerPayoutAmount}¢`);

            } else if (!hasAgent) {
                if (hasReferralCode) {
                    // ── Case 1.5: No agent, but has referral_code ───────────────────
                    // Owner gets: 80% of total payment
                    // Platform gets: 5% platform fee + 16% IVA on that 5% fee (which is 0.8% of total payment)
                    // Referrer gets: 15% of total payment minus the platform's 16% IVA tax (which is deducted from referrer)
                    ownerPayoutAmount = Math.round(payment.amount_centavos * 0.80);
                    
                    const platformBaseCents = Math.round(payment.amount_centavos * 0.05);
                    const platformIva = Math.round(platformBaseCents * 0.16); // 16% on the platform's 5%
                    platformPayoutAmount = platformBaseCents + platformIva;

                    const referrerBaseCents = Math.round(payment.amount_centavos * 0.15);
                    referrerPayoutAmount = referrerBaseCents - platformIva; // Deduct the platform's IVA from referrer's share

                    // Adjust any rounding differences so sum equals total payment
                    const sum = ownerPayoutAmount + referrerPayoutAmount + platformPayoutAmount;
                    if (sum !== payment.amount_centavos) {
                        const diff = payment.amount_centavos - sum;
                        ownerPayoutAmount += diff;
                    }

                    console.log(`[Case 1.5] No agent + referral (Refined IVA): owner=${ownerPayoutAmount}¢, referrer=${referrerPayoutAmount}¢ (base=${referrerBaseCents}¢ - iva=${platformIva}¢), platform=${platformPayoutAmount}¢ (base=${platformBaseCents}¢ + iva=${platformIva}¢)`);
                } else {
                    // ── Case 1: No agent, no referral ────────────────────────────────
                    const platformFeeCents = Math.round(payment.amount_centavos * 0.10);
                    const ivaCents = Math.round(platformFeeCents * 0.16);
                    platformPayoutAmount = platformFeeCents + ivaCents;
                    ownerPayoutAmount = payment.amount_centavos - platformPayoutAmount;
                    console.log(`[Case 1] No agent, no referral: owner=${ownerPayoutAmount}¢, platform=${platformPayoutAmount}¢ (fee=${platformFeeCents}¢ + iva=${ivaCents}¢)`);
                }

            } else {
                // ── Cases 2/3/4: Agent present ───────────────────────────────────────
                const commissionCents = baseCommissionCents;
                const platformFeeCents = Math.round(commissionCents * 0.10);
                const ivaCents = Math.round(platformFeeCents * 0.16);
                platformPayoutAmount = platformFeeCents + ivaCents;
                const netCommissionCents = commissionCents - platformFeeCents - ivaCents;
                ownerPayoutAmount = payment.amount_centavos - commissionCents;

                if (hasAgentReferral) {
                    // ── Case 4: Agent + agent_referral ───────────────────────────────
                    referrerPayoutAmount = Math.round(netCommissionCents * 0.10);
                    agentPayoutAmount = netCommissionCents - referrerPayoutAmount;
                    console.log(`[Case 4] Agent + agent_referral: agent=${agentPayoutAmount}¢, referring_agent=${referrerPayoutAmount}¢, owner=${ownerPayoutAmount}¢, platform=${platformPayoutAmount}¢`);

                } else if (hasReferralCode) {
                    // ── Case 3: Agent + referral_code ────────────────────────────────
                    referrerPayoutAmount = Math.round(netCommissionCents * 0.10);
                    agentPayoutAmount = netCommissionCents - referrerPayoutAmount;
                    console.log(`[Case 3] Agent + referral_code: agent=${agentPayoutAmount}¢, referrer=${referrerPayoutAmount}¢, owner=${ownerPayoutAmount}¢, platform=${platformPayoutAmount}¢`);

                } else {
                    // ── Case 2: Agent only ───────────────────────────────────────────
                    agentPayoutAmount = netCommissionCents;
                    console.log(`[Case 2] Agent only: agent=${agentPayoutAmount}¢, owner=${ownerPayoutAmount}¢, platform=${platformPayoutAmount}¢`);
                }
            }

            ownerPayoutAmount = Math.max(0, ownerPayoutAmount);
            agentPayoutAmount = Math.max(0, agentPayoutAmount);
            referrerPayoutAmount = Math.max(0, referrerPayoutAmount);
            platformPayoutAmount = Math.max(0, platformPayoutAmount);

            // ── STRIPE TRANSFERS & DB RECORDS ─────────────────────────────────────────
            try {
                const transferCurrency = 'mxn';
                let ownerTransferId: string | null = null;
                let agentTransferId: string | null = null;
                let referrerTransferId: string | null = null;
                let agentTransferFailed = false;
                let referrerTransferFailed = false;

                // 1. Transfer to owner
                if (ownerPayoutAmount > 0) {
                    const ownerTransfer = await stripe.transfers.create({
                        amount: ownerPayoutAmount,
                        currency: transferCurrency,
                        destination: payeeStripeConnectId,
                        description: `Owner payout for Booking #${booking.id}`,
                    });
                    ownerTransferId = ownerTransfer.id;
                    console.log(`Owner transfer done: ${ownerPayoutAmount}¢ → ${ownerTransferId}`);
                } else {
                    console.log(`[INFO] Skipping owner transfer (amount is 0)`);
                }

                // 2. Log platform earnings
                if (platformPayoutAmount > 0) {
                    const { error: platformInsertError } = await supabase.from('platform_earnings').insert({
                        id: crypto.randomUUID(),
                        user_id: booking.owner_id,
                        booking_id: payment.booking_id,
                        amount_centavos: platformPayoutAmount,
                        amount_mxn: platformPayoutAmount / 100,
                        currency: payment.currency || 'mxn',
                        payout_status: 'paid',
                        payout_error: null,
                        created_date: new Date().toISOString(),
                    });
                    if (platformInsertError) {
                        console.error('Failed to insert platform earning record:', platformInsertError.message);
                    }
                }

                // 3. Transfer to agent (Cases 2, 3, 4)
                if (agentPayoutAmount > 0 && booking.agent_id) {
                    try {
                        const { data: agentInfo } = await supabase
                            .from('profiles')
                            .select('stripe_connect_id')
                            .eq('id', booking.agent_id)
                            .single();

                        if (agentInfo?.stripe_connect_id) {
                            const agentTransfer = await stripe.transfers.create({
                                amount: agentPayoutAmount,
                                currency: transferCurrency,
                                destination: agentInfo.stripe_connect_id,
                                description: `Agent commission for Booking #${booking.id}`,
                            });
                            agentTransferId = agentTransfer.id;
                            console.log(`Agent transfer done: ${agentPayoutAmount}¢ → ${agentTransferId}`);
                        } else {
                            console.error(`Agent ${booking.agent_id} has no Stripe Connect ID — agent commission not paid`);
                            agentTransferFailed = true;
                        }
                    } catch (agentErr: any) {
                        console.error(`Failed to pay agent ${booking.agent_id}:`, agentErr?.message);
                        agentTransferFailed = true;
                    }
                }

                // 4. Transfer to referrer
                //    Case 3: booking.referral_code = normal user UUID
                //    Case 4: booking.agent_referral = referring agent UUID
                const referrerUUID = booking.agent_referral || booking.referral_code || null;
                if (referrerPayoutAmount > 0 && referrerUUID) {
                    try {
                        const { data: referrerInfo } = await supabase
                            .from('profiles')
                            .select('stripe_connect_id')
                            .eq('id', referrerUUID)
                            .single();

                        if (referrerInfo?.stripe_connect_id) {
                            const refTransfer = await stripe.transfers.create({
                                amount: referrerPayoutAmount,
                                currency: transferCurrency,
                                destination: referrerInfo.stripe_connect_id,
                                description: hasAgentReferral
                                    ? `Referring agent commission for Booking #${booking.id}`
                                    : `Referral commission for Booking #${booking.id}`,
                            });
                            referrerTransferId = refTransfer.id;
                            console.log(`Referrer transfer done: ${referrerPayoutAmount}¢ → ${referrerTransferId}`);
                        } else {
                            console.error(`Referrer ${referrerUUID} has no Stripe Connect ID — referral commission not paid`);
                            referrerTransferFailed = true;
                        }
                    } catch (refErr: any) {
                        console.error(`Failed to pay referrer ${referrerUUID}:`, refErr?.message);
                        referrerTransferFailed = true;
                    }
                }

                // 5. Record referral_payments entries
                if (agentPayoutAmount > 0 && booking.agent_id) {
                    await supabase.from('referral_payments').insert({
                        id: crypto.randomUUID(),
                        referral_id: booking.agent_id,
                        booking_id: payment.booking_id,
                        payer_id: payment.payer_id,
                        referrer_id: booking.agent_id,
                        amount_centavos: agentPayoutAmount,
                        amount_mxn: agentPayoutAmount / 100,
                        currency: payment.currency || 'mxn',
                        payout_status: agentTransferId ? 'paid' : (agentTransferFailed ? 'failed' : 'pending'),
                        payout_transfer_id: agentTransferId || null,
                        paid_date: agentTransferId ? new Date().toISOString() : null,
                    });
                }

                if (referrerPayoutAmount > 0 && referrerUUID) {
                    await supabase.from('referral_payments').insert({
                        id: crypto.randomUUID(),
                        referral_id: referrerUUID,
                        booking_id: payment.booking_id,
                        payer_id: payment.payer_id,
                        referrer_id: referrerUUID,
                        amount_centavos: referrerPayoutAmount,
                        amount_mxn: referrerPayoutAmount / 100,
                        currency: payment.currency || 'mxn',
                        payout_status: referrerTransferId ? 'paid' : (referrerTransferFailed ? 'failed' : 'pending'),
                        payout_transfer_id: referrerTransferId || null,
                        paid_date: referrerTransferId ? new Date().toISOString() : null,
                    });
                }

                // 6. Determine additional_data payload for audit
                let additionalDataJson: Record<string, boolean> = {};
                if (hasAgent && (hasAgentReferral || hasReferralCode)) {
                    additionalDataJson = { agent_and_referral_paid: true };
                } else if (hasAgent) {
                    additionalDataJson = { agent_paid: true };
                } else {
                    additionalDataJson = { no_agent: true };
                }

                // 7. Update the main payment record
                const { error: updateError } = await supabase
                    .from('payments')
                    .update({
                        payout_status: 'paid',
                        payout_transfer_id: ownerTransferId,
                        payout_error: (agentTransferFailed || referrerTransferFailed)
                            ? `Owner paid (${ownerTransferId}), some commission transfers failed`
                            : null,
                        additional_data: additionalDataJson,
                    })
                    .eq('id', payment.id);

                if (updateError) {
                    console.error('Failed to update payment record:', updateError);
                }

                processed.push({
                    id: payment.id,
                    transferId: ownerTransferId,
                    amount: ownerPayoutAmount,
                });

            } catch (stripeErr: any) {
                console.error(`[FAILED] Stripe Transfer failed for payment ${payment.id}`);
                console.error('Error message:', stripeErr?.message);
                console.error('Full error:', stripeErr);

                await supabase
                    .from('payments')
                    .update({
                        payout_status: 'failed',
                        payout_error: stripeErr?.message || 'Stripe transfer failed',
                    })
                    .eq('id', payment.id);

                skipped.push({
                    id: payment.id,
                    reason: `Stripe error: ${stripeErr?.message}`,
                });
            }

        }


        return new Response(
            JSON.stringify({
                success: true,
                processed,
                skipped,
            }),
            {
                status: 200,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json',
                },
            }
        );
    } catch (err: any) {
        console.error('PROCESS PAYOUTS ERROR');
        console.error(err);

        return new Response(
            JSON.stringify({
                error: err?.message || 'Unknown error',
            }),
            {
                status: 500,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json',
                },
            }
        );
    }
});