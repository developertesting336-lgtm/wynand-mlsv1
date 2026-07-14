import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

/* ---------- CORS ---------- */
export const getCorsHeaders = (originHeader: string | null) => {
  const origin = originHeader ?? '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
  };
};

const veriffBaseUrl = (Deno.env.get('VERIFF_API_URL') ||
  'https://stationapi.veriff.com').replace(/\/+$/, '');
const veriffApiKey = Deno.env.get('VERIFF_API_KEY') || '';
const veriffSharedSecret = Deno.env.get('VERIFF_MASTER_SIGNATURE') || '';

/* ---------- Helpers ---------- */

/** Compute HMAC-SHA256 hex signature over the request body */
async function hmacSignature(payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(veriffSharedSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Detect MIME type from URL / file extension */
function mimeFromUrl(url: string): string {
  const lower = url.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg'; // default for .jpg/.jpeg and unknowns
}

/**
 * Download a file from a public URL, base64-encode it,
 * and upload it to the Veriff session media endpoint.
 */
async function uploadMediaToVeriff(
  sessionId: string,
  fileUrl: string,
  context: string,       // e.g. "document-front", "document-back"
): Promise<void> {
  /* 1. Download the file */
  console.log(`[media] Downloading ${context} from: ${fileUrl}`);
  const fileResp = await fetch(fileUrl);
  if (!fileResp.ok) {
    throw new Error(`Failed to download ${context}: HTTP ${fileResp.status}`);
  }
  const fileBuffer = await fileResp.arrayBuffer();
  const bytes = new Uint8Array(fileBuffer);

  /* 2. Base64-encode */
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  const mime = mimeFromUrl(fileUrl);
  const dataUri = `data:${mime};base64,${base64}`;

  /* 3. Build the request body */
  const body = JSON.stringify({
    image: {
      context,
      content: dataUri,
    },
  });

  /* 4. HMAC signature over the body */
  const signature = await hmacSignature(body);

  /* 5. POST to Veriff media endpoint */
  const mediaUrl = `${veriffBaseUrl}/v1/sessions/${sessionId}/media`;
  console.log(`[media] Uploading ${context} (${mime}, ${bytes.length} bytes) to ${mediaUrl}`);

  const resp = await fetch(mediaUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-AUTH-CLIENT': veriffApiKey,
      'X-HMAC-SIGNATURE': signature,
    },
    body,
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Veriff media upload failed for ${context}: ${resp.status} – ${err}`);
  }
  console.log(`[media] ${context} uploaded successfully`);
}

/* ---------- Edge function ---------- */
serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));

  if (req.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: corsHeaders });

  try {
    /* -------- Supabase client -------- */
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { userId, idDocumentUrl } = await req.json();

    if (!userId || !idDocumentUrl) {
      return new Response(
        JSON.stringify({ error: 'userId and idDocumentUrl are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    /* -------- Fetch user profile -------- */
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const nameParts = (profile.full_name || 'Renter').trim().split(/\s+/);
    const firstName = nameParts[0] || 'Renter';
    const lastName = nameParts.slice(1).join(' ') || 'User';

    /* -------- Initialise Veriff session -------- */
    if (!veriffApiKey) {
      return new Response(
        JSON.stringify({ error: 'VERIFF_API_KEY not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const sessionCreateUrl = `${veriffBaseUrl}/v1/sessions`;
    const veriffResp = await fetch(sessionCreateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-CLIENT': veriffApiKey,
      },
      body: JSON.stringify({
        verification: {
          endUserId: userId,
          vendorData: userId,
          callback: `${supabaseUrl}/functions/v1/veriff-callback`,
          timestamp: new Date().toISOString(),
          person: { firstName, lastName },
        },
      }),
    });

    if (!veriffResp.ok) {
      const err = await veriffResp.text();
      console.error('Veriff session creation failed:', err);
      return new Response(
        JSON.stringify({ error: `Veriff error: ${err}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { verification: sessionData } = await veriffResp.json();
    const { id: sessionId, url: sessionUrl } = sessionData;
    console.log(`[session] Created Veriff session: ${sessionId}`);

    /* -------- Upload documents to Veriff -------- */
    // Upload ID document as document-front
    await uploadMediaToVeriff(sessionId, idDocumentUrl, 'document-front');



    /* -------- Submit the session (after media upload) -------- */
    const submitBody = JSON.stringify({ verification: { status: 'submitted' } });
    const submitSignature = await hmacSignature(submitBody);

    console.log(`[submit] Submitting session ${sessionId}`);
    const submitResp = await fetch(`${veriffBaseUrl}/v1/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-CLIENT': veriffApiKey,
        'X-HMAC-SIGNATURE': submitSignature,
      },
      body: submitBody,
    });

    console.log(`[submit] Response status: ${submitResp.status}`);
    if (!submitResp.ok) {
      const err = await submitResp.text();
      console.error('Veriff session submit failed:', err);
      return new Response(
        JSON.stringify({ error: `Submit failed: ${err}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    /* -------- Upsert verification record -------- */
    const { data: verificationRecord, error: upsertError } = await supabase
      .from('verifications')
      .upsert(
        {
          user_id: userId,
          id_document_url: idDocumentUrl,
          veriff_session_id: sessionId,
          veriff_session_url: sessionUrl,
          updated_date: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select()
      .single();

    if (upsertError) {
      console.error('Upsert verification record error:', upsertError);
      throw new Error(`Failed to save verification: ${upsertError.message}`);
    }

    /* -------- All good – respond to client -------- */
    return new Response(
      JSON.stringify({ success: true, verification: verificationRecord }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('Veriff Verification Error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
