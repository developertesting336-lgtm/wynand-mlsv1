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
                amount_cents,
                currency,
                payee_stripe_connect_id,
                payee_id,
                payer_id,
                payout_status
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
                .select('id, status, move_in_date, owner_id, agent_id, referral_code, listing_id')
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


            // ── REFERRAL DETECTION ──────────────────────────────────────────────────
            // Priority:
            //   1) booking.agent_id + referral_code present → Booking agent referral
            //      → Owner 80%, Agent 15%
            //   2) No booking.agent_id → Check agent_referrals table (renter/owner)
            //   3) No agent referral → Check sale_referrals (buyer → seller)
            //   4) No referral → Owner gets 90%

            let isAgentReferral = false;
            let isAgentSelfReferral = false;
            let saleReferral = null;
            let referralPayoutAmount = 0;
            let platformPayoutAmount = 0;
            let referralPaymentId = null;

            // Get payer (renter) email from profiles
            const { data: payerProfile } = await supabase
                .from('profiles')
                .select('email')
                .eq('id', payment.payer_id)
                .single();

            // Get owner (seller) email from profiles
            const { data: ownerProfile } = await supabase
                .from('profiles')
                .select('email')
                .eq('id', booking.owner_id)
                .single();


            // console.log(booking, '0000000000000000000')

            // ── 1) AGENT REFERRAL CHECK (Booking-Level) ─────────────────────────────
            if (booking.agent_id || booking.referral_code) {
                isAgentSelfReferral = true;
                isAgentReferral = true;
                console.log(`Booking agent referral: agent_id=${booking.agent_id}, referral_code=${booking.referral_code} → owner 80%, agent 15%`);
            }

            // ── 2) AGENT REFERRALS CHECK (agent_referrals table) ──────────────────
            if (!isAgentReferral && !saleReferral) {
                if (payerProfile?.email) {
                    const { data: existingPaidAgentRenter } = await supabase
                        .from('agent_referrals')
                        .select('id')
                        .eq('client_email', payerProfile.email)
                        .eq('status', 'paid')
                        .limit(1)
                        .maybeSingle();

                    if (!existingPaidAgentRenter) {
                        const { data: foundAgentRenterRef } = await supabase
                            .from('agent_referrals')
                            .select('id, agent_id, referrer_id, commission_pct, status, client_email, client_phone')
                            .eq('client_email', payerProfile.email)
                            .eq('status', 'pending')
                            .limit(1)
                            .maybeSingle();

                        if (foundAgentRenterRef) {
                            const { data: renterProfile } = await supabase
                                .from('profiles')
                                .select('phone_number')
                                .eq('id', payment.payer_id)
                                .single();

                            const storedPhone = foundAgentRenterRef.client_phone?.replace(/\D/g, '');
                            const actualPhone = renterProfile?.phone_number?.replace(/\D/g, '');

                            if (storedPhone && actualPhone && storedPhone === actualPhone) {
                                saleReferral = {
                                    id: foundAgentRenterRef.id,
                                    referrer_id: foundAgentRenterRef.referrer_id,
                                    commission_pct: foundAgentRenterRef.commission_pct || 15,
                                    referral_type: 'agent',
                                    client_email: foundAgentRenterRef.client_email,
                                };
                                isAgentReferral = true;
                                console.log(`Found agent referral for renter ${payerProfile.email} (phone matched)`);
                            }
                        }
                    }
                }

                if (!isAgentReferral && !saleReferral && ownerProfile?.email) {
                    const { data: existingPaidAgentOwner } = await supabase
                        .from('agent_referrals')
                        .select('id')
                        .eq('client_email', ownerProfile.email)
                        .eq('status', 'paid')
                        .limit(1)
                        .maybeSingle();

                    if (!existingPaidAgentOwner) {
                        const { data: foundAgentOwnerRef } = await supabase
                            .from('agent_referrals')
                            .select('id, agent_id, referrer_id, commission_pct, status, client_email, client_phone')
                            .eq('client_email', ownerProfile.email)
                            .eq('status', 'pending')
                            .limit(1)
                            .maybeSingle();

                        if (foundAgentOwnerRef) {
                            const { data: ownerProfilePhone } = await supabase
                                .from('profiles')
                                .select('phone_number')
                                .eq('id', booking.owner_id)
                                .single();

                            const storedPhone = foundAgentOwnerRef.client_phone?.replace(/\D/g, '');
                            const actualPhone = ownerProfilePhone?.phone_number?.replace(/\D/g, '');

                            if (storedPhone && actualPhone && storedPhone === actualPhone) {
                                saleReferral = {
                                    id: foundAgentOwnerRef.id,
                                    referrer_id: foundAgentOwnerRef.referrer_id,
                                    commission_pct: foundAgentOwnerRef.commission_pct || 15,
                                    referral_type: 'agent',
                                    client_email: foundAgentOwnerRef.client_email,
                                };
                                isAgentReferral = true;
                                console.log(`Found agent referral for owner ${ownerProfile.email} (phone matched)`);
                            }
                        }
                    }
                }
            }

            // ── 3) SALE REFERRAL CHECK ─────────────────────────────────────────────
            if (!isAgentReferral && !saleReferral) {
                if (payerProfile?.email) {
                    const { data: existingPaidRef } = await supabase
                        .from('sale_referrals')
                        .select('id')
                        .eq('client_email', payerProfile.email)
                        .eq('status', 'paid')
                        .limit(1)
                        .maybeSingle();

                    if (!existingPaidRef) {
                        const { data: foundRef } = await supabase
                            .from('sale_referrals')
                            .select('id, referrer_id, commission_pct, status, referral_type, client_phone')
                            .eq('client_email', payerProfile.email)
                            .eq('status', 'pending')
                            .limit(1)
                            .maybeSingle();

                        if (foundRef && foundRef.referral_type === 'buyer') {
                            const { data: payerWithPhone } = await supabase
                                .from('profiles')
                                .select('phone_number')
                                .eq('id', payment.payer_id)
                                .single();

                            const storedPhone = foundRef.client_phone?.replace(/\D/g, '');
                            const actualPhone = payerWithPhone?.phone_number?.replace(/\D/g, '');

                            if (storedPhone && actualPhone && storedPhone === actualPhone) {
                                saleReferral = foundRef;
                                console.log(`Found valid buyer referral for ${payerProfile.email} (phone matched)`);
                            }
                        }
                    }
                }

                if (!saleReferral && ownerProfile?.email) {
                    const { data: existingPaidSeller } = await supabase
                        .from('sale_referrals')
                        .select('id')
                        .eq('client_email', ownerProfile.email)
                        .eq('status', 'paid')
                        .limit(1)
                        .maybeSingle();

                    if (!existingPaidSeller) {
                        const { data: foundSeller } = await supabase
                            .from('sale_referrals')
                            .select('id, referrer_id, commission_pct, status, referral_type, client_phone')
                            .eq('client_email', ownerProfile.email)
                            .eq('status', 'pending')
                            .limit(1)
                            .maybeSingle();

                        if (foundSeller && foundSeller.referral_type === 'seller') {
                            const { data: ownerWithPhone } = await supabase
                                .from('profiles')
                                .select('phone_number')
                                .eq('id', booking.owner_id)
                                .single();

                            const storedPhone = foundSeller.client_phone?.replace(/\D/g, '');
                            const actualPhone = ownerWithPhone?.phone_number?.replace(/\D/g, '');

                            if (storedPhone && actualPhone && storedPhone === actualPhone) {
                                saleReferral = foundSeller;
                                console.log(`Found valid seller referral for ${ownerProfile.email} (phone matched)`);
                            }
                        }
                    }
                }
            }

            let ownerPayoutAmount = Math.round(payment.amount_cents * 0.8); // 80% to owner
            referralPayoutAmount = 0;
            platformPayoutAmount = 0;

            if (isAgentSelfReferral) {
                // Booking-level agent referral: agent brought the renter.
                // referral_id = the renter (payer) whose transaction earned the commission
                // referrer_id = the agent who gets the commission
                referralPayoutAmount = Math.round(payment.amount_cents * 0.15);
                ownerPayoutAmount = Math.round(payment.amount_cents * 0.8);
                platformPayoutAmount = Math.round(payment.amount_cents * 0.05);

                const { data: createdRefPayment, error: refPayError } = await supabase
                    .from('referral_payments')
                    .insert({
                        id: crypto.randomUUID(),
                        referral_id: payment.payer_id, // The renter who paid
                        booking_id: payment.booking_id,
                        payer_id: payment.payer_id,
                        referrer_id: booking.agent_id, // The agent who gets commission
                        amount_cents: referralPayoutAmount,
                        amount_usd: referralPayoutAmount / 100,
                        currency: payment.currency || 'USD',
                        payout_status: 'pending',
                    })
                    .select()
                    .single();

                if (refPayError) {
                    console.error('Failed to create referral_payments entry:', refPayError);
                } else if (createdRefPayment?.id) {
                    referralPaymentId = createdRefPayment.id;
                }
                console.log(`Agent self-referral: owner 80% = ${ownerPayoutAmount}, agent 15% = ${referralPayoutAmount}, referral_payments_id=${referralPaymentId}`);
            } else if (saleReferral) {
                // Agent_referrals match or sale_referrals match: Referrer gets 15% commission.
                // referral_id = the client whose transaction earned the commission
                //   - For buyer/agent referrals: the renter (payer_id)
                //   - For seller referrals: the owner (booking.owner_id)
                // referrer_id = the referrer who gets the commission
                referralPayoutAmount = Math.round(payment.amount_cents * 0.15);
                ownerPayoutAmount = Math.round(payment.amount_cents * 0.8);
                platformPayoutAmount = Math.round(payment.amount_cents * 0.05);

                // Determine who the referred client is
                const referredClientId = (saleReferral.referral_type === 'seller')
                    ? booking.owner_id
                    : payment.payer_id;

                const { data: createdReferralPayment, error: referralError } = await supabase
                    .from('referral_payments')
                    .insert({
                        id: crypto.randomUUID(),
                        referral_id: referredClientId, // The client who transacted
                        booking_id: payment.booking_id,
                        payer_id: payment.payer_id,
                        referrer_id: saleReferral.referrer_id, // The referrer who gets commission
                        amount_cents: referralPayoutAmount,
                        amount_usd: referralPayoutAmount / 100,
                        currency: payment.currency || 'USD',
                        payout_status: 'pending',
                    })
                    .select()
                    .single();

                if (referralError) {
                    console.error('Failed to create referral payment:', referralError);
                } else if (createdReferralPayment?.id) {
                    referralPaymentId = createdReferralPayment.id;
                    console.log('Created referral payment:', referralPaymentId);
                }
            } else {
                // No referral, owner gets 90%
                ownerPayoutAmount = Math.round(payment.amount_cents * 0.9);
                platformPayoutAmount = Math.round(payment.amount_cents * 0.10);
            }

            try {

                // Transfer to owner (80% or 90% depending on referral)
                const transfer = await stripe.transfers.create({
                    amount: ownerPayoutAmount,
                    currency: 'aud',
                    destination: payeeStripeConnectId,
                    description: referralPaymentId
                        ? `80% Payout for Booking #${booking.id} (15% referral commission applied)`
                        : `90% Payout for Booking #${booking.id}`,
                });

                if (platformPayoutAmount > 0) {
                    const feePercentage = payment.amount_cents
                        ? Math.round((platformPayoutAmount / payment.amount_cents) * 100)
                        : 0;
                    const { error: platformInsertError } = await supabase.from('platform_earnings').insert({
                        id: crypto.randomUUID(),
                        user_id: booking.owner_id,
                        booking_id: payment.booking_id,
                        amount_cents: platformPayoutAmount,
                        amount_usd: platformPayoutAmount / 100,
                        currency: payment.currency || 'USD',
                        fee_percentage: feePercentage,
                        payout_status: 'paid',
                        payout_error: null,
                        created_date: new Date().toISOString(),
                    });
                    if (platformInsertError) {
                        console.error('Failed to insert platform earning record:', platformInsertError.message);
                    }
                }

                // Pay referrer/agent commission via Stripe
                let commissionTransferFailed = false;
                let commissionTransferId = null;

                if (referralPaymentId && isAgentSelfReferral && booking.agent_id) {
                    // Booking-level agent: pay the agent themselves
                    try {
                        const { data: agentInfo } = await supabase
                            .from('profiles')
                            .select('stripe_connect_id')
                            .eq('id', booking.agent_id)
                            .single();

                        if (agentInfo?.stripe_connect_id) {
                            const agentTransfer = await stripe.transfers.create({
                                amount: referralPayoutAmount,
                                currency: 'aud',
                                destination: agentInfo.stripe_connect_id,
                                description: `15% Agent Commission for Booking #${booking.id}`,
                            });
                            commissionTransferId = agentTransfer.id;
                            console.log(`Agent self-referral commission paid: 15% = ${referralPayoutAmount} to agent ${booking.agent_id}, transfer=${agentTransfer.id}`);
                        } else {
                            console.error(`Agent ${booking.agent_id} has no Stripe Connect ID — commission not paid`);
                            commissionTransferFailed = true;
                        }
                    } catch (agentPayoutErr: any) {
                        console.error(`Failed to pay agent commission for ${booking.agent_id}:`, agentPayoutErr?.message);
                        commissionTransferFailed = true;
                    }

                } else if (referralPaymentId && saleReferral) {
                    // Agent_referrals match or sale_referrals match: pay the referrer
                    try {
                        const { data: referrerProfile } = await supabase
                            .from('profiles')
                            .select('stripe_connect_id')
                            .eq('id', saleReferral.referrer_id)
                            .single();

                        if (referrerProfile?.stripe_connect_id) {
                            const refTransfer = await stripe.transfers.create({
                                amount: referralPayoutAmount,
                                currency: 'aud',
                                destination: referrerProfile.stripe_connect_id,
                                description: isAgentReferral
                                    ? `15% Agent Referral Commission for Booking #${booking.id}`
                                    : `15% ${saleReferral.referral_type === 'seller' ? 'Seller' : 'Buyer'} Referral Commission for Booking #${booking.id}`,
                            });
                            commissionTransferId = refTransfer.id;
                            console.log(`Referral commission paid: 15% = ${referralPayoutAmount} to referrer ${saleReferral.referrer_id}, transfer=${refTransfer.id}`);
                        } else {
                            console.error(`Referrer ${saleReferral.referrer_id} has no Stripe Connect ID — commission not paid`);
                            commissionTransferFailed = true;
                        }
                    } catch (refPayoutErr: any) {
                        console.error(`Failed to pay referrer commission ${saleReferral.referrer_id}:`, refPayoutErr?.message);
                        commissionTransferFailed = true;
                    }
                }

                // Update referral_payments status based on commission transfer result
                if (referralPaymentId) {
                    if (commissionTransferId) {
                        await supabase
                            .from('referral_payments')
                            .update({
                                payout_status: 'paid',
                                payout_transfer_id: commissionTransferId,
                                paid_date: new Date().toISOString(),
                            })
                            .eq('id', referralPaymentId);
                    } else if (commissionTransferFailed) {
                        await supabase
                            .from('referral_payments')
                            .update({
                                payout_status: 'failed',
                                payout_error: commissionTransferFailed ? 'Stripe transfer failed — referrer not paid' : 'Unknown error',
                            })
                            .eq('id', referralPaymentId);
                    }
                }

                // Mark agent_referrals or sale_referrals as paid
                if (saleReferral && commissionTransferId) {
                    if (isAgentReferral) {
                        await supabase
                            .from('agent_referrals')
                            .update({ status: 'paid', paid_date: new Date().toISOString() })
                            .eq('id', saleReferral.id);
                    } else {
                        await supabase
                            .from('sale_referrals')
                            .update({ status: 'paid', paid_date: new Date().toISOString() })
                            .eq('id', saleReferral.id);
                    }
                }

                // Update the main payment record
                const appliedCommissionPct = isAgentSelfReferral ? 15 : (saleReferral ? (saleReferral.commission_pct || 15) : 0);

                const { error: updateError } = await supabase
                    .from('payments')
                    .update({
                        payout_status: 'paid',
                        payout_transfer_id: transfer.id,
                        payout_error: commissionTransferFailed ? `Owner paid, commission failed: ${transfer.id}` : null,
                        commission_paid_percentage: appliedCommissionPct,
                    })
                    .eq('id', payment.id);

                if (updateError) {
                    console.error(
                        'Failed to update payment record:',
                        updateError
                    );
                }

                processed.push({
                    id: payment.id,
                    transferId: transfer.id,
                    amount: ownerPayoutAmount,
                });


            } catch (stripeErr: any) {
                console.error(
                    `[FAILED] Stripe Transfer failed for payment ${payment.id}`
                );
                console.error('Error message:', stripeErr?.message);
                console.error('Full error:', stripeErr);

                await supabase
                    .from('payments')
                    .update({
                        payout_status: 'failed',
                        payout_error:
                            stripeErr?.message || 'Stripe transfer failed',
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