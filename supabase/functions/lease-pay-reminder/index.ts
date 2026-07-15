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
    const rawPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') || 'BCCW5bb7HgyST570k0LwvSLoUH6GkNMLYmGek5eXA+DZMn8J5Rt9EfdszmMqg60tpcYuP9jmXq3xDPAdAebb538';
    const rawPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || 'dZq613Sfk/8/JCzqIFWhDtW6mabuR11VtEoBRXiSYA';

    webpush.setVapidDetails(
      'mailto:support@pvverified.com',
      rawPublicKey,
      rawPrivateKey
    );

    const now = new Date();
    console.log("=== Lease Payment Reminder Cron Job Started ===");

    // Fetch bookings where status is 'lease_pending' and lease_status is not null
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        id,
        renter_id,
        status,
        lease_status,
        listing_id,
        updated_date,
        listings (
          title
        )
      `)
      .eq('status', 'lease_pending')
      .not('lease_status', 'is', null);

    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError);
      throw bookingsError;
    }

    console.log(`Fetched ${bookings?.length || 0} pending lease payments bookings.`);
    const results = [];

    for (const booking of bookings || []) {
      const propertyTitle = booking.listings?.title || 'Property';

      // 1. Check if 1.5 days (36 hours) have passed since the lease was approved/generated
      const updatedDate = booking.updated_date ? new Date(booking.updated_date) : new Date();
      const hoursSinceUpdate = (now.getTime() - updatedDate.getTime()) / (1000 * 60 * 60);

      const isGenerated = booking.lease_status === 'generated' || booking.lease_status === 'pending_renter';

      if (hoursSinceUpdate >= 36 && isGenerated) {
        console.log(`Booking ${booking.id} is overdue (${hoursSinceUpdate.toFixed(1)} hours). Automatically declining.`);
        const { error: declineError } = await supabase
          .from('bookings')
          .update({
            status: 'declined',
            lease_status: 'pending',
            updated_date: now.toISOString()
          })
          .eq('id', booking.id);

        if (declineError) {
          console.error(`Failed to decline booking ${booking.id}:`, declineError);
        } else {
          results.push({
            bookingId: booking.id,
            renterId: booking.renter_id,
            status: 'declined',
            reason: 'Booking declined automatically after 1.5 days without action'
          });
        }
        continue;
      }

      // 2. Fetch entire notification history for this booking to calculate interval
      const { data: sentNotifs, error: countError } = await supabase
        .from('notifications')
        .select('created_at')
        .eq('user_id', booking.renter_id)
        .eq('type', 'lease_pay_reminder')
        .like('message', `%${propertyTitle}%`)
        .order('created_at', { ascending: false });

      if (countError) {
        console.error(`Error fetching notification history for user ${booking.renter_id}:`, countError);
        continue;
      }

      const notifsCount = sentNotifs?.length || 0;
      let shouldNotify = false;

      if (notifsCount === 0) {
        // First reminder is immediate
        shouldNotify = true;
      } else if (notifsCount === 1) {
        // Second reminder is sent only if the first one was sent >= 24 hours ago
        const firstNotifTime = new Date(sentNotifs[0].created_at);
        const hoursSinceFirstNotif = (now.getTime() - firstNotifTime.getTime()) / (1000 * 60 * 60);
        if (hoursSinceFirstNotif >= 24) {
          shouldNotify = true;
        } else {
          results.push({
            bookingId: booking.id,
            renterId: booking.renter_id,
            status: 'skipped',
            reason: `First reminder sent ${hoursSinceFirstNotif.toFixed(1)} hours ago. Waiting for 24 hours.`
          });
        }
      } else {
        results.push({
          bookingId: booking.id,
          renterId: booking.renter_id,
          status: 'skipped',
          reason: 'Already sent 2 reminders. No more notifications.'
        });
      }

      if (!shouldNotify) {
        continue;
      }

      const notificationTitle = 'Action Required: Lease and Payment Ready';
      const notificationMessage = `"${propertyTitle}" booking has been approved. Please sign the lease agreement and make payment.`;

      // 1. Insert notification in DB
      const { error: insertError } = await supabase
        .from('notifications')
        .insert({
          user_id: booking.renter_id,
          title: notificationTitle,
          message: notificationMessage,
          type: 'lease_pay_reminder',
          is_read: false
        });

      if (insertError) {
        console.error(`Error inserting notification for user ${booking.renter_id}:`, insertError);
        results.push({
          bookingId: booking.id,
          renterId: booking.renter_id,
          status: 'failed_db_insert',
          error: insertError.message
        });
        continue;
      }

      // 2. Fetch User's Push Subscriptions
      const { data: pushSubscriptions, error: pushFetchError } = await supabase
        .from('user_push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('user_id', booking.renter_id);

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
        bookingId: booking.id,
        renterId: booking.renter_id,
        status: 'reminded',
        push: pushStatusReport
      });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Lease payment reminder function failed:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
