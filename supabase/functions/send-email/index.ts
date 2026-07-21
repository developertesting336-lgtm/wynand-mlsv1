import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

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
    const { to, subject, body, fromEmail, fromName } = await req.json();

    console.log(to, subject, body, fromEmail, fromName);

    if (!to || !subject || !body) {
      return new Response(JSON.stringify({ error: "Missing required fields: to, subject, body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read SMTP/email service credentials from Supabase secrets
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const smtpFrom = Deno.env.get('SMTP_FROM') || fromEmail || 'info@pvverified.com';
    const smtpFromName = Deno.env.get('SMTP_FROM_NAME') || fromName || 'PV Verified Rentals';
    
    console.log('[Email] Config:', { 
      resendApiKey: resendApiKey ? '***set***' : 'MISSING', 
      smtpFrom, 
      fromName, 
      to, 
      subject 
    });

    if (!resendApiKey) {
      console.error('[Email] RESEND_API_KEY not configured in Supabase secrets');
      return new Response(JSON.stringify({ error: 'Email service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fromAddress = `${smtpFromName} <${smtpFrom}>`;

    // Send email via Resend API (HTTP-based, works in Supabase Edge Runtime)
    console.log(`[Email] Sending via Resend API...`);
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: fromAddress,
        to: Array.isArray(to) ? to : [to],
        subject: subject,
        html: body,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Email] Resend API error:', errText);
      throw new Error(`Failed to send email: ${errText}`);
    }

    const result = await res.json();
    console.log(`📧 Email sent successfully to ${to}, ID: ${result.id}`);
    
    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error('[Email] Fatal error:', err);
    return new Response(JSON.stringify({ error: err?.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});