import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const { deviceToken } = body;

    if (!deviceToken || typeof deviceToken !== "string") {
      return new Response(
        JSON.stringify({ trusted: false, reason: "No device token provided" }),
        {
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

    // Use service role for device operations
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

    // Check if device is trusted
    const { data: device, error: deviceError } = await supabaseAdmin
      .from("trusted_devices")
      .select("id, expires_at, device_name")
      .eq("user_id", userId)
      .eq("device_token", deviceToken)
      .maybeSingle();

    if (deviceError) {
      console.error("Error checking trusted device:", deviceError);
      return new Response(
        JSON.stringify({ trusted: false, reason: "Error checking device" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!device) {
      console.log(`Device not found for user: ${userId}`);
      return new Response(
        JSON.stringify({ trusted: false, reason: "Device not found" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if expired
    const expiresAt = new Date(device.expires_at);
    if (expiresAt < new Date()) {
      console.log(`Device expired for user: ${userId}`);
      
      // Clean up expired device
      await supabaseAdmin
        .from("trusted_devices")
        .delete()
        .eq("id", device.id);

      return new Response(
        JSON.stringify({ trusted: false, reason: "Device trust expired" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update last_used_at
    await supabaseAdmin
      .from("trusted_devices")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", device.id);

    console.log(`Device trusted for user: ${userId}`);

    return new Response(
      JSON.stringify({
        trusted: true,
        deviceName: device.device_name,
        expiresAt: device.expires_at,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Check trusted device error:", error);
    return new Response(
      JSON.stringify({ trusted: false, reason: "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
