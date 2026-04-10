import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization");

    console.log("Admin email update request received");

    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create client with user's token to verify they're admin/owner
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: userError } = await userClient.auth.getUser();
    if (userError || !caller) {
      console.error("Failed to get caller user:", userError);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Caller user ID: ${caller.id}`);

    // Check if caller is admin or owner using the has_role function
    const { data: isAdmin } = await userClient.rpc('has_role', { 
      _user_id: caller.id, 
      _role: 'admin' 
    });
    const { data: isOwner } = await userClient.rpc('has_role', { 
      _user_id: caller.id, 
      _role: 'owner' 
    });

    console.log(`Caller is admin: ${isAdmin}, is owner: ${isOwner}`);

    if (!isAdmin && !isOwner) {
      console.error("Caller is not admin or owner");
      return new Response(JSON.stringify({ error: "Forbidden: Admin/Owner only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const { target_user_id, new_email } = await req.json();

    if (!target_user_id || !new_email) {
      console.error("Missing target_user_id or new_email");
      return new Response(JSON.stringify({ error: "Missing target_user_id or new_email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(new_email)) {
      console.error("Invalid email format:", new_email);
      return new Response(JSON.stringify({ error: "Invalid email format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Updating email for user ${target_user_id} to ${new_email}`);

    // Use service role client to update user's email (bypasses confirmation)
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Update auth user email
    const { data: authUpdateData, error: authError } = await adminClient.auth.admin.updateUserById(target_user_id, {
      email: new_email,
      email_confirm: true, // Skip confirmation since admin is forcing it
    });

    if (authError) {
      console.error("Failed to update auth user email:", authError);
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Auth user email updated successfully");

    // Also update the profiles table email field
    const { error: profileError } = await adminClient
      .from("profiles")
      .update({ email: new_email, updated_at: new Date().toISOString() })
      .eq("id", target_user_id);

    if (profileError) {
      console.warn("Failed to update profile email (non-fatal):", profileError);
      // Don't fail the request, auth update already succeeded
    } else {
      console.log("Profile email updated successfully");
    }

    return new Response(JSON.stringify({ success: true, email: new_email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in admin-update-email function:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
