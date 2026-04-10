import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Product IDs from Stripe
const PRODUCT_IDS = {
  premium_monthly: "prod_TbohixxZWeMqqb",
  premium_yearly: "prod_TboirupELqDyNm",
  premium_lifetime: "prod_Tbohg9t9kTnxRh",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl) {
      throw new Error("SUPABASE_URL is not set");
    }
    if (!supabaseServiceKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
    }
    
    logStep("Supabase config verified", { url: supabaseUrl.substring(0, 30) + "..." });

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user...");
    
    let user;
    try {
      const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
      
      if (userError) {
        logStep("Auth error details", { 
          message: userError.message, 
          status: userError.status,
          name: userError.name 
        });
        // Return safe default instead of throwing - makes subscription check non-blocking
        return new Response(JSON.stringify({ 
          subscribed: false,
          tier: "unknown",
          subscription_end: null,
          is_lifetime: false,
          trial_days_remaining: null,
          degraded: true,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      
      user = userData.user;
      if (!user?.email) {
        logStep("User not authenticated or email not available");
        return new Response(JSON.stringify({ 
          subscribed: false,
          tier: "unknown",
          subscription_end: null,
          is_lifetime: false,
          trial_days_remaining: null,
          degraded: true,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    } catch (authErr) {
      logStep("Auth exception", { error: String(authErr) });
      // Return safe default on auth errors
      return new Response(JSON.stringify({ 
        subscribed: false,
        tier: "unknown",
        subscription_end: null,
        is_lifetime: false,
        trial_days_remaining: null,
        degraded: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No customer found");
      // Update profile to free tier
      await supabaseClient
        .from('profiles')
        .update({ subscription_tier: 'free', subscription_end: null })
        .eq('id', user.id);
        
      return new Response(JSON.stringify({ 
        subscribed: false,
        tier: "free",
        subscription_end: null,
        is_lifetime: false,
        trial_days_remaining: null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Check for active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 10,
    });

    // Also check for trialing subscriptions
    const trialingSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "trialing",
      limit: 10,
    });

    const allSubscriptions = [...subscriptions.data, ...trialingSubscriptions.data];
    
    if (allSubscriptions.length > 0) {
      const subscription = allSubscriptions[0];
      const subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      const productId = subscription.items.data[0].price.product as string;
      const isTrial = subscription.status === "trialing";
      
      // Calculate trial days remaining if in trial
      let trialDaysRemaining = null;
      let tier: 'trial' | 'monthly' = 'monthly';
      
      if (isTrial && subscription.trial_end) {
        const trialEnd = new Date(subscription.trial_end * 1000);
        const now = new Date();
        trialDaysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        tier = 'trial';
      }
      
      logStep("Active subscription found", { 
        subscriptionId: subscription.id, 
        productId,
        status: subscription.status,
        tier,
        trialDaysRemaining,
        endDate: subscriptionEnd 
      });

      // Update profile with subscription data
      await supabaseClient
        .from('profiles')
        .update({ 
          subscription_tier: tier,
          subscription_end: subscriptionEnd,
          stripe_customer_id: customerId,
          trial_started_at: isTrial ? subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null : null,
        })
        .eq('id', user.id);

      return new Response(JSON.stringify({
        subscribed: true,
        tier,
        product_id: productId,
        subscription_end: subscriptionEnd,
        is_lifetime: false,
        status: subscription.status,
        trial_days_remaining: trialDaysRemaining,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check for lifetime purchase (one-time payment)
    const paymentIntents = await stripe.paymentIntents.list({
      customer: customerId,
      limit: 100,
    });

    const lifetimePayment = paymentIntents.data.find((pi: any) => {
      if (pi.status !== "succeeded") return false;
      const metadata = pi.metadata;
      return metadata?.price_type === "lifetime" || metadata?.plan_id?.includes("lifetime");
    });

    // Also check checkout sessions for lifetime purchases
    const sessions = await stripe.checkout.sessions.list({
      customer: customerId,
      limit: 100,
    });

    const lifetimeSession = sessions.data.find((session: any) => {
      if (session.payment_status !== "paid") return false;
      return session.metadata?.price_type === "lifetime";
    });

    if (lifetimePayment || lifetimeSession) {
      logStep("Lifetime purchase found");
      
      // Update profile with lifetime subscription
      await supabaseClient
        .from('profiles')
        .update({ 
          subscription_tier: 'lifetime',
          subscription_end: null,
          stripe_customer_id: customerId,
        })
        .eq('id', user.id);
        
      return new Response(JSON.stringify({
        subscribed: true,
        tier: "lifetime",
        subscription_end: null,
        is_lifetime: true,
        trial_days_remaining: null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("No active subscription found");
    
    // Update profile to free tier
    await supabaseClient
      .from('profiles')
      .update({ subscription_tier: 'free', subscription_end: null })
      .eq('id', user.id);
      
    return new Response(JSON.stringify({
      subscribed: false,
      tier: "free",
      subscription_end: null,
      is_lifetime: false,
      trial_days_remaining: null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
