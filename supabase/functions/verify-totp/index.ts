import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Base32 decoding for TOTP secrets
function base32Decode(encoded: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleanedInput = encoded.toUpperCase().replace(/=+$/, "");
  
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const char of cleanedInput) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    
    value = (value << 5) | idx;
    bits += 5;
    
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return new Uint8Array(output);
}

// Decrypt the secret using AES-GCM
async function decryptSecret(encryptedSecret: string): Promise<string> {
  const encryptionKey = Deno.env.get("TOTP_ENCRYPTION_KEY");
  if (!encryptionKey) {
    throw new Error("TOTP_ENCRYPTION_KEY not configured");
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(encryptionKey.padEnd(32, "0").slice(0, 32)),
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  // Decode base64
  const combined = Uint8Array.from(atob(encryptedSecret), c => c.charCodeAt(0));
  
  // Extract IV (first 12 bytes) and ciphertext
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    keyMaterial,
    ciphertext
  );

  return decoder.decode(decrypted);
}

// Generate TOTP code using HMAC-SHA1
async function generateTotp(secret: string, counter: number): Promise<string> {
  const secretBytes = base32Decode(secret);
  
  // Convert counter to 8-byte big-endian
  const counterBytes = new Uint8Array(8);
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = counter & 0xff;
    counter = Math.floor(counter / 256);
  }

  // Import key for HMAC - use ArrayBuffer to avoid type issues
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes.buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );

  // Calculate HMAC
  const signature = await crypto.subtle.sign("HMAC", key, counterBytes);
  const hmac = new Uint8Array(signature);

  // Dynamic truncation
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  // Get 6-digit code
  const otp = code % 1000000;
  return otp.toString().padStart(6, "0");
}

// Verify TOTP with time window tolerance and drift detection
async function verifyTotp(
  secret: string, 
  code: string, 
  window = 2  // Increased from 1 to 2 (±60 seconds)
): Promise<{ valid: boolean; drift?: number }> {
  const currentTime = Math.floor(Date.now() / 1000);
  const timeStep = 30;
  const currentCounter = Math.floor(currentTime / timeStep);

  // Check extended window (±5) to detect time drift (up to ±150 seconds)
  const extendedWindow = 5;
  
  for (let i = -extendedWindow; i <= extendedWindow; i++) {
    const expectedCode = await generateTotp(secret, currentCounter + i);
    if (expectedCode === code) {
      // If matched outside normal window, report drift
      const isWithinNormalWindow = Math.abs(i) <= window;
      return { 
        valid: isWithinNormalWindow, 
        drift: isWithinNormalWindow ? undefined : i * 30 
      };
    }
  }

  return { valid: false };
}

// Simple hash function for backup codes
async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Verify backup code
// deno-lint-ignore no-explicit-any
async function verifyBackupCode(
  supabaseAdmin: any,
  userId: string,
  code: string
): Promise<boolean> {
  // Get all unused backup codes for user using admin client
  const { data: codes, error } = await supabaseAdmin
    .from("backup_codes")
    .select("id, code_hash")
    .eq("user_id", userId)
    .is("used_at", null);

  if (error || !codes?.length) {
    return false;
  }

  // Check each code
  const inputHash = await hashCode(code);
  
  for (const backupCode of codes as Array<{ id: string; code_hash: string }>) {
    if (backupCode.code_hash === inputHash) {
      // Mark code as used
      await supabaseAdmin
        .from("backup_codes")
        .update({ used_at: new Date().toISOString() })
        .eq("id", backupCode.id);
      
      return true;
    }
  }

  return false;
}

