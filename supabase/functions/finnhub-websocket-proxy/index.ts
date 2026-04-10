import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[FINNHUB-WS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const apiKey = Deno.env.get("FINNHUB_API_KEY");
    
    // Check if API key is configured
    if (!apiKey || apiKey.trim() === '') {
      logStep("ERROR: FINNHUB_API_KEY is not configured or empty");
      return new Response(
        JSON.stringify({ 
          error: "FINNHUB_API_KEY is not configured",
          code: "MISSING_API_KEY",
          message: "Please add FINNHUB_API_KEY to your Supabase Edge Function secrets"
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 503 // Service Unavailable - indicates the service needs configuration
        }
      );
    }

    const { action } = await req.json();
    logStep("Request received", { action });

    if (action === "get-url") {
      // Return the WebSocket URL with the API key embedded
      // Note: Finnhub free tier has limitations (30 symbols, US stocks only)
      const wsUrl = `wss://ws.finnhub.io?token=${apiKey}`;
      
      logStep("Returning WebSocket URL");
      return new Response(
        JSON.stringify({ 
          url: wsUrl,
          status: "ok"
        }),
        { 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate"
          } 
        }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});
