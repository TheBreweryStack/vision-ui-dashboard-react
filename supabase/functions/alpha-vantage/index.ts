import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ALPHA-VANTAGE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Validate authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      logStep("No auth header");
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
      logStep("Auth error", { message: authError?.message || 'No user' });
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Authenticated user", { userId: user.id });
    
    const apiKey = Deno.env.get("ALPHA_VANTAGE_API_KEY");
    if (!apiKey) throw new Error("ALPHA_VANTAGE_API_KEY is not configured");

    const { action, symbols } = await req.json();
    logStep("Request received", { action, symbols });

    // Validate symbols array to prevent abuse
    if (symbols && Array.isArray(symbols) && symbols.length > 20) {
      throw new Error("Maximum 20 symbols allowed per request");
    }

    // Validate symbol format if provided
    if (symbols && Array.isArray(symbols)) {
      for (const symbol of symbols) {
        if (typeof symbol !== 'string' || symbol.length > 10 || !/^[A-Za-z0-9.^-]+$/.test(symbol)) {
          throw new Error(`Invalid symbol format: ${symbol}`);
        }
      }
    }

    const baseUrl = "https://www.alphavantage.co/query";

    if (action === "quotes") {
      // Fetch quotes for multiple symbols
      const quotes: Record<string, unknown> = {};
      
      for (const symbol of symbols || []) {
        try {
          const url = `${baseUrl}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
          const response = await fetch(url);
          const data = await response.json();
          
          if (data["Global Quote"]) {
            const q = data["Global Quote"];
            quotes[symbol] = {
              symbol: q["01. symbol"],
              price: parseFloat(q["05. price"]) || 0,
              change: parseFloat(q["09. change"]) || 0,
              changePercent: parseFloat(q["10. change percent"]?.replace("%", "")) || 0,
              volume: parseInt(q["06. volume"]) || 0,
              high: parseFloat(q["03. high"]) || 0,
              low: parseFloat(q["04. low"]) || 0,
              open: parseFloat(q["02. open"]) || 0,
              previousClose: parseFloat(q["08. previous close"]) || 0,
            };
          }
        } catch (err) {
          logStep(`Error fetching quote for ${symbol}`, err);
        }
      }

      logStep("Quotes fetched", { count: Object.keys(quotes).length });
      return new Response(JSON.stringify({ quotes }), {
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache"
        },
      });
    }

    if (action === "news") {
      // Fetch market news
      const tickers = symbols?.map((s: string) => encodeURIComponent(s)).join(",") || "";
      const url = `${baseUrl}?function=NEWS_SENTIMENT${tickers ? `&tickers=${tickers}` : ""}&apikey=${apiKey}&limit=10`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      const news = (data.feed || []).slice(0, 10).map((item: Record<string, unknown>) => ({
        title: item.title,
        url: item.url,
        source: item.source,
        summary: item.summary,
        publishedAt: item.time_published,
        sentiment: item.overall_sentiment_label,
        sentimentScore: item.overall_sentiment_score,
        image: item.banner_image,
      }));

      logStep("News fetched", { count: news.length });
      return new Response(JSON.stringify({ news }), {
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache"
        },
      });
    }

    if (action === "overview") {
      // Fetch company overview
      const symbol = symbols?.[0];
      if (!symbol) throw new Error("Symbol required for overview");
      
      const url = `${baseUrl}?function=OVERVIEW&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
      const response = await fetch(url);
      const data = await response.json();
      
      const overview = {
        symbol: data.Symbol,
        name: data.Name,
        description: data.Description,
        sector: data.Sector,
        industry: data.Industry,
        marketCap: data.MarketCapitalization,
        peRatio: data.PERatio,
        eps: data.EPS,
        dividendYield: data.DividendYield,
        fiftyTwoWeekHigh: data["52WeekHigh"],
        fiftyTwoWeekLow: data["52WeekLow"],
        avgVolume: data.AverageVolume,
        beta: data.Beta,
      };

      logStep("Overview fetched", { symbol });
      return new Response(JSON.stringify({ overview }), {
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache"
        },
      });
    }

    if (action === "options") {
      // Fetch options chain (Premium API - may return limited data on free tier)
      const symbol = symbols?.[0];
      if (!symbol) throw new Error("Symbol required for options chain");
      
      const { date } = await req.json().catch(() => ({}));
      
      // Try REALTIME_OPTIONS first
      let url = `${baseUrl}?function=REALTIME_OPTIONS&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
      if (date) {
        url += `&date=${encodeURIComponent(date)}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      // Check for API limit message
      if (data.Information || data.Note) {
        logStep("Options API limit or premium required", { message: data.Information || data.Note });
        return new Response(JSON.stringify({ 
          options: null, 
          error: "Options data requires Alpha Vantage premium subscription",
          message: data.Information || data.Note 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Parse options data
      const optionsChain = {
        symbol: symbol,
        expirations: [] as string[],
        calls: [] as any[],
        puts: [] as any[],
      };
      
      if (data.data) {
        // Extract unique expiration dates
        const expirations = new Set<string>();
        
        for (const option of data.data) {
          expirations.add(option.expiration);
          
          const optionData = {
            contractID: option.contractID,
            symbol: option.symbol,
            expiration: option.expiration,
            strike: parseFloat(option.strike) || 0,
            type: option.type,
            last: parseFloat(option.last) || 0,
            mark: parseFloat(option.mark) || 0,
            bid: parseFloat(option.bid) || 0,
            ask: parseFloat(option.ask) || 0,
            volume: parseInt(option.volume) || 0,
            openInterest: parseInt(option.open_interest) || 0,
            impliedVolatility: parseFloat(option.implied_volatility) || 0,
            delta: parseFloat(option.delta) || 0,
            gamma: parseFloat(option.gamma) || 0,
            theta: parseFloat(option.theta) || 0,
            vega: parseFloat(option.vega) || 0,
            inTheMoney: option.in_the_money === "TRUE",
          };
          
          if (option.type === "call") {
            optionsChain.calls.push(optionData);
          } else {
            optionsChain.puts.push(optionData);
          }
        }
        
        optionsChain.expirations = Array.from(expirations).sort();
      }

      logStep("Options fetched", { symbol, calls: optionsChain.calls.length, puts: optionsChain.puts.length });
      return new Response(JSON.stringify({ options: optionsChain }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "historical_options") {
      // Fetch historical options data
      const symbol = symbols?.[0];
      if (!symbol) throw new Error("Symbol required for historical options");
      
      const { date } = await req.json().catch(() => ({}));
      
      const url = `${baseUrl}?function=HISTORICAL_OPTIONS&symbol=${encodeURIComponent(symbol)}${date ? `&date=${encodeURIComponent(date)}` : ""}&apikey=${apiKey}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.Information || data.Note) {
        logStep("Historical options API limit", { message: data.Information || data.Note });
        return new Response(JSON.stringify({ 
          options: null,
          error: "Historical options data requires Alpha Vantage premium subscription" 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      logStep("Historical options fetched", { symbol });
      return new Response(JSON.stringify({ options: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
