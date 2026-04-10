import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-SALES] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    // Authenticate user using getClaims (more reliable than getUser)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    
    // Create Supabase client with anon key for auth validation
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Use getClaims to validate JWT - more reliable than getUser
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      logStep("Auth failed", { error: claimsError?.message });
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    const userId = claimsData.claims.sub;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    logStep("User authenticated", { userId });

    // Create service role client for database operations
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Check if user is admin or owner
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (!roleData || !['admin', 'owner'].includes(roleData.role)) {
      throw new Error("Access denied: Admin or Owner role required");
    }
    logStep("Role verified", { role: roleData.role });

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const rangeDays = body.rangeDays || 30;
    const limit = Math.min(body.limit || 20, 100);
    logStep("Request params", { rangeDays, limit });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Calculate timestamps
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60);
    const sevenDaysAgo = now - (7 * 24 * 60 * 60);

    // Fetch balance transactions for revenue data
    const balanceTransactions = await stripe.balanceTransactions.list({
      created: { gte: thirtyDaysAgo },
      limit: 100,
      type: 'charge',
    });

    const refundTransactions = await stripe.balanceTransactions.list({
      created: { gte: thirtyDaysAgo },
      limit: 100,
      type: 'refund',
    });

    // Calculate summary
    let gross30d = 0;
    let gross7d = 0;
    let net30d = 0;
    let net7d = 0;

    for (const txn of balanceTransactions.data) {
      gross30d += txn.amount;
      net30d += txn.net;
      if (txn.created >= sevenDaysAgo) {
        gross7d += txn.amount;
        net7d += txn.net;
      }
    }

    let refunds30d = 0;
    for (const txn of refundTransactions.data) {
      refunds30d += Math.abs(txn.amount);
    }

    // Convert from cents to dollars
    const summary = {
      gross_30d: gross30d / 100,
      gross_7d: gross7d / 100,
      net_30d: net30d / 100,
      net_7d: net7d / 100,
      refunds_30d: refunds30d / 100,
      currency: 'usd',
    };
    logStep("Summary calculated", summary);

    // Fetch recent payment intents for transaction list
    const paymentIntents = await stripe.paymentIntents.list({
      limit,
      created: { gte: thirtyDaysAgo },
    });

    const recentTransactions = [];
    for (const pi of paymentIntents.data) {
      let customerEmail = null;
      if (pi.customer) {
        try {
          const customer = await stripe.customers.retrieve(pi.customer as string);
          if (customer && !customer.deleted) {
            customerEmail = (customer as Stripe.Customer).email;
          }
        } catch (e) {
          // Customer may have been deleted
        }
      }

      recentTransactions.push({
        id: pi.id,
        created: pi.created,
        amount: pi.amount / 100,
        currency: pi.currency,
        status: pi.status,
        customer_email: customerEmail,
        description: pi.description || 'Subscription payment',
      });
    }

    logStep("Transactions fetched", { count: recentTransactions.length });

    return new Response(
      JSON.stringify({
        summary,
        transactions: recentTransactions,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    logStep("ERROR", { message: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
