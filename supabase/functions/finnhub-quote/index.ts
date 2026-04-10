import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
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
      console.log('[FINNHUB-QUOTE] Auth error:', authError?.message || 'No user');
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('[FINNHUB-QUOTE] Authenticated user:', user.id);

    const FINNHUB_API_KEY = Deno.env.get("FINNHUB_API_KEY");
    if (!FINNHUB_API_KEY) {
      throw new Error("FINNHUB_API_KEY not configured");
    }

    const { symbols, type = "quote" } = await req.json();

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      throw new Error("symbols array is required");
    }

    // Validate symbols array to prevent abuse
    if (symbols.length > 20) {
      throw new Error("Maximum 20 symbols allowed per request");
    }

    const results: Record<string, any> = {};

    // Fetch data for each symbol
    await Promise.all(
      symbols.map(async (symbol: string) => {
        // Validate symbol format
        if (typeof symbol !== 'string' || symbol.length > 10 || !/^[A-Za-z0-9.^-]+$/.test(symbol)) {
          results[symbol] = { error: "Invalid symbol format" };
          return;
        }

        try {
          if (type === "quote") {
            // Get real-time quote
            const quoteRes = await fetch(
              `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`
            );
            const quoteData = await quoteRes.json();
            
            results[symbol] = {
              price: quoteData.c,
              change: quoteData.d,
              changePercent: quoteData.dp,
              high: quoteData.h,
              low: quoteData.l,
              open: quoteData.o,
              previousClose: quoteData.pc,
            };
          } else if (type === "profile") {
            // Get company profile
            const profileRes = await fetch(
              `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`
            );
            const profileData = await profileRes.json();
            
            results[symbol] = {
              name: profileData.name,
              logo: profileData.logo,
              industry: profileData.finnhubIndustry,
              marketCap: profileData.marketCapitalization,
              exchange: profileData.exchange,
              weburl: profileData.weburl,
            };
          } else if (type === "news") {
            // Get company news
            const toDate = new Date().toISOString().split('T')[0];
            const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            
            const newsRes = await fetch(
              `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${fromDate}&to=${toDate}&token=${FINNHUB_API_KEY}`
            );
            const newsData = await newsRes.json();
            
            results[symbol] = newsData.slice(0, 5); // Limit to 5 news items
          }
        } catch (error) {
          console.error(`Error fetching data for ${symbol}:`, error);
          results[symbol] = { error: "Failed to fetch data" };
        }
      })
    );

    return new Response(JSON.stringify({ data: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Finnhub API error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
