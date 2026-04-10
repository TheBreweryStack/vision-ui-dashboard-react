import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, endpoint: targetEndpoint } = await req.json();
    
    if (!userId) {
      throw new Error('userId is required');
    }

    console.log(`[send-test-push] Sending test push to user: ${userId}`);
    if (targetEndpoint) {
      console.log(`[send-test-push] Targeting specific endpoint: ${targetEndpoint.slice(0, 60)}...`);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Load VAPID keys from JWK secret (new format)
    const vapidKeysJwk = Deno.env.get('VAPID_KEYS_JWK');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:hello@tradercafe.app';

    console.log('[send-test-push] VAPID_KEYS_JWK configured:', !!vapidKeysJwk);

    if (!vapidKeysJwk) {
      throw new Error('VAPID_KEYS_JWK not configured. Run generate-vapid-keys function first.');
    }

    // Parse the JWK directly - no manual conversion needed
    let parsedKeys: webpush.ExportedVapidKeys;
    try {
      parsedKeys = JSON.parse(vapidKeysJwk);
      console.log('[send-test-push] Parsed VAPID keys successfully');
    } catch (parseError) {
      console.error('[send-test-push] Failed to parse VAPID_KEYS_JWK:', parseError);
      throw new Error('Invalid VAPID_KEYS_JWK format');
    }

    // Get user subscriptions - optionally filter by endpoint
    let query = supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);
    
    if (targetEndpoint) {
      query = query.eq('endpoint', targetEndpoint);
    }
    
    const { data: subscriptions, error: subError } = await query;

    if (subError) throw subError;

    console.log(`[send-test-push] Found ${subscriptions?.length || 0} subscriptions${targetEndpoint ? ' (filtered)' : ''}`);

    if (!subscriptions?.length) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: targetEndpoint 
            ? 'This device is not registered' 
            : 'No push subscriptions found for this user' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize web push using library's native key import
    // This uses JWK directly - no manual conversion!
    const vapidKeys = await webpush.importVapidKeys(parsedKeys, { extractable: true });
    const appServer = await webpush.ApplicationServer.new({
      contactInformation: vapidSubject,
      vapidKeys,
    });

    console.log('[send-test-push] Web push initialized successfully');
    console.log('[send-test-push] VAPID subject:', vapidSubject);

    const payload = JSON.stringify({
      title: '🧪 Test Push Notification',
      body: `This is a test sent at ${new Date().toLocaleTimeString()}`,
      icon: '/app-icon.png',
      badge: '/app-icon.png',
      tag: 'test-push',
      silent: false,
      requireInteraction: false,
      data: {
        url: '/diagnostics',
        type: 'test'
      }
    });

    let successCount = 0;
    let failCount = 0;
    let staleCount = 0;
    const errors: string[] = [];

    for (const sub of subscriptions) {
      try {
        console.log(`[send-test-push] Sending to subscription ${sub.id}`);
        console.log(`[send-test-push] Endpoint: ${sub.endpoint.slice(0, 60)}...`);
        
        // Log audience for debugging Apple's strict JWT validation
        const endpointOrigin = new URL(sub.endpoint).origin;
        console.log(`[send-test-push] Audience (aud): ${endpointOrigin}`);
        console.log(`[send-test-push] Is Apple endpoint: ${endpointOrigin.includes('apple.com')}`);
        
        const subscriber = appServer.subscribe({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth }
        });
        
        await subscriber.pushTextMessage(payload, {});
        successCount++;
        console.log(`[send-test-push] Push sent successfully to ${sub.id}`);
        
        // Update last_successful_push_at for successful pushes
        await supabase
          .from('push_subscriptions')
          .update({ last_successful_push_at: new Date().toISOString() })
          .eq('id', sub.id);
          
      } catch (pushError: unknown) {
        failCount++;
        
        // Extract status from @negrel/webpush error format
        const response = (pushError as { response?: Response })?.response;
        const statusCode = response?.status;
        let errorReason = 'unknown';
        
        // Try to read response body for error details
        if (response && !response.bodyUsed) {
          try {
            errorReason = await response.text();
          } catch {
            // Ignore body read errors
          }
        }
        
        const errorMsg = pushError instanceof Error ? pushError.message : String(pushError);
        console.error(`[send-test-push] Push failed for ${sub.id}: status=${statusCode}, reason=${errorReason}`);
        console.error(`[send-test-push] Full error:`, errorMsg);
        
        errors.push(`Sub ${sub.id.slice(0, 8)}: ${statusCode || 'unknown'} - ${errorReason.slice(0, 100)}`);

        // Handle stale subscriptions (410 Gone)
        if (statusCode === 410) {
          console.log(`[send-test-push] Deleting stale subscription ${sub.id}`);
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          staleCount++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: successCount > 0,
        message: `Sent: ${successCount}, Failed: ${failCount}`,
        errors: errors.length > 0 ? errors : undefined,
        staleDeleted: staleCount > 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[send-test-push] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
