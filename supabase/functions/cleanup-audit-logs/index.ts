import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

export const getCorsHeaders = (originHeader: string | null) => ({
  'Access-Control-Allow-Origin': originHeader ?? '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
});

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log("=== Audit Logs Cleanup Job Started ===");

    // Calculate the date 6 months ago
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    console.log(`Deleting audit logs created before: ${sixMonthsAgo.toISOString()}`);

    // Delete rows older than 6 months
    const { count, error } = await supabase
      .from('audit_logs')
      .delete({ count: 'exact' })
      .lt('created_at', sixMonthsAgo.toISOString());

    if (error) {
      console.error('Error deleting audit logs:', error);
      throw error;
    }

    const deletedCount = count || 0;
    console.log(`Successfully cleaned up ${deletedCount} old audit log entries.`);

    return new Response(JSON.stringify({ success: true, deletedCount }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Audit logs cleanup failed:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
