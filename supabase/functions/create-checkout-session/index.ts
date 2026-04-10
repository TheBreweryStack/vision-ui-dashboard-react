import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Price IDs from Stripe - $10/month, $80/year, $199 lifetime
const PRICE_IDS = {
  premium_monthly: "price_1Seb3410kaiKolWDTx7PBUHX",   // $9.99/month
  premium_yearly: "price_1Seb3O10kaiKolWDsux9t5dg",    // $79.99/year
  premium_lifetime: "price_1Seb3c10kaiKolWDgapGcOyZ",  // $199.99 one-time
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { planId, priceType, successUrl, cancelUrl } = await req.json();
    logStep("Request body", { planId, priceType });

    // Determine the price ID based on plan and price type
    let priceId: string;
    let mode: "subscription" | "payment";
    let trialPeriodDays: number | undefined;

    if (priceType === "lifetime") {
      priceId = PRICE_IDS.premium_lifetime;
      mode = "payment";
    } else if (priceType === "yearly") {
      priceId = PRICE_IDS.premium_yearly;
      mode = "subscription";
      trialPeriodDays = 7;
    } else {
      priceId = PRICE_IDS.premium_monthly;
      mode = "subscription";
      trialPeriodDays = 7;
    }

    logStep("Price determined", { priceId, mode, trialPeriodDays });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    }

    // Create checkout session
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode,
      success_url: successUrl || `${req.headers.get("origin")}/settings?payment=success`,
      cancel_url: cancelUrl || `${req.headers.get("origin")}/pricing?payment=cancelled`,
      metadata: {
        user_id: user.id,
        plan_id: planId,
        price_type: priceType,
      },
    };

    // Add trial period for subscriptions
    if (mode === "subscription" && trialPeriodDays) {
      sessionParams.subscription_data = {
        trial_period_days: trialPeriodDays,
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
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
