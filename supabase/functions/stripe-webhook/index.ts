import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

// Price IDs - map to plan types
const MONTHLY_PRICE_ID = "price_1Seb3410kaiKolWDTx7PBUHX";
const LIFETIME_PRICE_ID = "price_1Seb3c10kaiKolWDgapGcOyZ";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!stripeKey || !webhookSecret || !supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing environment variables");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Get the raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      throw new Error("No Stripe signature found");
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      logStep("Webhook signature verification failed", { error: err });
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("Event verified", { type: event.type, id: event.id });

    // Check idempotency - have we already processed this event?
    const { data: existingEvent } = await supabase
      .from('billing_events')
      .select('id')
      .eq('stripe_event_id', event.id)
      .maybeSingle();

    if (existingEvent) {
      logStep("Event already processed, skipping", { eventId: event.id });
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Helper function to find user by email
    const findUserByEmail = async (email: string) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .maybeSingle();
      
      if (error) logStep("Error finding user", { error: error.message });
      return data;
    };

    // Helper function to find user by stripe_customer_id
    const findUserByCustomerId = async (customerId: string) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('stripe_customer_id', customerId)
        .maybeSingle();
      
      if (error) logStep("Error finding user by customer ID", { error: error.message });
      return data;
    };

    // Helper function to get customer email from Stripe
    const getCustomerEmail = async (customerId: string): Promise<string | null> => {
      try {
        const customer = await stripe.customers.retrieve(customerId);
        if (customer.deleted) return null;
        return (customer as Stripe.Customer).email || null;
      } catch {
        return null;
      }
    };

    // Helper to check if user should be protected from downgrades
    const isProtectedUser = async (userId: string): Promise<boolean> => {
      // Check if user has admin/owner role
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      
      const isAdminOrOwner = roles?.some(r => r.role === 'admin' || r.role === 'owner') || false;
      return isAdminOrOwner;
    };

    // Helper to update profile with idempotency check
    const updateProfile = async (
      userId: string, 
      updates: Record<string, any>,
      eventTimestamp: number
    ) => {
      // Get current profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('last_stripe_event_at, plan_status, comped_access')
        .eq('id', userId)
        .maybeSingle();

      if (!profile) {
        logStep("Profile not found", { userId });
        return false;
      }

      // Check if this event is older than the last processed event
      if (profile.last_stripe_event_at) {
        const lastEventTime = new Date(profile.last_stripe_event_at).getTime();
        const thisEventTime = eventTimestamp * 1000;
        if (thisEventTime < lastEventTime) {
          logStep("Skipping older event", { userId, thisEventTime, lastEventTime });
          return false;
        }
      }

      // If user is comped, don't downgrade their plan_status but still store Stripe data
      if (profile.comped_access && updates.plan_status && 
          ['free', 'expired'].includes(updates.plan_status)) {
        logStep("User is comped, not downgrading plan_status", { userId });
        delete updates.plan_status;
      }

      // If downgrading and user is protected, skip plan_status change
      if (updates.plan_status && ['free', 'expired'].includes(updates.plan_status)) {
        const isProtected = await isProtectedUser(userId);
        if (isProtected) {
          logStep("Protected user, not downgrading plan_status", { userId });
          delete updates.plan_status;
        }
      }

      // Add timestamp
      updates.last_stripe_event_at = new Date(eventTimestamp * 1000).toISOString();

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);

      if (error) {
        logStep("Error updating profile", { userId, error: error.message });
        return false;
      }

      logStep("Profile updated", { userId, updates });
      return true;
    };

    // Process different event types
    let userId: string | null = null;

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        
        // Find user
        let user = await findUserByCustomerId(customerId);
        if (!user) {
          const email = await getCustomerEmail(customerId);
          if (email) {
            user = await findUserByEmail(email);
          }
        }

        if (!user) {
          logStep("User not found for subscription", { customerId });
          break;
        }

        userId = user.id;
        const priceId = subscription.items.data[0]?.price?.id;
        const status = subscription.status;

        let planStatus = user.plan_status;

        // Determine plan_status based on subscription status
        if (status === "active" || status === "trialing") {
          // Check if it's the monthly price
          if (priceId === MONTHLY_PRICE_ID) {
            planStatus = "monthly";
          }
        } else if (["canceled", "unpaid", "past_due", "incomplete_expired"].includes(status)) {
          planStatus = "expired";
        }

        if (userId) {
          await updateProfile(userId, {
            stripe_customer_id: customerId,
            stripe_subscription_id: subscription.id,
            stripe_price_id: priceId,
            stripe_status: status,
            stripe_current_period_end: subscription.current_period_end 
              ? new Date(subscription.current_period_end * 1000).toISOString() 
              : null,
            plan_status: planStatus,
          }, event.created);
        }

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        let user = await findUserByCustomerId(customerId);
        if (!user) {
          const email = await getCustomerEmail(customerId);
          if (email) {
            user = await findUserByEmail(email);
          }
        }

        if (!user) {
          logStep("User not found for deleted subscription", { customerId });
          break;
        }

        userId = user.id;

        // Only downgrade if not lifetime
        if (user.plan_status !== "lifetime" && userId) {
          await updateProfile(userId, {
            stripe_status: "canceled",
            plan_status: "expired",
          }, event.created);
        }

        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const customerEmail = session.customer_email || session.customer_details?.email;

        // Find user
        let user = await findUserByCustomerId(customerId);
        if (!user && customerEmail) {
          user = await findUserByEmail(customerEmail);
        }

        if (!user) {
          logStep("User not found for checkout session", { customerId, customerEmail });
          break;
        }

        userId = user.id;

        // Check if this is a lifetime purchase (one-time payment)
        if (session.mode === "payment") {
          const priceType = session.metadata?.price_type;
          
          if ((priceType === "lifetime" || session.amount_total === 19999) && userId) {
            await updateProfile(userId, {
              stripe_customer_id: customerId,
              plan_status: "lifetime",
              early_supporter: true,
            }, event.created);
          }
        }

        // For subscription checkouts, the subscription.created event will handle it
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        let user = await findUserByCustomerId(customerId);
        if (!user) {
          const email = await getCustomerEmail(customerId);
          if (email) {
            user = await findUserByEmail(email);
          }
        }

        if (user) {
          userId = user.id;
          // Payment succeeded - subscription events will handle plan_status
          logStep("Payment succeeded for user", { userId, amount: invoice.amount_paid });
        }

        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        let user = await findUserByCustomerId(customerId);
        if (!user) {
          const email = await getCustomerEmail(customerId);
          if (email) {
            user = await findUserByEmail(email);
          }
        }

        if (user && user.plan_status !== "lifetime") {
          userId = user.id;
          logStep("Payment failed for user", { userId });
          // Don't immediately downgrade - Stripe will retry
          // The subscription.updated event will handle status changes
        }

        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    // Log the event for audit
    await supabase.from('billing_events').insert({
      user_id: userId,
      event_type: event.type,
      stripe_event_id: event.id,
      payload: event.data.object,
    });

    return new Response(JSON.stringify({ received: true }), {
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
