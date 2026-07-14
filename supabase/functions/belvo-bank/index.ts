import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const { userId, rfc, ciec, userEmail, userName } = await req.json();



    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId is required" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (!rfc || !ciec) {
      return new Response(
        JSON.stringify({ error: "RFC and CIEC are required for financial statements" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Format RFC: remove any hyphens or spaces and convert to uppercase
    const formattedRfc = rfc.replace(/[-\s]/g, '').toUpperCase();
    console.log("00999999999999555555555555555555555555555000")
    console.log("formattedRfc:", formattedRfc, "length:", formattedRfc.length);

    // Validate RFC format (should be 12-13 characters for Mexico)
    if (formattedRfc.length < 12 || formattedRfc.length > 13) {
      console.log("Validation failed: RFC length is not 12 or 13. Length is:", formattedRfc.length);
      return new Response(
        JSON.stringify({ error: `RFC must be 12-13 characters long. Received: '${formattedRfc}' (length: ${formattedRfc.length})` }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    console.log("00000000000000000000000000000000000000011111111111111111111111111111111")

    const secretId = Deno.env.get("BELVO_SECRET_ID")!;
    const secretPassword = Deno.env.get("BELVO_SECRET_PASSWORD")!;
    let belvoApiUrl = Deno.env.get("BELVO_API_URL") || "https://sandbox.belvo.com";

    if (belvoApiUrl.includes("api.sandbox.belvo.com")) {
      belvoApiUrl = belvoApiUrl.replace("api.sandbox.belvo.com", "sandbox.belvo.com");
    }

    const isSandbox = belvoApiUrl.includes("sandbox.belvo.com");
    const institution = isSandbox ? "tatooine_mx_fiscal" : "sat_mx_fiscal";

    const auth = btoa(`${secretId}:${secretPassword}`);

    console.log("Creating Belvo link with RFC:", formattedRfc);
    console.log(`Using institution: ${institution} (${isSandbox ? "Sandbox" : "Production"})`);

    // NOTE: For sandbox testing with tatooine_mx_fiscal, use Belvo's test credentials:
    // RFC: PFIS010101000 (Individual) or PMO010101000 (Business)
    // CIEC: individual or business
    // 
    // For production with sat_mx_fiscal, use actual user credentials
    const linkPayload: any = {
      institution: institution,
      username: formattedRfc,
      password: ciec,
      fetch_resources: ["FINANCIAL_STATEMENTS"],
      external_id: userId,
      email: userEmail,
      name: userName,
    };

    console.log("Link payload:", JSON.stringify(linkPayload, null, 2));

    // Create Belvo Link for Financial Statements (Fiscal data)
    const linkRes = await fetch(
      `${belvoApiUrl}/api/links/`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(linkPayload),
      }
    );

    const linkText = await linkRes.text();
    console.log("Link creation response:", linkText);

    if (!linkRes.ok) {
      let errorMsg = linkText;
      try {
        const errorData = JSON.parse(linkText);
        const errorDetail = Array.isArray(errorData) ? errorData[0] : errorData;
        if (errorDetail?.code === 'invalid' && errorDetail?.field === 'username') {
          errorMsg = `Invalid credentials format. For sandbox testing, please use Belvo's mock credentials: PFIS010101000 (Individual) with 'individual' as CIEC, or PMO010101000 (Business) with 'business' as CIEC. For production, make sure to enter a valid Mexican RFC.`;
        } else if (errorDetail?.message) {
          errorMsg = errorDetail.message;
        }
      } catch (e) {
        console.error("Failed to parse error data:", e);
      }

      throw new Error(errorMsg);
    }

    const linkData = JSON.parse(linkText);
    const linkId = linkData.id;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch existing verification to preserve id_document_url due to NOT NULL constraint
    const { data: existingVerification } = await supabase
      .from("verifications")
      .select("id_document_url")
      .eq("user_id", userId)
      .maybeSingle();

    const idDocUrl = existingVerification?.id_document_url || "";

    // Save the link_id to the database
    await supabase.from("verifications").upsert(
      {
        user_id: userId,
        bank_statement_verification: "started",
        belvo_link_id: linkId,
        id_document_url: idDocUrl,
        updated_date: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      }
    );

    return new Response(
      JSON.stringify({
        success: true,
        link_id: linkId,
        message: "Financial statements link created successfully",
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (e) {
    console.error("BELVO-BANK-ERROR-CATCH:", e);

    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : String(e),
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
