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
    const body = await req.json();
    const { userId, userEmail, purpose } = body;
    
    if (!userId || !userEmail) {
      return new Response(JSON.stringify({ error: "userId and userEmail are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize purpose and enforce strict fallback values
    const cleanPurpose = typeof purpose === "string" ? purpose.trim().toLowerCase() : "";
    const isEmployment = cleanPurpose === "employment";
    const flowPurpose = isEmployment ? "employment" : "bank_statement";

    const belvoSecretId = Deno.env.get("BELVO_SECRET_ID") || "";
    const belvoSecretPassword = Deno.env.get("BELVO_SECRET_PASSWORD") || "";
    let belvoApiUrl = Deno.env.get("BELVO_API_URL") || "https://sandbox.belvo.com";

    if (belvoApiUrl.includes("api.sandbox.belvo.com")) {
      belvoApiUrl = belvoApiUrl.replace("api.sandbox.belvo.com", "sandbox.belvo.com");
    }

    if (!belvoSecretId || !belvoSecretPassword) {
      throw new Error("Belvo credentials not configured");
    }

    const authString = btoa(`${belvoSecretId}:${belvoSecretPassword}`);

    const institutionId = isEmployment 
      ? "planet_mx_employment" 
      : "erebor_mx_retail";

    // FIX 1: Enforce strict UPPERCASE strings as required by the API schema
    const resourcesPayload = isEmployment 
      ? ["EMPLOYMENT_RECORDS"] 
      : ["ACCOUNTS", "TRANSACTIONS"];

    // 1. Fetch widget access token with deep configuration parameters injected safely
    const tokenResponse = await fetch(`${belvoApiUrl}/api/token/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${authString}`,
      },
      body: JSON.stringify({
        id: belvoSecretId,
        password: belvoSecretPassword,
        scopes: "read_institutions,write_links,read_links",
        // FIX 2: Move 'fetch_resources' to the ROOT level of the request payload
        fetch_resources: resourcesPayload,
        widget: {
          branding: { company_name: "Rental Platform" },
          configuration: {
            country_codes: ["MX"],
            institutions: [institutionId],
            access_mode: "single"
          }
        },
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      throw new Error(`Failed to generate Belvo widget token: ${errText}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken: string = tokenData.access;

    // 2. DYNAMIC CONFIGURATION FOR DATABASE TRACKING
    const verificationColumn = isEmployment 
      ? "employment_verification" 
      : "bank_statement_verification";

    // 3. Update state in your Supabase 'verifications' table
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const upsertPayload: Record<string, any> = {
      user_id: userId,
      [verificationColumn]: "started",
      belvo_purpose: flowPurpose,
      updated_date: new Date().toISOString(),
    };

    await supabase
      .from("verifications")
      .upsert(upsertPayload, { onConflict: "user_id" });

    // 4. Build clean entry widget link with parameters baked directly into the signed token
    const connectUrl = `https://widget.belvo.io/?access_token=${accessToken}&external_id=${userId}`;

    return new Response(
      JSON.stringify({
        success: true,
        access: accessToken,
        connect_url: connectUrl,
        purpose: flowPurpose,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[belvo-create-connection] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});