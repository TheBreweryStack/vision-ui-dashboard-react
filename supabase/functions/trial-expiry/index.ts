import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[TRIAL-EXPIRY] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Find all profiles where plan_status = 'trial' and trial_ends_at < now()
    const now = new Date().toISOString();
    
    const { data: expiredTrials, error: fetchError } = await supabase
      .from('profiles')
      .select('id, email, trial_ends_at, plan_status')
      .eq('plan_status', 'trial')
      .lt('trial_ends_at', now);

    if (fetchError) {
      throw new Error(`Error fetching expired trials: ${fetchError.message}`);
    }

    logStep("Found expired trials", { count: expiredTrials?.length || 0 });

    let updatedCount = 0;

    if (expiredTrials && expiredTrials.length > 0) {
      // Update each expired trial to 'free'
      for (const profile of expiredTrials) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            plan_status: 'free',
            // Keep trial_ends_at for history
          })
          .eq('id', profile.id);

        if (updateError) {
          logStep("Error updating profile", { id: profile.id, error: updateError.message });
        } else {
          updatedCount++;
          logStep("Updated profile to free", { id: profile.id, email: profile.email });
        }
      }
    }

    const result = {
      scanned: expiredTrials?.length || 0,
      updated: updatedCount,
      timestamp: now,
    };

    logStep("Completed", result);

    return new Response(JSON.stringify(result), {
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
