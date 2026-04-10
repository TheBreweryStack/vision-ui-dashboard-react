import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log('[MARKET-OVERVIEW] Auth error:', authError?.message || 'No user');
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('[MARKET-OVERVIEW] Authenticated user:', user.id);

    const FINNHUB_API_KEY = Deno.env.get("FINNHUB_API_KEY");
    if (!FINNHUB_API_KEY) {
      throw new Error("FINNHUB_API_KEY not configured");
    }

    // Fetch market indices
    const indices = ["SPY", "QQQ", "DIA", "IWM", "VIX"];
    const quotes: Record<string, any> = {};

    await Promise.all(
      indices.map(async (symbol) => {
        try {
          const res = await fetch(
            `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`
          );
          const data = await res.json();
          quotes[symbol] = {
            price: data.c,
            change: data.d,
            changePercent: data.dp,
          };
        } catch (error) {
          console.error(`Error fetching ${symbol}:`, error);
        }
      })
    );

    // Get market news
    const newsRes = await fetch(
      `https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_API_KEY}`
    );
    const news = await newsRes.json();

    // Get market status
    const nyHour = new Date().toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false });
    const nyDay = new Date().toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short" });
    
    const hourNum = parseInt(nyHour);
    const isWeekend = nyDay === "Sat" || nyDay === "Sun";
    const isMarketHours = hourNum >= 9.5 && hourNum < 16;
    const isPreMarket = hourNum >= 4 && hourNum < 9.5;
    const isAfterHours = hourNum >= 16 && hourNum < 20;

    let marketStatus = "closed";
    if (!isWeekend) {
      if (isMarketHours) marketStatus = "open";
      else if (isPreMarket) marketStatus = "pre-market";
      else if (isAfterHours) marketStatus = "after-hours";
    }

    return new Response(
      JSON.stringify({
        indices: quotes,
        news: news.slice(0, 10),
        marketStatus,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Market overview error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