// Generate device trust token
function generateDeviceToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { code, isSetup = false, trustDevice = false, useBackupCode = false } = body;

    if (!code || typeof code !== "string" || (code.length !== 6 && !useBackupCode)) {
      return new Response(
        JSON.stringify({ error: "Invalid code format. Please enter a 6-digit code." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Use service role for trusted device operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    console.log(`Verifying TOTP for user: ${userId}, isSetup: ${isSetup}, useBackupCode: ${useBackupCode}`);

    // Get user's TOTP secret
    const { data: totpData, error: totpError } = await supabase
      .from("totp_secrets")
      .select("encrypted_secret, verified")
      .eq("user_id", userId)
      .maybeSingle();

    if (totpError) {
      console.error("Error fetching TOTP:", totpError);
      throw new Error("Failed to verify 2FA");
    }

    if (!totpData) {
      return new Response(
        JSON.stringify({ error: "2FA is not set up for this account" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // For login verification, TOTP must be verified
    if (!isSetup && !totpData.verified) {
      return new Response(
        JSON.stringify({ error: "2FA setup is incomplete" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let isValid = false;

    let timeDrift: number | undefined;
    
    if (useBackupCode) {
      // Verify backup code using admin client
      isValid = await verifyBackupCode(supabaseAdmin, userId, code);
      if (!isValid) {
        console.log(`Invalid backup code for user: ${userId}`);
      }
    } else {
      // Verify TOTP code with drift detection
      const secret = await decryptSecret(totpData.encrypted_secret);
      const totpResult = await verifyTotp(secret, code);
      isValid = totpResult.valid;
      timeDrift = totpResult.drift;
      
      if (!isValid) {
        console.log(`Invalid TOTP code for user: ${userId}, drift: ${timeDrift ?? 'none detected'}`);
      }
    }

    if (!isValid) {
      // Check if there's detectable time drift
      if (timeDrift !== undefined) {
        const driftSeconds = Math.abs(timeDrift);
        console.log(`Time drift detected for user ${userId}: ${timeDrift}s`);
        
        return new Response(
          JSON.stringify({ 
            error: `Your device's clock appears to be off by about ${driftSeconds} seconds. Please enable "Set time automatically" in your phone settings and try again.`,
            code: 'TIME_DRIFT',
            driftSeconds: timeDrift
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          error: useBackupCode 
            ? "Invalid backup code" 
            : "Invalid verification code. Please try again." 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let generatedBackupCodes: string[] = [];

    // If this is setup verification, mark TOTP as verified and generate backup codes
    if (isSetup && !totpData.verified) {
      const { error: updateError } = await supabase
        .from("totp_secrets")
        .update({ 
          verified: true, 
          verified_at: new Date().toISOString() 
        })
        .eq("user_id", userId);

      if (updateError) {
        console.error("Error marking TOTP verified:", updateError);
        throw new Error("Failed to complete 2FA setup");
      }

      console.log(`TOTP verified and enabled for user: ${userId}`);

      // Generate backup codes for the user
      generatedBackupCodes = [];
      for (let i = 0; i < 10; i++) {
        const code = 
          Math.random().toString(36).substring(2, 8).toUpperCase() +
          "-" +
          Math.random().toString(36).substring(2, 8).toUpperCase();
        generatedBackupCodes.push(code);
      }

      // Hash and store the backup codes
      const hashedCodes = await Promise.all(
        generatedBackupCodes.map(async (code) => ({
          user_id: userId,
          code_hash: await hashCode(code),
        }))
      );

      // Delete any existing backup codes for this user
      await supabaseAdmin
        .from("backup_codes")
        .delete()
        .eq("user_id", userId);

      // Insert new backup codes
      const { error: codesError } = await supabaseAdmin
        .from("backup_codes")
        .insert(hashedCodes);

      if (codesError) {
        console.error("Error storing backup codes:", codesError);
        // Don't fail - 2FA is still enabled, just no backup codes
        generatedBackupCodes = [];
      } else {
        console.log(`Generated ${generatedBackupCodes.length} backup codes for user: ${userId}`);
      }
    }

    let deviceToken = null;

    // Create trusted device if requested
    if (trustDevice) {
      deviceToken = generateDeviceToken();
      const userAgent = req.headers.get("user-agent") || "Unknown";
      const forwardedFor = req.headers.get("x-forwarded-for");
      const ipAddress = forwardedFor?.split(",")[0]?.trim() || "Unknown";

      // Parse user agent for device name
      let deviceName = "Unknown Device";
      if (userAgent.includes("iPhone")) deviceName = "iPhone";
      else if (userAgent.includes("iPad")) deviceName = "iPad";
      else if (userAgent.includes("Android")) deviceName = "Android Device";
      else if (userAgent.includes("Mac")) deviceName = "Mac";
      else if (userAgent.includes("Windows")) deviceName = "Windows PC";
      else if (userAgent.includes("Linux")) deviceName = "Linux";

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

      const { error: deviceError } = await supabaseAdmin
        .from("trusted_devices")
        .insert({
          user_id: userId,
          device_token: deviceToken,
          device_name: deviceName,
          user_agent: userAgent,
          ip_address: ipAddress,
          expires_at: expiresAt.toISOString(),
        });

      if (deviceError) {
        console.error("Error creating trusted device:", deviceError);
        // Don't fail the request, just log the error
        deviceToken = null;
      } else {
        console.log(`Trusted device created for user: ${userId}`);
      }
    }

    // Build response with backup codes if this was setup
    const responseData: Record<string, unknown> = {
      success: true,
      verified: true,
      deviceToken: deviceToken,
      message: isSetup ? "2FA has been enabled successfully" : "Verification successful",
    };

    // Only include backup codes for setup verification
    if (isSetup && generatedBackupCodes.length > 0) {
      responseData.backupCodes = generatedBackupCodes;
    }

    return new Response(
      JSON.stringify(responseData),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Verify TOTP error:", error);
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
