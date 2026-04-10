import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Generate a random base32 secret (20 bytes = 32 base32 chars)
function generateSecret(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

// Base32 encoding for TOTP secrets
function base32Encode(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let result = "";
  let bits = 0;
  let value = 0;

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }

  if (bits > 0) {
    result += alphabet[(value << (5 - bits)) & 0x1f];
  }

  return result;
}

// Encrypt the secret using AES-GCM
async function encryptSecret(secret: string): Promise<string> {
  const encryptionKey = Deno.env.get("TOTP_ENCRYPTION_KEY");
  if (!encryptionKey) {
    throw new Error("TOTP_ENCRYPTION_KEY not configured");
  }

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(encryptionKey.padEnd(32, "0").slice(0, 32)),
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    keyMaterial,
    encoder.encode(secret)
  );

  // Combine IV and ciphertext
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  // Return as base64
  return btoa(String.fromCharCode(...combined));
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get user from JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      console.error("Claims error:", claimsError);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const email = claimsData.claims.email || "user";

    console.log(`Setting up TOTP for user: ${userId}`);

    // Check if user already has a verified TOTP
    const { data: existingTotp, error: checkError } = await supabase
      .from("totp_secrets")
      .select("id, verified")
      .eq("user_id", userId)
      .maybeSingle();

    if (checkError) {
      console.error("Error checking existing TOTP:", checkError);
      throw new Error("Failed to check existing 2FA setup");
    }

    if (existingTotp?.verified) {
      return new Response(
        JSON.stringify({ error: "2FA is already enabled. Disable it first to set up again." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generate new TOTP secret
    const secret = generateSecret();
    const encryptedSecret = await encryptSecret(secret);

    // Upsert the TOTP secret (replace existing unverified one)
    const { error: upsertError } = await supabase
      .from("totp_secrets")
      .upsert(
        {
          user_id: userId,
          encrypted_secret: encryptedSecret,
          verified: false,
          created_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      console.error("Error upserting TOTP:", upsertError);
      throw new Error("Failed to save 2FA secret");
    }

    // Build otpauth URL for QR code
    const issuer = encodeURIComponent("TradeCafe");
    const accountName = encodeURIComponent(email as string);
    const otpauthUrl = `otpauth://totp/${issuer}:${accountName}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;

    console.log(`TOTP setup initiated for user: ${userId}`);

    return new Response(
      JSON.stringify({
        success: true,
        secret: secret, // For manual entry
        otpauthUrl: otpauthUrl, // For QR code generation
        message: "Scan the QR code with your authenticator app, then verify with a code",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Setup TOTP error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
