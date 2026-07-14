import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const getCorsHeaders = (originHeader: string | null) => ({
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
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return new Response(JSON.stringify({ error: "Email and OTP are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find profile with matching OTP that hasn't expired
    const { data: profile, error: findError } = await supabase
      .from("profiles")
      .select("id, email, signup_otp, signup_otp_expires_at")
      .eq("email", email.toLowerCase().trim())
      .eq("signup_otp", otp.trim())
      .gt("signup_otp_expires_at", new Date().toISOString())
      .maybeSingle();

    if (findError || !profile) {
      console.error("[verify-signup-otp] Invalid or expired OTP for:", email, findError);
      return new Response(JSON.stringify({ error: "Invalid or expired OTP. Please try again." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clear OTP fields and mark email as verified
    const { error: clearError } = await supabase
      .from("profiles")
      .update({
        signup_otp: null,
        signup_otp_expires_at: null,
        email_verified: true,
      })
      .eq("id", profile.id);

    if (clearError) {
      console.error("[verify-signup-otp] Failed to clear OTP:", clearError);
      // Non-fatal – user is still verified
    }

    console.log(`[verify-signup-otp] Email verified for: ${email}`);

    return new Response(JSON.stringify({ success: true, message: "Email verified successfully" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[verify-signup-otp] Error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Something went wrong" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
