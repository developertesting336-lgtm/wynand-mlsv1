import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.1/mod.ts";

export const getCorsHeaders = (originHeader: string | null) => ({
    "Access-Control-Allow-Origin": originHeader ?? "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
});

async function getDocusignToken(
    integrationKey: string,
    userId: string,
    privateKeyPem: string,
    isDemo: boolean
): Promise<string> {
    const aud = isDemo ? "account-d.docusign.com" : "account.docusign.com";

    // Clean up PEM key format
    const cleanKey = privateKeyPem
        .replace(/\\n/g, "\n")
        .replace(/\r/g, "")
        .trim();

    // Import PEM to CryptoKey object
    const pemHeader = "-----BEGIN RSA PRIVATE KEY-----";
    const pemFooter = "-----END RSA PRIVATE KEY-----";
    const pemContents = cleanKey.substring(
        cleanKey.indexOf(pemHeader) + pemHeader.length,
        cleanKey.indexOf(pemFooter)
    ).replace(/\s/g, "");

    // DocuSign generates PKCS#1 keys (-----BEGIN RSA PRIVATE KEY-----)
    // WebCrypto's crypto.subtle.importKey expects PKCS#8 format (-----BEGIN PRIVATE KEY-----)
    // We dynamically wrap the PKCS#1 DER bytes into a valid PKCS#8 DER structure
    const binaryDerString = atob(pemContents);
    const pkcs1Der = new Uint8Array(binaryDerString.length);
    for (let i = 0; i < binaryDerString.length; i++) {
        pkcs1Der[i] = binaryDerString.charCodeAt(i);
    }

    // PKCS#8 OID sequence headers for RSA (1.2.840.113549.1.1.1)
    const pkcs8Header = new Uint8Array([
        0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00
    ]);

    // Build standard PKCS#8 wrapper around our PKCS#1 RSA key
    const pkcs1Length = pkcs1Der.length;

    // Construct length octets
    const encodeLength = (len: number) => {
        if (len < 128) {
            return new Uint8Array([len]);
        } else if (len < 256) {
            return new Uint8Array([0x81, len]);
        } else if (len < 65536) {
            return new Uint8Array([0x82, (len >> 8) & 0xff, len & 0xff]);
        } else {
            return new Uint8Array([0x83, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff]);
        }
    };

    const octetStringLengthBytes = encodeLength(pkcs1Length);
    const innerSeqLength = 1 + 1 + 1 + pkcs8Header.length + 1 + octetStringLengthBytes.length + pkcs1Length; // version tag/val + header + octet tag + octet len + pkcs1 bytes
    const outerSeqLengthBytes = encodeLength(innerSeqLength);

    const pkcs8Der = new Uint8Array(1 + outerSeqLengthBytes.length + innerSeqLength);
    let offset = 0;

    // Outer Sequence tag
    pkcs8Der[offset++] = 0x30;
    pkcs8Der.set(outerSeqLengthBytes, offset);
    offset += outerSeqLengthBytes.length;

    // Version (0x02, 0x01, 0x00)
    pkcs8Der[offset++] = 0x02;
    pkcs8Der[offset++] = 0x01;
    pkcs8Der[offset++] = 0x00;

    // Algorithm Identifier Sequence
    pkcs8Der.set(pkcs8Header, offset);
    offset += pkcs8Header.length;

    // Octet String tag
    pkcs8Der[offset++] = 0x04;
    pkcs8Der.set(octetStringLengthBytes, offset);
    offset += octetStringLengthBytes.length;

    // PKCS#1 key bytes
    pkcs8Der.set(pkcs1Der, offset);

    const cryptoKey = await crypto.subtle.importKey(
        "pkcs8",
        pkcs8Der,
        {
            name: "RSASSA-PKCS1-v1_5",
            hash: "SHA-256",
        },
        true,
        ["sign"]
    );

    const payload = {
        iss: integrationKey,
        sub: userId,
        iat: getNumericDate(0),
        exp: getNumericDate(3600),
        aud: aud,
        scope: "signature impersonation"
    };

    const jwt = await create({ alg: "RS256", typ: "JWT" }, payload, cryptoKey);

    const oauthHost = isDemo ? "https://account-d.docusign.com" : "https://account.docusign.com";
    const tokenResponse = await fetch(`${oauthHost}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: jwt
        })
    });

    if (!tokenResponse.ok) {
        const errText = await tokenResponse.text();
        throw new Error(`DocuSign JWT Exchange failed: ${errText}`);
    }

    const data = await tokenResponse.json();
    return data.access_token;
}

serve(async (req) => {
    const corsHeaders = getCorsHeaders(req.headers.get("origin"));

    if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Support public callback redirects from DocuSign to avoid browser local network PNA block errors
    if (req.method === "GET") {
        const url = new URL(req.url);
        const action = url.searchParams.get("action");
        if (action === "callback") {
            const responseHeaders = new Headers({
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
                "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
                "Content-Type": "text/html; charset=utf-8"
            });
            return new Response(`<!DOCTYPE html>
<html>
<head>
    <title>Signing Complete</title>
</head>
<body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f8fafc;">
    <div style="text-align: center; padding: 2rem; border-radius: 1rem; background: white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
        <h2 style="color: #0f172a; margin-bottom: 0.5rem;">Signature Submitted</h2>
        <p style="color: #64748b; font-size: 0.875rem;">Completing session. Please wait...</p>
    </div>
    <script>
        try {
            window.parent.postMessage('docusign_complete', '*');
        } catch (e) {
            console.error('Failed to notify parent window:', e);
        }
    </script>
</body>
</html>`, {
                status: 200,
                headers: responseHeaders
            });
        }
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
        const supabaseAnonKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
        const supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey);

        const docusignUserId = Deno.env.get("DOCUSIGN_USER_ID");
        const docusignIntegrationKey = Deno.env.get("DOCUSIGN_INTEGRATION_KEY");
        const docusignApiAccountId = Deno.env.get("DOCUSIGN_API_ACCOUNT_ID");
        const docusignPrivateKey = Deno.env.get("DOCUSIGN_RSA_PRIVATE_KEY");
        const accountBaseUri = Deno.env.get("ACCOUNT_BASE_URI") || "https://demo.docusign.net";

        let reqBody = {};
        if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
            try {
                reqBody = await req.json();
            } catch (jsonErr) {
                console.warn("Failed to parse request JSON body:", jsonErr);
            }
        }
        const { action, bookingId, envelopeId } = reqBody;

        // ─── ACTION: SEND ENVELOPE ──────────────────────────────────────────
        if (action === "send-envelope") {
            if (!bookingId) {
                return new Response(JSON.stringify({ error: "bookingId is required" }), {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // Fetch the booking & listing
            const { data: booking, error: bookingError } = await supabaseAdmin
                .from("bookings")
                .select("*, listings(*)")
                .eq("id", bookingId)
                .single();

            if (bookingError || !booking) {
                return new Response(JSON.stringify({ error: "Booking not found" }), {
                    status: 404,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            const { data: tenant } = await supabaseAdmin
                .from("profiles")
                .select("*")
                .eq("id", booking.renter_id)
                .single();

            const { data: owner } = await supabaseAdmin
                .from("profiles")
                .select("*")
                .eq("id", booking.owner_id)
                .single();

            let agent = null;
            if (booking.agent_id) {
                const { data: ap } = await supabaseAdmin
                    .from("profiles")
                    .select("*")
                    .eq("id", booking.agent_id)
                    .maybeSingle();
                agent = ap;
            }

            if (!booking.lease_pdf_url) {
                return new Response(JSON.stringify({ error: "Lease PDF has not been generated yet. Please generate the PDF first." }), {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // Download the lease PDF from storage
            const pdfRes = await fetch(booking.lease_pdf_url);
            if (!pdfRes.ok) {
                throw new Error("Failed to download lease PDF from storage");
            }
            const pdfBuffer = await pdfRes.arrayBuffer();
            const pdfBytes = new Uint8Array(pdfBuffer);

            // Loop in chunks to prevent stack size overflow with String.fromCharCode(...pdfBytes)
            let pdfBinaryString = "";
            const chunkSize = 8192;
            for (let i = 0; i < pdfBytes.length; i += chunkSize) {
                pdfBinaryString += String.fromCharCode.apply(
                    null,
                    pdfBytes.subarray(i, i + chunkSize)
                );
            }
            const pdfBase64 = btoa(pdfBinaryString);

            const isDemo = accountBaseUri.includes("demo");
            if (!docusignPrivateKey) {
                throw new Error("DOCUSIGN_RSA_PRIVATE_KEY environment variable is not defined.");
            }

            const access_token = await getDocusignToken(
                docusignIntegrationKey || "",
                docusignUserId || "",
                docusignPrivateKey,
                isDemo
            );

            // Setup the envelope configuration structure
            const envelopeDefinition = {
                emailSubject: `Lease Agreement Signature Request - ${booking.listings?.title || "Property"}`,
                documents: [
                    {
                        documentBase64: pdfBase64,
                        name: "Lease Agreement.pdf",
                        fileExtension: "pdf",
                        documentId: "1"
                    }
                ],
                recipients: {
                    signers: [
                        {
                            email: tenant?.email || booking.renter_email,
                            name: tenant?.full_name || "Tenant",
                            recipientId: "1",
                            routingOrder: "1",
                            clientUserId: booking.renter_id, // Setting clientUserId enables embedded signing
                            tabs: {
                                signHereTabs: [
                                    {
                                        anchorString: "/TenantSign/",
                                        anchorUnits: "pixels",
                                        anchorXOffset: "10",
                                        anchorYOffset: "0"
                                    }
                                ]
                            }
                        },
                        {
                            email: owner?.email || booking.owner_email,
                            name: owner?.full_name || "Owner",
                            recipientId: "2",
                            routingOrder: "2",
                            clientUserId: booking.owner_id, // Setting clientUserId enables embedded signing
                            tabs: {
                                signHereTabs: [
                                    {
                                        anchorString: "/LandlordSign/",
                                        anchorUnits: "pixels",
                                        anchorXOffset: "10",
                                        anchorYOffset: "0"
                                    }
                                ]
                            }
                        },
                        ...(agent ? [{
                            email: agent.email,
                            name: agent.full_name || "Agent",
                            recipientId: "3",
                            routingOrder: "3",
                            clientUserId: booking.agent_id, // Setting clientUserId enables embedded signing
                            tabs: {
                                signHereTabs: [
                                    {
                                        anchorString: "/AgentSign/",
                                        anchorUnits: "pixels",
                                        anchorXOffset: "10",
                                        anchorYOffset: "0"
                                    }
                                ]
                            }
                        }] : [])
                    ]
                },
                status: "sent"
            };

            // Call DocuSign Envelope endpoint to dispatch emails
            const envResponse = await fetch(`${accountBaseUri}/restapi/v2.1/accounts/${docusignApiAccountId}/envelopes`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${access_token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(envelopeDefinition)
            });

            if (!envResponse.ok) {
                const envErr = await envResponse.text();
                throw new Error(`DocuSign Envelope Creation failed: ${envErr}`);
            }

            const { envelopeId: createdEnvelopeId } = await envResponse.json();

            // Update local booking status with envelope ID
            await supabaseAdmin
                .from("bookings")
                .update({
                    docusign_envelope_id: createdEnvelopeId,
                    lease_status: "sent_via_docusign"
                })
                .eq("id", bookingId);

            return new Response(JSON.stringify({
                success: true,
                envelopeId: createdEnvelopeId,
                status: "sent_via_docusign"
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // ─── ACTION: GET RECIPIENT VIEW (EMBEDDED SIGNING LINK) ────────────
        if (action === "get-recipient-view") {
            const { recipientEmail, recipientName, recipientId, returnUrl } = reqBody;

            if (!bookingId || !recipientEmail || !recipientName || !recipientId || !returnUrl) {
                return new Response(JSON.stringify({ error: "Missing required parameters (bookingId, recipientEmail, recipientName, recipientId, returnUrl)" }), {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            const { data: booking, error: bookingError } = await supabaseAdmin
                .from("bookings")
                .select("*")
                .eq("id", bookingId)
                .single();

            if (bookingError || !booking || !booking.docusign_envelope_id) {
                return new Response(JSON.stringify({ error: "Booking or Envelope not found" }), {
                    status: 404,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            const isDemo = accountBaseUri.includes("demo");
            if (!docusignPrivateKey) {
                throw new Error("DOCUSIGN_RSA_PRIVATE_KEY is not defined.");
            }
            const access_token = await getDocusignToken(
                docusignIntegrationKey || "",
                docusignUserId || "",
                docusignPrivateKey,
                isDemo
            );

            // Verify sequence order first by inspecting the current status of all envelope recipients
            const recipientsUri = `${accountBaseUri}/restapi/v2.1/accounts/${docusignApiAccountId}/envelopes/${booking.docusign_envelope_id}/recipients`;
            const recsRes = await fetch(recipientsUri, {
                method: "GET",
                headers: { "Authorization": `Bearer ${access_token}` }
            });
            if (recsRes.ok) {
                const recsData = await recsRes.json();
                const signers = recsData.signers || [];
                const currentRecipient = signers.find((s: any) => s.clientUserId === recipientId);
                if (currentRecipient) {
                    const currentOrder = parseInt(currentRecipient.routingOrder || "1", 10);
                    // Check if there is any signer with a smaller routingOrder who has not completed signing yet
                    const pendingPriorSigner = signers.some((s: any) => {
                        const order = parseInt(s.routingOrder || "1", 10);
                        return order < currentOrder && s.status !== "completed";
                    });
                    if (pendingPriorSigner) {
                        return new Response(JSON.stringify({
                            error: "RECIPIENT_NOT_IN_SEQUENCE",
                            message: "It is not your turn to sign this lease yet. Please wait for previous signers to complete."
                        }), {
                            status: 400,
                            headers: { ...corsHeaders, "Content-Type": "application/json" },
                        });
                    }
                }
            }

            // DocuSign Recipient View endpoint configuration
            const viewRequest = {
                returnUrl,
                authenticationMethod: "none",
                email: recipientEmail,
                userName: recipientName,
                clientUserId: recipientId // must match the clientUserId defined in the envelope configuration
            };

            const viewResponse = await fetch(`${accountBaseUri}/restapi/v2.1/accounts/${docusignApiAccountId}/envelopes/${booking.docusign_envelope_id}/views/recipient`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${access_token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(viewRequest)
            });

            if (!viewResponse.ok) {
                const viewErr = await viewResponse.text();
                throw new Error(`DocuSign Recipient View failed: ${viewErr}`);
            }

            const { url: signingUrl } = await viewResponse.json();

            return new Response(JSON.stringify({ success: true, url: signingUrl }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // ─── ACTION: VERIFY SIGNER STATUS (ON CALLBACK VERIFICATION) ─────────
        if (action === "verify-signer-status") {
            if (!bookingId) {
                return new Response(JSON.stringify({ error: "bookingId is required" }), {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            console.log("verify-signer-status action started for bookingId:", bookingId);
            const { data: booking, error: bookingError } = await supabaseAdmin
                .from("bookings")
                .select("*")
                .eq("id", bookingId)
                .single();

            if (bookingError || !booking || !booking.docusign_envelope_id) {
                console.error("verify-signer-status: Booking or envelope ID not found", bookingError);
                return new Response(JSON.stringify({ error: "Booking or Envelope not found" }), {
                    status: 404,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }
            console.log("Found booking:", booking.id, "Envelope ID:", booking.docusign_envelope_id);

            const isDemo = accountBaseUri.includes("demo");
            if (!docusignPrivateKey) {
                throw new Error("DOCUSIGN_RSA_PRIVATE_KEY is not defined.");
            }
            const access_token = await getDocusignToken(
                docusignIntegrationKey || "",
                docusignUserId || "",
                docusignPrivateKey,
                isDemo
            );

            // Fetch envelope recipient statuses from DocuSign
            const recipientsRes = await fetch(`${accountBaseUri}/restapi/v2.1/accounts/${docusignApiAccountId}/envelopes/${booking.docusign_envelope_id}/recipients`, {
                method: "GET",
                headers: { "Authorization": `Bearer ${access_token}` }
            });

            if (!recipientsRes.ok) {
                const errMsg = await recipientsRes.text();
                console.error("Failed to fetch recipients from DocuSign:", errMsg);
                throw new Error(`Failed to fetch recipients status: ${errMsg}`);
            }

            const recipientsData = await recipientsRes.json();
            const signers = recipientsData.signers || [];
            console.log("DocuSign signers list fetched successfully:", JSON.stringify(signers));

            const tenantSigner = signers.find((s: any) => s.recipientId === "1");
            const ownerSigner = signers.find((s: any) => s.recipientId === "2");
            const agentSigner = signers.find((s: any) => s.recipientId === "3");

            const isTenantSigned = tenantSigner?.status === "completed";
            const isOwnerSigned = ownerSigner?.status === "completed";
            const isAgentSigned = agentSigner ? (agentSigner.status === "completed") : true;
            console.log("Signer statuses: TenantSigned =", isTenantSigned, "| OwnerSigned =", isOwnerSigned, "| AgentSigned =", isAgentSigned);

            const agreementConditions = booking.agreement_conditions || {};
            if (isTenantSigned && !agreementConditions.tenantSignature) {
                console.log("Marking Tenant as signed via DocuSign");
                agreementConditions.tenantSignature = "Signed via DocuSign";
                agreementConditions.tenantSignatureDate = tenantSigner.deliveredDateTime || new Date().toISOString();
            }
            if (isOwnerSigned && !agreementConditions.landlordSignature) {
                console.log("Marking Owner as signed via DocuSign");
                agreementConditions.landlordSignature = "Signed via DocuSign";
                agreementConditions.landlordSignatureDate = ownerSigner.deliveredDateTime || new Date().toISOString();
            }
            if (agentSigner && isAgentSigned && !agreementConditions.agentSignature) {
                console.log("Marking Agent as signed via DocuSign");
                agreementConditions.agentSignature = "Signed via DocuSign";
                agreementConditions.agentSignatureDate = agentSigner.deliveredDateTime || new Date().toISOString();
            }

            const isAllSigned = isTenantSigned && isOwnerSigned && isAgentSigned;
            console.log("Is envelope fully signed by all parties? =", isAllSigned);

            // Trigger sequence notifications:
            // 1. Tenant signed -> Notify Owner
            if (isTenantSigned && !isOwnerSigned) {
                console.log("Notifying Owner about Tenant signature...");
                try {
                    const notifyFunc = await fetch(`${supabaseUrl}/functions/v1/push-notification`, {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${supabaseAnonKey}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            userId: booking.owner_id,
                            title: "Lease Signed by Tenant",
                            body: "The tenant has signed the lease agreement. It is now your turn to review and sign.",
                            url: "/owner-dashboard",
                            type: "lease_pending"
                        })
                    });
                    console.log("Push notification response to Owner:", await notifyFunc.text());
                } catch (pushErr) {
                    console.warn("Failed to send Owner turn push notification:", pushErr);
                }
            }

            // 2. Owner signed (and Agent exists but hasn't signed) -> Notify Agent
            if (isTenantSigned && isOwnerSigned && agentSigner && !isAgentSigned) {
                console.log("Notifying Agent about Owner signature...");
                try {
                    const notifyFunc = await fetch(`${supabaseUrl}/functions/v1/push-notification`, {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${supabaseAnonKey}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            userId: booking.agent_id,
                            title: "Lease Ready for Agent Signature",
                            body: "Both Tenant and Owner have signed the lease. Please sign the agreement to finalize.",
                            url: "/agent-dashboard",
                            type: "lease_pending"
                        })
                    });
                    console.log("Push notification response to Agent:", await notifyFunc.text());
                } catch (pushErr) {
                    console.warn("Failed to send Agent turn push notification:", pushErr);
                }
            }

            let publicUrl = booking.lease_pdf_url;
            console.log("Downloading updated combined PDF from DocuSign...");
            const docResponse = await fetch(`${accountBaseUri}/restapi/v2.1/accounts/${docusignApiAccountId}/envelopes/${booking.docusign_envelope_id}/documents/combined`, {
                method: "GET",
                headers: { "Authorization": `Bearer ${access_token}` }
            });

            if (docResponse.ok) {
                const signedPdfBuffer = await docResponse.arrayBuffer();
                const signedPdfBytes = new Uint8Array(signedPdfBuffer);

                const fileName = `leases/${booking.id}-lease-signed-${Date.now()}.pdf`;
                console.log("Uploading signed PDF to storage as:", fileName);
                const { error: uploadError } = await supabaseAdmin
                    .storage
                    .from("MLS")
                    .upload(fileName, signedPdfBytes, {
                        contentType: "application/pdf",
                        upsert: true
                    });

                if (!uploadError) {
                    const { data: storageUrlData } = await supabaseAdmin
                        .storage
                        .from("MLS")
                        .getPublicUrl(fileName);
                    publicUrl = storageUrlData.publicUrl;
                    console.log("Uploaded successfully. Public URL:", publicUrl);
                } else {
                    console.error("Storage upload failed:", uploadError);
                }
            } else {
                console.error("DocuSign document fetch failed:", await docResponse.text());
            }

            const updateFields: any = {
                agreement_conditions: agreementConditions,
                lease_pdf_url: publicUrl,
                updated_date: new Date().toISOString()
            };

            if (isAllSigned) {
                updateFields.lease_status = "signed";
                updateFields.status = "approved";
            }

            console.log("Updating booking database fields:", JSON.stringify(updateFields));
            const { data: updatedBooking, error: uErr } = await supabaseAdmin
                .from("bookings")
                .update(updateFields)
                .eq("id", booking.id)
                .select("*")
                .single();

            if (uErr) {
                console.error("verify-signer-status: Database update failed:", uErr);
                throw new Error(`Database update failed: ${uErr.message}`);
            }
            console.log("Database update succeeded!");

            return new Response(JSON.stringify({ success: true, booking: updatedBooking }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // ─── ACTION: WEBHOOK (DOCUSIGN CONNECT RECEIVER) ────────────────────
        if (action === "webhook") {
            if (!envelopeId) {
                return new Response(JSON.stringify({ error: "envelopeId is required" }), {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // In actual webhook workflows, DocuSign sends a payload containing the envelope state.
            // Retrieve booking matching this envelope
            const { data: booking, error: bErr } = await supabaseAdmin
                .from("bookings")
                .select("*")
                .eq("docusign_envelope_id", envelopeId)
                .maybeSingle();

            if (bErr || !booking) {
                return new Response(JSON.stringify({ success: true, message: "Ignored (no matching booking)" }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            const isDemo = accountBaseUri.includes("demo");
            if (!docusignPrivateKey) {
                throw new Error("DOCUSIGN_RSA_PRIVATE_KEY is not defined.");
            }
            const access_token = await getDocusignToken(
                docusignIntegrationKey || "",
                docusignUserId || "",
                docusignPrivateKey,
                isDemo
            );

            // Fetch all signers from the DocuSign envelope to evaluate individual progress status
            const recipientsRes = await fetch(`${accountBaseUri}/restapi/v2.1/accounts/${docusignApiAccountId}/envelopes/${envelopeId}/recipients`, {
                method: "GET",
                headers: { "Authorization": `Bearer ${access_token}` }
            });
            if (!recipientsRes.ok) {
                throw new Error(`Failed to fetch envelope recipients: ${await recipientsRes.text()}`);
            }
            const recipientsData = await recipientsRes.json();
            const signers = recipientsData.signers || [];

            const tenantSigner = signers.find((s: any) => s.recipientId === "1");
            const ownerSigner = signers.find((s: any) => s.recipientId === "2");
            const agentSigner = signers.find((s: any) => s.recipientId === "3");

            const isTenantSigned = tenantSigner?.status === "completed";
            const isOwnerSigned = ownerSigner?.status === "completed";
            const isAgentSigned = agentSigner ? (agentSigner.status === "completed") : true;

            // Prepare signature updates matching the prior native app structure
            const agreementConditions = booking.agreement_conditions || {};
            if (isTenantSigned && !agreementConditions.tenantSignature) {
                agreementConditions.tenantSignature = "Signed via DocuSign";
                agreementConditions.tenantSignatureDate = tenantSigner.deliveredDateTime || new Date().toISOString();
            }
            if (isOwnerSigned && !agreementConditions.landlordSignature) {
                agreementConditions.landlordSignature = "Signed via DocuSign";
                agreementConditions.landlordSignatureDate = ownerSigner.deliveredDateTime || new Date().toISOString();
            }
            if (agentSigner && isAgentSigned && !agreementConditions.agentSignature) {
                agreementConditions.agentSignature = "Signed via DocuSign";
                agreementConditions.agentSignatureDate = agentSigner.deliveredDateTime || new Date().toISOString();
            }

            // Determine if the entire envelope is complete (all active signers signed)
            const isAllSigned = isTenantSigned && isOwnerSigned && isAgentSigned;

            // Trigger sequencing push notifications:
            // 1. Tenant signed -> notify Owner it is their turn to sign
            if (isTenantSigned && !isOwnerSigned) {
                // Send push notification to Owner
                try {
                    const notifyFunc = await fetch(`${supabaseUrl}/functions/v1/push-notification`, {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${supabaseAnonKey}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            userId: booking.owner_id,
                            title: "Lease Signed by Tenant",
                            body: "The tenant has signed the lease agreement. It is now your turn to review and sign.",
                            url: "/owner-dashboard",
                            type: "lease_pending"
                        })
                    });
                    await notifyFunc.text();
                } catch (pushErr) {
                    console.warn("Failed to send Owner turn push notification:", pushErr);
                }
            }

            // 2. Owner signed (and Agent exists but hasn't signed) -> notify Agent
            if (isTenantSigned && isOwnerSigned && agentSigner && !isAgentSigned) {
                try {
                    const notifyFunc = await fetch(`${supabaseUrl}/functions/v1/push-notification`, {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${supabaseAnonKey}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            userId: booking.agent_id,
                            title: "Lease Ready for Agent Signature",
                            body: "Both Tenant and Owner have signed the lease. Please sign the agreement to finalize.",
                            url: "/agent-dashboard",
                            type: "lease_pending"
                        })
                    });
                    await notifyFunc.text();
                } catch (pushErr) {
                    console.warn("Failed to send Agent turn push notification:", pushErr);
                }
            }

            let publicUrl = booking.lease_pdf_url;
            // Download the combined final PDF from DocuSign at each step to preserve progress
            const docResponse = await fetch(`${accountBaseUri}/restapi/v2.1/accounts/${docusignApiAccountId}/envelopes/${envelopeId}/documents/combined`, {
                method: "GET",
                headers: { "Authorization": `Bearer ${access_token}` }
            });

            if (docResponse.ok) {
                const signedPdfBuffer = await docResponse.arrayBuffer();
                const signedPdfBytes = new Uint8Array(signedPdfBuffer);

                // Upload the finalized signed document back to Supabase STORAGE
                const fileName = `leases/${booking.id}-lease-signed-${Date.now()}.pdf`;
                const { error: uploadError } = await supabaseAdmin
                    .storage
                    .from("MLS")
                    .upload(fileName, signedPdfBytes, {
                        contentType: "application/pdf",
                        upsert: true
                    });

                if (uploadError) throw uploadError;

                const { data: storageUrlData } = await supabaseAdmin
                    .storage
                    .from("MLS")
                    .getPublicUrl(fileName);
                publicUrl = storageUrlData.publicUrl;
            }

            // Update database booking record
            const updateFields: any = {
                agreement_conditions: agreementConditions,
                lease_pdf_url: publicUrl,
                updated_date: new Date().toISOString()
            };

            if (isAllSigned) {
                updateFields.lease_status = "signed";
                updateFields.status = "approved";
            }

            await supabaseAdmin
                .from("bookings")
                .update(updateFields)
                .eq("id", booking.id);

            return new Response(JSON.stringify({ success: true, message: "Lease status evaluated successfully" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        return new Response(JSON.stringify({ error: "Invalid action" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        console.error("DocuSign processing error:", err);
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        return new Response(JSON.stringify({ error: errorMessage }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
