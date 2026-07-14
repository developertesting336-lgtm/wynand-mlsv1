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
    const { email, otp, newPassword } = await req.json();

    if (!email || !otp || !newPassword) {
      return new Response(JSON.stringify({ error: "Email, OTP, and new password are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (newPassword.length < 6) {
      return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find user with valid OTP in profiles table
    const { data: user, error: userError } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", email.toLowerCase().trim())
      .eq("reset_otp", otp.trim())
      .gt("reset_otp_expires_at", new Date().toISOString())
      .maybeSingle();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired OTP" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update password in Supabase Auth (not in profiles table)
    const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (authUpdateError) {
      console.error("Auth password update error:", authUpdateError);
      throw new Error("Failed to update password");
    }

    // Clear OTP from profiles table
    const { error: clearError } = await supabase
      .from("profiles")
      .update({
        reset_otp: null,
        reset_otp_expires_at: null,
      })
      .eq("id", user.id);

    if (clearError) {
      console.error("OTP clear error:", clearError);
      // Don't throw - password was updated successfully
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Password reset successfully" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Reset password error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Something went wrong" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});