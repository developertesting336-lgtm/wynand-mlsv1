import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import webpush from 'npm:web-push@3.6.7';

export const getCorsHeaders = (originHeader: string | null) => ({
  'Access-Control-Allow-Origin': originHeader ?? '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
});

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {


    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // VAPID keys setup
    const rawPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const rawPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    webpush.setVapidDetails(
      'mailto:support@pvverified.com',
      rawPublicKey,
      rawPrivateKey
    );

    // Get current time
    const now = new Date();

    // Fetch active subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select(`
        id,
        user_id,
        plan,
        status,
        last_payment_date,
        profiles (
          full_name,
          email
        )
      `)
      .eq('status', 'active');

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      throw subError;
    }


    const results = [];

    for (const sub of subscriptions || []) {

      if (!sub.last_payment_date) {
        console.log(`- Skipped: no last_payment_date found.`);
        continue;
      }

      const lastPaymentDate = new Date(sub.last_payment_date);
      const nextPaymentDate = new Date(lastPaymentDate);
      nextPaymentDate.setDate(nextPaymentDate.getDate() + 30); // 30 days subscription cycle

      // Calculate days difference (positive means remaining, negative means passed)
      const diffTime = nextPaymentDate.getTime() - now.getTime();
      const diffDaysFloat = diffTime / (1000 * 60 * 60 * 24);
      const diffDays = Math.round(diffDaysFloat); // round to nearest integer number of days


      if (diffDays <= -2 || diffDaysFloat <= -2) {

        const { error: updateErr } = await supabase
          .from('subscriptions')
          .update({ status: 'inactive' })
          .eq('id', sub.id);

        if (updateErr) {
          console.error(`  Failed to set subscription ${sub.id} to inactive:`, updateErr);
        } else {
          console.log(`  Successfully set subscription status to inactive.`);
        }

        results.push({
          userId: sub.user_id,
          subscriptionId: sub.id,
          status: 'updated',
          reason: 'Set to inactive because 2 days have passed since next payment date'
        });
        continue;
      }

      // We only notify if 3 days remaining (diffDays === 3) or 0 days remaining (diffDays === 0)
      const shouldNotify = (diffDays === 3) || (diffDays === 0);
      console.log(`- shouldNotify: ${shouldNotify} (diffDays is ${diffDays})`);

      if (!shouldNotify) {
        continue;
      }

      // Check if we've sent a subscription_expiry notification in the last 24 hours to this user
      const oneDayAgo = new Date();
      oneDayAgo.setDate(now.getDate() - 1);

      const { data: existingNotification, error: notifError } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', sub.user_id)
        .eq('type', 'subscription_expiry')
        .gte('created_at', oneDayAgo.toISOString())
        .limit(1)
        .maybeSingle();

      if (notifError) {
        console.error(`  Error checking existing notifications for user ${sub.user_id}:`, notifError);
        continue;
      }

      if (existingNotification) {
        console.log(`  Notification skipped: already sent one in the last 24 hours.`);
        results.push({
          userId: sub.user_id,
          subscriptionId: sub.id,
          status: 'skipped',
          reason: 'Notification already sent in the last 24 hours'
        });
        continue;
      }

      // Format date for notification message
      const renewalDateStr = nextPaymentDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      const notificationTitle = 'Subscription Renewal Reminder';
      const notificationMessage = diffDays === 0
        ? `Your ${sub.plan.toUpperCase()} plan subscription is due for payment today (${renewalDateStr})!`
        : `Your ${sub.plan.toUpperCase()} plan subscription is due for payment in 3 days (${renewalDateStr}).`;


      // 1. Insert notification in DB for navbar UI
      const { error: insertError } = await supabase
        .from('notifications')
        .insert({
          user_id: sub.user_id,
          title: notificationTitle,
          message: notificationMessage,
          type: 'subscription_expiry',
          is_read: false
        });

      if (insertError) {
        console.error(`Error inserting notification for user ${sub.user_id}:`, insertError);
        results.push({
          userId: sub.user_id,
          subscriptionId: sub.id,
          status: 'failed_db_insert',
          error: insertError.message
        });
        continue;
      }

      // 2. Fetch User's Push Subscriptions
      const { data: pushSubscriptions, error: pushFetchError } = await supabase
        .from('user_push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('user_id', sub.user_id);

      let pushStatusReport = 'no_push_subscriptions';

      if (!pushFetchError && pushSubscriptions && pushSubscriptions.length > 0) {
        pushStatusReport = 'delivered';
        for (const pSub of pushSubscriptions) {
          try {
            await webpush.sendNotification(
              {
                endpoint: pSub.endpoint,
                keys: {
                  p256dh: pSub.p256dh,
                  auth: pSub.auth
                }
              },
              JSON.stringify({
                title: notificationTitle,
                body: notificationMessage,
                url: '/dashboard'
              })
            );
          } catch (pushErr: any) {
            console.error(`Failed to send web push to endpoint ${pSub.endpoint}:`, pushErr);

            // Clean up invalid/expired push tokens (Status 410 or 404)
            if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
              await supabase
                .from('user_push_subscriptions')
                .delete()
                .eq('endpoint', pSub.endpoint);
            }
          }
        }
      }

      results.push({
        userId: sub.user_id,
        subscriptionId: sub.id,
        status: 'created',
        push: pushStatusReport
      });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Subscription reminder function failed:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
