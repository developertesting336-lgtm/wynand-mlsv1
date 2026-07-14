import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

export const getCorsHeaders = (originHeader: string | null) => ({
  "Access-Control-Allow-Origin": originHeader ?? "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
});

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    const now = new Date().toISOString();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoIso = thirtyDaysAgo.toISOString();

    console.log(`[Reminders] Checking for expired subscriptions at ${now}...`);

    // Fetch active subscriptions that have expired
    const { data: expiredSubs, error: subsError } = await supabase
      .from("subscriptions")
      .select("id, user_id, plan, status, current_period_end, last_payment_date")
      .eq("status", "active")
      .or(`current_period_end.lt.${now},and(current_period_end.is.null,last_payment_date.lt.${thirtyDaysAgoIso})`);

    if (subsError) {
      console.error("[Reminders] Error fetching subscriptions:", subsError);
      throw subsError;
    }

    const processed = [];
    const emailsSent = [];

    if (expiredSubs && expiredSubs.length > 0) {
      console.log(`[Reminders] Found ${expiredSubs.length} expired subscriptions.`);

      // 1. Mark subscriptions as inactive
      const expiredSubIds = expiredSubs.map((s) => s.id);
      const { error: updateError } = await supabase
        .from("subscriptions")
        .update({ status: "inactive" })
        .in("id", expiredSubIds);

      if (updateError) {
        console.error("[Reminders] Error updating subscription statuses:", updateError);
        throw updateError;
      }

      // 2. Fetch user profile emails
      const userIds = expiredSubs.map((s) => s.user_id).filter(Boolean);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);

      if (profilesError) {
        console.error("[Reminders] Error fetching user profiles:", profilesError);
      }

      const profileMap = Object.fromEntries(
        (profiles || []).map((p) => [p.id, p])
      );

      // 3. Send email notifications via Resend API
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      const smtpFrom = Deno.env.get("SMTP_FROM") || "noreply@pvverified.com";
      const smtpFromName = Deno.env.get("SMTP_FROM_NAME") || "PV Verified Rentals";
      const fromAddress = `${smtpFromName} <${smtpFrom}>`;

      for (const sub of expiredSubs) {
        const profile = profileMap[sub.user_id];
        const email = profile?.email;
        const name = profile?.full_name || "Premium Member";

        if (email) {
          processed.push({ id: sub.id, userId: sub.user_id, email });

          if (resendApiKey) {
            try {
              const emailHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
                  <h2 style="color: #ef4444; margin-top: 0;">Subscription Expired</h2>
                  <p>Dear ${name},</p>
                  <p>Your Premium Membership subscription has expired because the next billing cycle has started and we could not process your renewal payment.</p>
                  <p>To keep listing your properties, enjoying verified badges, and receiving priority renter leads, please renew your subscription:</p>
                  <div style="margin: 25px 0;">
                    <a href="${Deno.env.get("APP_URL") || "http://localhost:5173"}/pricing" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Renew Subscription</a>
                  </div>
                  <p style="color: #6b7280; font-size: 14px; margin-bottom: 0;">If you have any questions, please contact our support team.</p>
                </div>
              `;

              const res = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${resendApiKey}`,
                },
                body: JSON.stringify({
                  from: fromAddress,
                  to: [email],
                  subject: "Action Required: Your Premium Subscription Has Expired",
                  html: emailHtml,
                }),
              });

              if (res.ok) {
                emailsSent.push(email);
                console.log(`[Reminders] Expired notification email sent to ${email}`);
              } else {
                console.error(`[Reminders] Resend API failed for ${email}:`, await res.text());
              }
            } catch (emailErr) {
              console.error(`[Reminders] Failed to send email to ${email}:`, emailErr);
            }
          } else {
            console.warn("[Reminders] RESEND_API_KEY is not set. Skipping email send.");
          }
        }
      }
    } else {
      console.log("[Reminders] No expired subscriptions found.");
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked_at: now,
        processed_count: processed.length,
        processed,
        emails_sent: emailsSent,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("[Reminders] Fatal error in execution:", err);
    return new Response(
      JSON.stringify({
        error: err?.message || "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
