import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's token to verify their identity
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the caller is authenticated
    const { data: { user: caller }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !caller) {
      console.error('[admin-reset-2fa] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create service role client to check admin status and perform deletions
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if caller has admin or owner role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .in('role', ['admin', 'owner'])
      .maybeSingle();

    if (roleError) {
      console.error('[admin-reset-2fa] Role check error:', roleError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify admin status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!roleData) {
      console.warn('[admin-reset-2fa] Non-admin attempt by:', caller.id, caller.email);
      return new Response(
        JSON.stringify({ error: 'Not authorized - admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { userId } = await req.json();
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing userId in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify target user exists
    const { data: targetUser, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, display_name')
      .eq('id', userId)
      .maybeSingle();

    if (userError || !targetUser) {
      console.error('[admin-reset-2fa] User not found:', userId);
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[admin-reset-2fa] Admin ${caller.email} resetting 2FA for user ${targetUser.email || userId}`);

    // Delete from all 2FA-related tables using service role (bypasses RLS)
    // Use .select() to get the deleted rows for verification
    const [totpResult, backupResult, devicesResult] = await Promise.all([
      supabaseAdmin.from('totp_secrets').delete().eq('user_id', userId).select(),
      supabaseAdmin.from('backup_codes').delete().eq('user_id', userId).select(),
      supabaseAdmin.from('trusted_devices').delete().eq('user_id', userId).select(),
    ]);

    // Check for errors and fail if any occurred
    const errors: string[] = [];
    if (totpResult.error) {
      console.error('[admin-reset-2fa] totp_secrets delete error:', totpResult.error);
      errors.push(`totp_secrets: ${totpResult.error.message}`);
    }
    if (backupResult.error) {
      console.error('[admin-reset-2fa] backup_codes delete error:', backupResult.error);
      errors.push(`backup_codes: ${backupResult.error.message}`);
    }
    if (devicesResult.error) {
      console.error('[admin-reset-2fa] trusted_devices delete error:', devicesResult.error);
      errors.push(`trusted_devices: ${devicesResult.error.message}`);
    }

    // If any errors, return failure
    if (errors.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to reset 2FA',
          details: errors,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log what was deleted
    console.log(`[admin-reset-2fa] Deleted for user ${userId}:`, {
      totpSecrets: totpResult.data?.length || 0,
      backupCodes: backupResult.data?.length || 0,
      trustedDevices: devicesResult.data?.length || 0,
    });

    console.log(`[admin-reset-2fa] 2FA reset complete for user ${userId} by admin ${caller.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: '2FA reset complete',
        deleted: {
          totpSecrets: totpResult.data?.length || 0,
          backupCodes: backupResult.data?.length || 0,
          trustedDevices: devicesResult.data?.length || 0,
        },
        targetUser: {
          id: targetUser.id,
          email: targetUser.email,
          displayName: targetUser.display_name,
        },
        resetBy: {
          id: caller.id,
          email: caller.email,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[admin-reset-2fa] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
