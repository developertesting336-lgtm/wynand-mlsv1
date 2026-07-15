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
    const authHeader = req.headers.get('Authorization');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    // Verify requesting caller has service role auth
    if (!authHeader || !authHeader.includes(serviceRoleKey)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // VAPID keys setup
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    webpush.setVapidDetails(
      'mailto:support@pvverified.com',
      vapidPublicKey,
      vapidPrivateKey
    );

    // Get current time and time 3 days from now
    const now = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(now.getDate() + 3);

    // Fetch active subscriptions expiring within the next 3 days
    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select(`
        id,
        user_id,
        current_period_end,
        plan,
        status,
        profiles (
          full_name,
          email
        )
      `)
      .eq('status', 'active')
      .gte('current_period_end', now.toISOString())
      .lte('current_period_end', threeDaysFromNow.toISOString());

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      throw subError;
    }

    const results = [];

    for (const sub of subscriptions || []) {
      const currentPeriodEnd = new Date(sub.current_period_end);
      const diffTime = currentPeriodEnd.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const daysRemaining = diffDays < 0 ? 0 : diffDays;

      // Check if we've sent a subscription_expiry notification in the last 7 days to this user
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);

      const { data: existingNotification, error: notifError } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', sub.user_id)
        .eq('type', 'subscription_expiry')
        .gte('created_at', sevenDaysAgo.toISOString())
        .limit(1)
        .maybeSingle();

      if (notifError) {
        console.error(`Error checking existing notifications for user ${sub.user_id}:`, notifError);
        continue;
      }

      if (existingNotification) {
        results.push({
          userId: sub.user_id,
          subscriptionId: sub.id,
          status: 'skipped',
          reason: 'Notification already sent in the last 7 days'
        });
        continue;
      }

      // Format date for notification message
      const renewalDateStr = currentPeriodEnd.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      const notificationTitle = 'Subscription Renewal Reminder';
      const notificationMessage = `Your ${sub.plan.toUpperCase()} plan subscription is set to renew on ${renewalDateStr}. Only ${daysRemaining} day(s) left!`;

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
