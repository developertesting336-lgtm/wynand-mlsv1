import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

export const getCorsHeaders = (originHeader: string | null) => ({
  "Access-Control-Allow-Origin": originHeader ?? "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
});

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("[belvo-webhook] Received event:", JSON.stringify(body));

    const belvoSecretId = Deno.env.get("BELVO_SECRET_ID") || "";
    const belvoSecretPassword = Deno.env.get("BELVO_SECRET_PASSWORD") || "";
    let belvoApiUrl = Deno.env.get("BELVO_API_URL") || "https://sandbox.belvo.com";
    if (belvoApiUrl.includes("api.sandbox.belvo.com")) {
      belvoApiUrl = belvoApiUrl.replace("api.sandbox.belvo.com", "sandbox.belvo.com");
    }
    const authString = btoa(`${belvoSecretId}:${belvoSecretPassword}`);

    const { event, webhook_type, webhook_code, link_id, external_id, link } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // --- 1. EMPLOYMENT RECORDS WEBHOOK ---
    if (webhook_type === "EMPLOYMENT_RECORDS" && webhook_code === "historical_update") {
      const userId = external_id;
      if (!userId) {
        return new Response(JSON.stringify({ status: "ignored", reason: "missing external_id" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const employmentResponse = await fetch(`${belvoApiUrl}/api/employment-records/?link=${link_id}`, {
        headers: { "Authorization": `Basic ${authString}` },
      });
      if (!employmentResponse.ok) {
        throw new Error(`Failed to fetch employment records: ${await employmentResponse.text()}`);
      }

      const employmentData = await employmentResponse.json();
      const records = employmentData.results || [];

      let monthlyIncome = 0;
      let employerName = "";

      if (records.length > 0) {
        const record = records[0];
        const empHistory = record.employment_records || [];
        if (empHistory.length > 0) {
          const activeEmployer = empHistory.find((e: any) => !e.end_date || e.state === "ACTIVE") || empHistory[0];
          employerName = activeEmployer.employer || "";
          const dailySalary = activeEmployer.monthly_salary || activeEmployer.base_salary || 0;
          monthlyIncome = dailySalary * 30;
        }
      }

      await supabase
        .from("verifications")
        .update({
          employment_verification: "approved",
          updated_date: new Date().toISOString(),
          monthly_income: monthlyIncome,
          employer_name: employerName,
          belvo_link_id: link_id,
          belvo_institution_id: link?.institution?.id || "planet_mx_employment",
        })
        .eq("user_id", userId);

      console.log(`[belvo-webhook] Employment verification completed for user: ${userId}`);

      return new Response(JSON.stringify({ success: true, user_id: userId, employer_name: employerName, monthly_income: monthlyIncome }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- 2. ASYNC BANK DATA WEBHOOKS (ACCOUNTS PROCESSING) ---
    if (webhook_type === "ACCOUNTS" && webhook_code === "historical_update") {
      const userId = external_id;
      if (!userId) {
        return new Response(JSON.stringify({ status: "ignored", reason: "missing external_id" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const accountsResponse = await fetch(`${belvoApiUrl}/api/accounts/?link=${link_id}`, {
        headers: { "Authorization": `Basic ${authString}` },
      });
      if (!accountsResponse.ok) {
        throw new Error("Failed to fetch Belvo accounts inside async webhook handler");
      }

      const accountsData = await accountsResponse.json();
      const accounts = accountsData.results || [];

      let bankName = "Unknown Bank";
      let accountId = "";
      let balanceAmount = 0;
      let institutionId = null;

      if (accounts.length > 0) {
        const account = accounts[0];
        accountId = account.id;
        bankName = account.institution?.name || account.name || "Unknown Bank";
        balanceAmount = account.balance?.current || 0;
        institutionId = account.institution?.id || null;
      }

      await supabase
        .from("verifications")
        .update({
          belvo_link_id: link_id,
          belvo_account_id: accountId,
          belvo_institution_id: institutionId,
          bank_name: bankName,
          balance_amount: balanceAmount,
          bank_statement_verification: "approved",
          updated_date: new Date().toISOString(),
        })
        .eq("user_id", userId);

      console.log(`[belvo-webhook] Bank statement metrics successfully updated for user: ${userId}`);
      return new Response(JSON.stringify({ success: true, user_id: userId, bank_name: bankName }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- 3. FINANCIAL STATEMENTS WEBHOOK ---
    if (webhook_type === "FINANCIAL_STATEMENTS" && webhook_code === "historical_update") {
      const userId = external_id;
      if (!userId) {
        return new Response(JSON.stringify({ status: "ignored", reason: "missing external_id" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let totalIncome = null;
      let totalExpenses = null;
      let fiscalYear = null;
      let currency = null;
      let docType = null;

      try {
        const finResponse = await fetch(`${belvoApiUrl}/api/financial-statements/?link=${link_id}`, {
          headers: { "Authorization": `Basic ${authString}` },
        });
        if (finResponse.ok) {
          const finData = await finResponse.json();
          const results = finData.results || [];
          console.log(`[belvo-webhook] Found ${results.length} financial statements:`, JSON.stringify(results));

          if (results.length > 0) {
            // Sort by year (as parsed number) descending to get the most recent one
            const sortedResults = results.sort((a: any, b: any) => {
              const yearA = parseInt(a.year) || 0;
              const yearB = parseInt(b.year) || 0;
              return yearB - yearA;
            });
            const latestStatement = sortedResults[0];

            const parsedYear = parseInt(latestStatement.year);
            fiscalYear = isNaN(parsedYear) ? new Date().getFullYear() : parsedYear;
            docType = latestStatement.document_type || "annual_tax_return";
            currency = latestStatement.currency || null;

            const incStatement = latestStatement.income_statement || {};
            totalIncome = incStatement.net_income ||
              incStatement.net_revenue ||
              incStatement.revenues ||
              incStatement.total_income ||
              null;

            totalExpenses = incStatement.operating_expenses ||
              incStatement.cost_of_goods_sold ||
              incStatement.total_expenses ||
              null;

            console.log(`[belvo-webhook] Parsed values - fiscalYear: ${fiscalYear}, docType: ${docType}, currency: ${currency}, totalIncome: ${totalIncome}, totalExpenses: ${totalExpenses}`);
          }
        } else {
          console.error(`[belvo-webhook] Failed to fetch financial statements: ${await finResponse.text()}`);
        }
      } catch (e) {
        console.error("[belvo-webhook] Error fetching financial statements detail:", e);
      }

      console.log(`[belvo-webhook] Updating DB verifications for user: ${userId} with link: ${link_id}`);
      const { data: updateData, error: updateError } = await supabase
        .from("verifications")
        .update({
          belvo_link_id: link_id,
          bank_statement_verification: "approved",
          total_income: totalIncome,
          total_expenses: totalExpenses,
          fiscal_year: fiscalYear,
          financial_currency: currency,
          financial_document_type: docType,
          updated_date: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .select();

      console.log("[belvo-webhook] Database update result:", { updateData, updateError });

      console.log(`[belvo-webhook] Financial statements verification completed for user: ${userId}`);
      return new Response(JSON.stringify({
        success: true,
        user_id: userId,
        total_income: totalIncome,
        total_expenses: totalExpenses,
        fiscal_year: fiscalYear,
        updateData,
        updateError
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- 3. LINK HANDSHAKE FALLBACK (Saves metadata immediately on authentication) ---
    if (event === "link" && link) {
      const userId = link.external_id;
      if (link.status !== "valid" || !userId) {
        return new Response(JSON.stringify({ status: "skipped" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Record baseline parameters early so front-ends can track status changes
      await supabase
        .from("verifications")
        .update({
          belvo_link_id: link.id,
          belvo_institution_id: link.institution?.id || link.institution,
          updated_date: new Date().toISOString(),
        })
        .eq("user_id", userId);

      return new Response(JSON.stringify({ success: true, status: "link_registered" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ status: "ignored" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[belvo-webhook] Error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});



