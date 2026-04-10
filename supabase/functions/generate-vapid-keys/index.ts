import * as webpush from "jsr:@negrel/webpush";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * One-time utility to generate VAPID keys using the @negrel/webpush library.
 * 
 * This generates keys in the native JWK format that the library expects,
 * avoiding the manual base64url-to-JWK conversion that causes issues with
 * Apple's strict JWT validation.
 * 
 * Run once, then:
 * 1. Store the full JSON output as VAPID_KEYS_JWK secret
 * 2. Update VAPID_PUBLIC_KEY in src/lib/pushNotifications.ts with the public_key_base64url value
 * 3. Delete old push_subscriptions (they're bound to the old VAPID key)
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[generate-vapid-keys] Generating new VAPID key pair...');

    // Generate keys using the library's native method with extractable option
    // This ensures we can export the keys for storage
    const vapidKeys = await webpush.generateVapidKeys({ extractable: true });

    // Export in formats needed for storage and client
    const exportedKeys = await webpush.exportVapidKeys(vapidKeys);

    // Convert public key JWK to base64url format for client-side use
    // The public key in JWK format has x and y coordinates
    const publicKeyJwk = exportedKeys.publicKey;
    
    // Reconstruct the uncompressed public key (0x04 || x || y)
    const xBytes = base64UrlDecode(publicKeyJwk.x!);
    const yBytes = base64UrlDecode(publicKeyJwk.y!);
    
    const uncompressedKey = new Uint8Array(65);
    uncompressedKey[0] = 0x04; // Uncompressed point prefix
    uncompressedKey.set(xBytes, 1);
    uncompressedKey.set(yBytes, 33);
    
    const publicKeyBase64Url = base64UrlEncode(uncompressedKey);

    console.log('[generate-vapid-keys] Keys generated successfully');
    console.log('[generate-vapid-keys] Public key (base64url):', publicKeyBase64Url);

    // The response contains everything needed:
    // - jwk: Store this as VAPID_KEYS_JWK secret (JSON stringified)
    // - public_key_base64url: Put this in src/lib/pushNotifications.ts
    const result = {
      jwk: exportedKeys,
      public_key_base64url: publicKeyBase64Url,
      instructions: {
        step1: 'Store the "jwk" object as a secret named VAPID_KEYS_JWK (JSON.stringify it first)',
        step2: 'Update VAPID_PUBLIC_KEY in src/lib/pushNotifications.ts with the public_key_base64url value',
        step3: 'Deploy updated edge functions',
        step4: 'Users will need to re-enable notifications (old subscriptions are bound to old key)',
      },
    };

    return new Response(
      JSON.stringify(result, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[generate-vapid-keys] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Decode base64url to Uint8Array
 */
function base64UrlDecode(str: string): Uint8Array {
  // Add padding if needed
  const padding = '='.repeat((4 - str.length % 4) % 4);
  const base64 = (str + padding).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encode Uint8Array to base64url
 */
function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
