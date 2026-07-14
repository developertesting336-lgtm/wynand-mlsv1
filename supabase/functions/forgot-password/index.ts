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
    const { email } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (userError || !user) {
      // Don't reveal if email exists or not (security best practice)
      return new Response(JSON.stringify({ success: true, message: "If an account exists, you will receive an OTP" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // Store OTP directly in profiles table
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        reset_otp: otp,
        reset_otp_expires_at: expiresAt,
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Failed to store OTP:", updateError);
      throw new Error("Failed to generate OTP");
    }

    // Send OTP via email
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb;">Password Reset Request</h2>
        <p>You requested to reset your password. Use the following OTP code:</p>
        <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1f2937;">${otp}</span>
        </div>
        <p style="color: #6b7280; font-size: 14px;">This code will expire in 10 minutes.</p>
        <p style="color: #6b7280; font-size: 14px;">If you didn't request this, please ignore this email.</p>
      </div>
    `;

    const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        to: email,
        subject: "Password Reset OTP - PV Verified Rentals",
        body: emailHtml,
        fromEmail: "noreply@pvverified.com",
        fromName: "PV Verified Rentals",
      }),
    });

    if (!emailRes.ok) {
      console.error("Failed to send email:", await emailRes.text());
      // Don't throw - OTP is still stored, user can try again
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "If an account exists, you will receive an OTP" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Forgot password error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Something went wrong" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});