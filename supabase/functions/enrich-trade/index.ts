import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FINNHUB_API_KEY = Deno.env.get("FINNHUB_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

interface Trade {
  id: string;
  user_id: string;
  ticker: string;
  entry_date: string;
  entry_time?: string;
  exit_date?: string;
  exit_time?: string;
  entry_price: number;
  exit_price?: number;
  entry_datetime?: string;
  exit_datetime?: string;
  trade_type: string;
}

interface Candle {
  c: number[]; // close
  h: number[]; // high
  l: number[]; // low
  o: number[]; // open
  t: number[]; // timestamp
  v: number[]; // volume
  s: string;   // status
}

interface NewsItem {
  headline: string;
  source: string;
  url: string;
  datetime: number;
}

async function fetchDailyCandles(ticker: string, fromDate: Date, toDate: Date): Promise<Candle | null> {
  const from = Math.floor(fromDate.getTime() / 1000);
  const to = Math.floor(toDate.getTime() / 1000);
  
  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/stock/candle?symbol=${ticker}&resolution=D&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`
    );
    const data = await response.json();
    if (data.s === "ok") {
      return data;
    }
    console.log(`No candle data for ${ticker}: ${data.s}`);
    return null;
  } catch (error) {
    console.error(`Error fetching candles for ${ticker}:`, error);
    return null;
  }
}

async function fetchIntradayCandles(ticker: string, fromDate: Date, toDate: Date): Promise<Candle | null> {
  const from = Math.floor(fromDate.getTime() / 1000);
  const to = Math.floor(toDate.getTime() / 1000);
  
  try {
    // Use 5-minute candles for MVP
    const response = await fetch(
      `https://finnhub.io/api/v1/stock/candle?symbol=${ticker}&resolution=5&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`
    );
    const data = await response.json();
    if (data.s === "ok") {
      return data;
    }
    console.log(`No intraday data for ${ticker}: ${data.s}`);
    return null;
  } catch (error) {
    console.error(`Error fetching intraday candles for ${ticker}:`, error);
    return null;
  }
}

