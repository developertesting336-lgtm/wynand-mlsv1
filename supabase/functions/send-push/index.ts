import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import webpush from 'npm:web-push@3.6.7';

const getCorsHeaders = (originHeader: string | null) => ({
  'Access-Control-Allow-Origin': originHeader ?? '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
});

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // ── Auth: require a valid JWT (anon or service) ────────────────────────
    const authHeader = req.headers.get('authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Supabase client (service-role, so we can read push subscriptions) ──
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ── VAPID setup ────────────────────────────────────────────────────────
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') || '';
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || '';
    webpush.setVapidDetails('mailto:support@pvverified.com', vapidPublicKey, vapidPrivateKey);

    // ── Request body ───────────────────────────────────────────────────────
    const { user_id, title, body, url, type } = await req.json() as {
      user_id: string;
      title: string;
      body: string;
      url?: string;
      type?: string;
    };

    if (!user_id || !title || !body) {
      return new Response(JSON.stringify({ error: 'user_id, title, and body are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Insert into notifications table (in-app bell + history) ───────────
    const { error: notifInsertErr } = await supabase
      .from('notifications')
      .insert({
        user_id,
        title,
        message: body,
        type: type || 'general',
        is_read: false,
      });

    if (notifInsertErr) {
      console.error('Error inserting notification:', notifInsertErr);
      // Non-fatal: log and continue so web-push still fires
    }

    // ── Fetch push subscriptions for this user ─────────────────────────────
    const { data: pushSubs, error: fetchErr } = await supabase
      .from('user_push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', user_id);

    if (fetchErr) {
      console.error('Error fetching push subscriptions:', fetchErr);
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!pushSubs || pushSubs.length === 0) {
      // Notification was already saved to the DB above; just skip web-push delivery
      return new Response(JSON.stringify({ success: true, sent: 0, reason: 'no_push_subscriptions' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Send to each subscription ──────────────────────────────────────────
    let sent = 0;
    for (const sub of pushSubs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title, body, url: url || '/' })
        );
        sent++;
      } catch (pushErr: any) {
        console.error(`Failed to push to ${sub.endpoint}:`, pushErr);
        // Clean up expired/invalid subscriptions
        if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
          await supabase
            .from('user_push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, sent }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('send-push function error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
