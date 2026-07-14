import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";




serve(async (req) => {
  // Only accept POST
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const secret = Deno.env.get("VERIFF_MASTER_SIGNATURE") ?? "";
  const rawBody = await req.text();          // keep the exact body for HMAC

  // Try both possible header names for the signature
  const receivedSig = req.headers.get("X-HMAC-SIGNATURE") ?? req.headers.get("veriff-signature") ?? "";

  console.log("[callback] Received signature header:", req.headers.get("X-HMAC-SIGNATURE"));
  console.log("[callback] Received veriff-signature header:", req.headers.get("veriff-signature"));
  console.log("[callback] Using secret (first 8 chars):", secret.substring(0, 8) + "...");
  console.log("[callback] Raw body length:", rawBody.length);

  // ---- 2️⃣ Verify signature ----------
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const computedSig = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  console.log("[callback] Computed signature:", computedSig);
  console.log("[callback] Received signature:", receivedSig);

  if (computedSig !== receivedSig) {
    console.error("Invalid Veriff signature", { computedSig, receivedSig, bodyPreview: rawBody.substring(0, 200) });
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ---- 3️⃣ Parse payload & detect webhook type ----------
  const payload = JSON.parse(rawBody);
  console.log("[callback] Parsed payload type:", payload.verification ? "decision" : "event");
  console.log("[callback] Payload keys:", Object.keys(payload).join(", "));

  let sessionId: string;
  let newStatus: string;

  if (payload.verification) {
    // ── Decision Webhook ──
    // Structure: { verification: { id, status, decision, ... } }
    const verification = payload.verification;
    if (!verification.id) {
      console.error("Decision webhook missing verification.id", payload);
      return new Response(JSON.stringify({ error: "Malformed decision payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    sessionId = verification.id;
    // Use `decision` if available (approved/declined/resubmission_requested),
    // otherwise fall back to `status`
    newStatus = verification.decision ?? verification.status ?? "unknown";
    console.log(`[callback] Decision webhook: session=${sessionId}, decision=${newStatus}`);
  } else if (payload.id && payload.action) {
    // ── Event Webhook ──
    // Structure: { id, attemptId, feature, code, action, vendorData, endUserId }
    sessionId = payload.id;
    newStatus = payload.action; // e.g. "started", "submitted"
    console.log(`[callback] Event webhook: session=${sessionId}, action=${newStatus}, code=${payload.code}`);
  } else {
    console.error("Unrecognised payload structure", payload);
    return new Response(JSON.stringify({ error: "Unrecognised payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ---- 4️⃣ Update DB ----------
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: existingVerification, error: selectError } = await supabase
    .from("verifications")
    .select("user_id")
    .eq("veriff_session_id", sessionId)
    .maybeSingle();

  if (selectError) {
    console.error("Supabase select error:", selectError);
    return new Response(JSON.stringify({ error: selectError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // const updatePayload: Record<string, unknown> = {
  //   id_verification: newStatus,
  //   // verification_status: newStatus,
  //   updated_date: new Date().toISOString(),
  // };

  // if (newStatus === 'approved') {
  //   updatePayload.status = 'approved';
  // }

  // const { error } = await supabase
  //   .from("verifications")
  //   .update(updatePayload)
  //   .eq("veriff_session_id", sessionId);

  const updatePayload = {
    id_verification: newStatus,
    updated_date: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("verifications")
    .update(updatePayload)
    .eq("veriff_session_id", sessionId);

  if (error) {
    console.error("Failed to update verification:", error);
  }

  if (error) {
    console.error("Supabase update error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (newStatus === 'approved' && existingVerification?.user_id) {
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ id_verified: true })
      .eq('id', existingVerification.user_id);
    if (profileError) {
      console.error('Failed to update profile id_verified:', profileError);
    }
  }

  console.log(`[callback] Updated verifications: session=${sessionId}, status=${newStatus}`);

  // ---- 5️⃣ Respond ----------
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});