async function fetchNews(ticker: string, fromDate: Date, toDate: Date): Promise<NewsItem[]> {
  const from = fromDate.toISOString().split("T")[0];
  const to = toDate.toISOString().split("T")[0];
  
  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`
    );
    const data = await response.json();
    if (Array.isArray(data)) {
      // Return top 3 news items
      return data.slice(0, 3).map((item: any) => ({
        headline: item.headline,
        source: item.source,
        url: item.url,
        datetime: item.datetime,
      }));
    }
    return [];
  } catch (error) {
    console.error(`Error fetching news for ${ticker}:`, error);
    return [];
  }
}

async function fetchEarningsCalendar(ticker: string, fromDate: Date): Promise<number | null> {
  const from = fromDate.toISOString().split("T")[0];
  const to = new Date(fromDate.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  
  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/calendar/earnings?symbol=${ticker}&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`
    );
    const data = await response.json();
    if (data.earningsCalendar && data.earningsCalendar.length > 0) {
      const nextEarnings = data.earningsCalendar[0];
      const earningsDate = new Date(nextEarnings.date);
      const daysUntil = Math.ceil((earningsDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntil >= 0 ? daysUntil : null;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching earnings for ${ticker}:`, error);
    return null;
  }
}

function calculateSMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calculateMFEMAE(
  candles: Candle,
  entryPrice: number,
  entryTimestamp: number,
  exitTimestamp: number,
  isLong: boolean
): { mfe: number; mae: number; mfe_pct: number; mae_pct: number } {
  let maxFavorable = 0;
  let maxAdverse = 0;

  for (let i = 0; i < candles.t.length; i++) {
    const timestamp = candles.t[i] * 1000;
    if (timestamp < entryTimestamp || timestamp > exitTimestamp) continue;

    const high = candles.h[i];
    const low = candles.l[i];

    if (isLong) {
      const favorable = high - entryPrice;
      const adverse = entryPrice - low;
      maxFavorable = Math.max(maxFavorable, favorable);
      maxAdverse = Math.max(maxAdverse, adverse);
    } else {
      const favorable = entryPrice - low;
      const adverse = high - entryPrice;
      maxFavorable = Math.max(maxFavorable, favorable);
      maxAdverse = Math.max(maxAdverse, adverse);
    }
  }

  return {
    mfe: maxFavorable,
    mae: maxAdverse,
    mfe_pct: entryPrice > 0 ? (maxFavorable / entryPrice) * 100 : 0,
    mae_pct: entryPrice > 0 ? (maxAdverse / entryPrice) * 100 : 0,
  };
}

function determineTrendRegime(underlyingPrice: number, sma50: number | null): string | null {
  if (sma50 === null || sma50 === 0) return null;
  const distancePercent = ((underlyingPrice - sma50) / sma50) * 100;
  if (distancePercent > 0.5) return "bull";
  if (distancePercent < -0.5) return "bear";
  return "neutral";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { trade_id } = await req.json();

    if (!trade_id) {
      return new Response(
        JSON.stringify({ error: "trade_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!FINNHUB_API_KEY) {
      console.error("FINNHUB_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Finnhub API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get the authorization header to verify user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ ok: false, error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    
    const isAdmin = userRole?.role === "admin";

    // Fetch the trade
    const { data: trade, error: tradeError } = await supabase
      .from("trades")
      .select("*")
      .eq("id", trade_id)
      .single();

    if (tradeError || !trade) {
      console.error("Trade not found:", tradeError);
      return new Response(
        JSON.stringify({ ok: false, error: "Trade not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify ownership OR admin access
    if (trade.user_id !== user.id && !isAdmin) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limiting: Check if enrichment was done in the last 60 seconds
    const { data: existingEnrichment } = await supabase
      .from("trade_enrichment")
      .select("updated_at")
      .eq("trade_id", trade_id)
      .maybeSingle();

    if (existingEnrichment?.updated_at) {
      const lastUpdated = new Date(existingEnrichment.updated_at);
      const secondsSinceUpdate = (Date.now() - lastUpdated.getTime()) / 1000;
      if (secondsSinceUpdate < 60 && !isAdmin) {
        return new Response(
          JSON.stringify({ 
            ok: false, 
            error: "Rate limited. Please wait before re-enriching this trade.",
            retry_after: Math.ceil(60 - secondsSinceUpdate)
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log(`Enriching trade ${trade_id} for ticker ${trade.ticker}`);

    // Compute entry/exit datetimes if not present
    const entryDatetime = trade.entry_datetime 
      ? new Date(trade.entry_datetime)
      : new Date(`${trade.entry_date}T${trade.entry_time || "09:30:00"}`);
    
    const exitDatetime = trade.exit_date
      ? (trade.exit_datetime 
          ? new Date(trade.exit_datetime)
          : new Date(`${trade.exit_date}T${trade.exit_time || "16:00:00"}`))
      : null;

    // Determine underlying ticker (for options, strip to base symbol)
    const underlyingTicker = trade.ticker.replace(/[^A-Z]/g, '').toUpperCase();

    // =============================================
    // FIX: Fetch 120+ calendar days of daily candles for SMA50 calculation
    // We need at least 50 valid closes BEFORE entry date
    // =============================================
    const lookbackDays = 120; // Enough to get 50+ trading days
    const lookbackStart = new Date(entryDatetime.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
    
    // Fetch daily candles from lookbackStart to entry_date (inclusive)
    const dailyCandles = await fetchDailyCandles(underlyingTicker, lookbackStart, entryDatetime);
    
    let sma20: number | null = null;
    let sma50: number | null = null;
    let underlyingEntryPrice: number | null = null;
    let aboveSMA20: boolean | null = null;
    let aboveSMA50: boolean | null = null;
    let trendRegime: string | null = null;
    
    if (dailyCandles && dailyCandles.c && dailyCandles.c.length > 0) {
      // Find candles BEFORE the entry date (for SMA calculation)
      // The last candle should be entry date or closest trading day before
      const entryDateStr = entryDatetime.toISOString().split('T')[0];
      const entryEpoch = Math.floor(new Date(entryDateStr + 'T00:00:00Z').getTime() / 1000);
      
      // Find closes BEFORE entry date for SMA calculation
      const closesBeforeEntry: number[] = [];
      let closestCloseToEntry: number | null = null;
      
      for (let i = 0; i < dailyCandles.t.length; i++) {
        const candleDate = dailyCandles.t[i];
        if (candleDate < entryEpoch) {
          closesBeforeEntry.push(dailyCandles.c[i]);
        }
        // Also track the closest close on or before entry for underlying price
        if (candleDate <= entryEpoch + 86400) { // within 1 day
          closestCloseToEntry = dailyCandles.c[i];
        }
      }
      
      console.log(`Found ${closesBeforeEntry.length} daily closes before entry date for ${underlyingTicker}`);
      
      // Use the last 50 closes before entry for SMA50
      if (closesBeforeEntry.length >= 50) {
        const last50 = closesBeforeEntry.slice(-50);
        sma50 = last50.reduce((a, b) => a + b, 0) / 50;
        console.log(`SMA50 calculated: ${sma50.toFixed(2)}`);
      } else {
        console.log(`Not enough closes for SMA50: ${closesBeforeEntry.length}/50`);
      }
      
      // Use the last 20 closes before entry for SMA20
      if (closesBeforeEntry.length >= 20) {
        const last20 = closesBeforeEntry.slice(-20);
        sma20 = last20.reduce((a, b) => a + b, 0) / 20;
        console.log(`SMA20 calculated: ${sma20.toFixed(2)}`);
      }
      
      // Use closest close as underlying entry price
      underlyingEntryPrice = closestCloseToEntry;
      console.log(`Underlying entry price: ${underlyingEntryPrice}`);
      
      // Calculate above/below SMA and trend regime
      if (underlyingEntryPrice !== null) {
        if (sma20 !== null) {
          aboveSMA20 = underlyingEntryPrice > sma20;
        }
        if (sma50 !== null) {
          aboveSMA50 = underlyingEntryPrice > sma50;
          trendRegime = determineTrendRegime(underlyingEntryPrice, sma50);
        }
      }
    } else {
      console.log(`No daily candles found for ${underlyingTicker}`);
    }

    // Calculate MFE/MAE if trade is closed
    let mfe = null, mae = null, mfe_pct = null, mae_pct = null;
    
    if (exitDatetime && trade.entry_price) {
      // Determine if long or short based on trade_type
      const isLong = trade.trade_type === "call" || trade.trade_type === "stock";
      
      // Fetch intraday candles for MFE/MAE
      const intradayCandles = await fetchIntradayCandles(underlyingTicker, entryDatetime, exitDatetime);
      
      if (intradayCandles) {
        const mfeMAE = calculateMFEMAE(
          intradayCandles,
          trade.entry_price,
          entryDatetime.getTime(),
          exitDatetime.getTime(),
          isLong
        );
        mfe = mfeMAE.mfe;
        mae = mfeMAE.mae;
        mfe_pct = mfeMAE.mfe_pct;
        mae_pct = mfeMAE.mae_pct;
      }
    }

    // Fetch news around entry date
    const newsFrom = new Date(entryDatetime.getTime() - 3 * 24 * 60 * 60 * 1000);
    const newsTo = new Date(entryDatetime.getTime() + 1 * 24 * 60 * 60 * 1000);
    const news = await fetchNews(underlyingTicker, newsFrom, newsTo);

    // Fetch earnings calendar
    const earningsInDays = await fetchEarningsCalendar(underlyingTicker, entryDatetime);

    // Upsert enrichment data
    const enrichmentData = {
      user_id: user.id,
      trade_id: trade_id,
      ticker: trade.ticker,
      entry_datetime: entryDatetime.toISOString(),
      exit_datetime: exitDatetime?.toISOString() || null,
      mfe,
      mae,
      mfe_pct,
      mae_pct,
      sma20_entry: sma20,
      sma50_entry: sma50,
      above_sma20_entry: aboveSMA20,
      above_sma50_entry: aboveSMA50,
      trend_regime_entry: trendRegime, // Will be null if SMA50 couldn't be computed
      earnings_in_days: earningsInDays,
      news,
      updated_at: new Date().toISOString(),
    };

    console.log(`Enrichment data: sma50=${sma50}, above_sma50=${aboveSMA50}, trend=${trendRegime}`);

    const { data: enrichment, error: upsertError } = await supabase
      .from("trade_enrichment")
      .upsert(enrichmentData, { onConflict: "trade_id" })
      .select()
      .single();

    if (upsertError) {
      console.error("Error upserting enrichment:", upsertError);
      return new Response(
        JSON.stringify({ error: "Failed to save enrichment data" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update trade with datetime columns if not set
    if (!trade.entry_datetime || !trade.exit_datetime) {
      await supabase
        .from("trades")
        .update({
          entry_datetime: entryDatetime.toISOString(),
          exit_datetime: exitDatetime?.toISOString() || null,
        })
        .eq("id", trade_id);
    }

    console.log(`Successfully enriched trade ${trade_id}`);

    return new Response(
      JSON.stringify({ ok: true, enrichment }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in enrich-trade:", error);
    return new Response(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
