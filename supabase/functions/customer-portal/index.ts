import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: any, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CUSTOMER-PORTAL] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "STRIPE_SECRET_KEY is not set" }, 500);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) {
      return json({ error: "Supabase env vars missing" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return json({ error: "Authentication failed" }, 401);
    }

    const user = userData.user;
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Read billing state from profiles (source of truth)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_customer_id, plan_status, comped_access, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      logStep("Profile lookup error", { message: profileError.message });
      return json({ error: "Failed to load profile" }, 500);
    }

    const role = profile?.role ?? "user";
    const planStatus = profile?.plan_status ?? "free";
    const comped = !!profile?.comped_access;
    const stripeCustomerId = profile?.stripe_customer_id ?? null;

    // Admins/Owner bypass billing, but still shouldn't open portal if no customer
    const isAdmin = role === "owner" || role === "admin";

    // ✅ Friendly outcomes instead of 500
    if (planStatus === "lifetime") {
      return json({
        action: "no_subscription",
        message: "Lifetime access — no subscription to manage.",
      });
    }

    if (comped && !stripeCustomerId) {
      return json({
        action: "comped",
        message: "Comped access — no billing to manage.",
        redirect_url: "/pricing",
      });
    }

    if (!stripeCustomerId) {
      // No Stripe customer yet → user must subscribe first (or go through checkout once)
      return json({
        action: "subscribe_first",
        message: "No billing profile found yet. Please subscribe first.",
        redirect_url: "/pricing",
      });
    }

    // Create portal session
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const origin =
      req.headers.get("origin") || Deno.env.get("APP_URL") || "https://axvogllmehhrnkdgzeoi.lovableproject.com";

    const returnUrl = `${origin}/settings/billing`;

    logStep("Creating portal session", { stripeCustomerId, returnUrl });

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    logStep("Portal session created", {
      sessionId: portalSession.id,
      url: portalSession.url,
    });

    return json({ action: "portal", url: portalSession.url });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });

    // Still avoid 500 for expected states, but unknown errors can be 500
    return json({ error: msg }, 500);
  }
});
