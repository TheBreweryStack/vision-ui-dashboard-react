import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Alert {
  id: string;
  user_id: string;
  alert_type: string;
  threshold: number | null;
  target_value: number | null;
  is_active: boolean;
  triggered_at: string | null;
  watchlist_items: {
    ticker: string;
  } | null;
}

interface Quote {
  c: number;  // Current price
  d: number;  // Change
  dp: number; // Percent change
  h: number;  // High
  l: number;  // Low
  o: number;  // Open
  pc: number; // Previous close
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const finnhubApiKey = Deno.env.get("FINNHUB_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[check-price-alerts] Starting price alert check...");

    // Fetch all active, untriggered alerts (price and percent types)
    const { data: alerts, error: alertsError } = await supabase
      .from("alerts")
      .select("*, watchlist_items(ticker)")
      .eq("is_active", true)
      .is("triggered_at", null)
      .in("alert_type", ["price_above", "price_below", "percent_up", "percent_down"]);

    if (alertsError) {
      console.error("[check-price-alerts] Error fetching alerts:", alertsError);
      throw alertsError;
    }

    if (!alerts || alerts.length === 0) {
      console.log("[check-price-alerts] No active alerts to check");
      return new Response(
        JSON.stringify({ success: true, checked: 0, triggered: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[check-price-alerts] Found ${alerts.length} active alerts`);

    // Group alerts by ticker to minimize API calls
    const tickerAlerts: Record<string, Alert[]> = {};
    for (const alert of alerts as Alert[]) {
      const ticker = alert.watchlist_items?.ticker;
      if (ticker) {
        if (!tickerAlerts[ticker]) {
          tickerAlerts[ticker] = [];
        }
        tickerAlerts[ticker].push(alert);
      }
    }

    const tickers = Object.keys(tickerAlerts);
    console.log(`[check-price-alerts] Checking prices for ${tickers.length} unique tickers`);

    let triggeredCount = 0;

    // Check each ticker's price
    for (const ticker of tickers) {
      try {
        // Fetch current price from Finnhub
        const response = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${finnhubApiKey}`
        );

        if (!response.ok) {
          console.error(`[check-price-alerts] Failed to fetch price for ${ticker}`);
          continue;
        }

        const quote: Quote = await response.json();
        const currentPrice = quote.c; // Current price
        const percentChange = quote.dp; // Percent change from previous close

        if (!currentPrice || currentPrice === 0) {
          console.log(`[check-price-alerts] No valid price for ${ticker}`);
          continue;
        }

        console.log(`[check-price-alerts] ${ticker} price: $${currentPrice}, change: ${percentChange}%`);

        // Check each alert for this ticker
        for (const alert of tickerAlerts[ticker]) {
          let shouldTrigger = false;
          let message = "";

          const targetValue = alert.target_value;
          const threshold = alert.threshold;

          // Price alerts use target_value
          if (alert.alert_type === "price_above" && targetValue && currentPrice >= targetValue) {
            shouldTrigger = true;
            message = `${ticker} is now above $${targetValue} (current: $${currentPrice.toFixed(2)})`;
            console.log(`[check-price-alerts] ${ticker} hit price_above target: $${targetValue}`);
          } else if (alert.alert_type === "price_below" && targetValue && currentPrice <= targetValue) {
            shouldTrigger = true;
            message = `${ticker} is now below $${targetValue} (current: $${currentPrice.toFixed(2)})`;
            console.log(`[check-price-alerts] ${ticker} hit price_below target: $${targetValue}`);
          }
          // Percent alerts use threshold
          else if (alert.alert_type === "percent_up" && threshold && percentChange >= threshold) {
            shouldTrigger = true;
            message = `${ticker} is up ${percentChange.toFixed(2)}% today (target: ${threshold}%)`;
            console.log(`[check-price-alerts] ${ticker} hit percent_up threshold: ${threshold}%`);
          } else if (alert.alert_type === "percent_down" && threshold && percentChange <= -threshold) {
            shouldTrigger = true;
            message = `${ticker} is down ${Math.abs(percentChange).toFixed(2)}% today (target: ${threshold}%)`;
            console.log(`[check-price-alerts] ${ticker} hit percent_down threshold: ${threshold}%`);
          }

          if (shouldTrigger) {
            // Update triggered_at
            const { error: updateError } = await supabase
              .from("alerts")
              .update({ triggered_at: new Date().toISOString() })
              .eq("id", alert.id);

            if (updateError) {
              console.error(`[check-price-alerts] Failed to update alert ${alert.id}:`, updateError);
              continue;
            }

            // Insert into notifications table for in-app history
            try {
              const { error: notifError } = await supabase
                .from('notifications')
                .insert({
                  user_id: alert.user_id,
                  title: `Price Alert: ${ticker}`,
                  body: message,
                  type: 'price_alert',
                  data: {
                    alertId: alert.id,
                    ticker,
                    currentPrice,
                    percentChange,
                    threshold: alert.threshold,
                    targetValue: alert.target_value,
                    alertType: alert.alert_type,
                  },
                });

              if (notifError) {
                console.error(`[check-price-alerts] Failed to save notification for ${ticker}:`, notifError);
              } else {
                console.log(`[check-price-alerts] Notification saved for ${ticker}`);
              }
            } catch (notifErr) {
              console.error(`[check-price-alerts] Failed to save notification for ${ticker}:`, notifErr);
            }

            triggeredCount++;
          }
        }

        // Rate limit: 60 calls/minute for Finnhub free tier
        await new Promise((resolve) => setTimeout(resolve, 1100));
      } catch (tickerErr) {
        console.error(`[check-price-alerts] Error processing ${ticker}:`, tickerErr);
      }
    }

    console.log(`[check-price-alerts] Complete. Checked: ${alerts.length}, Triggered: ${triggeredCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        checked: alerts.length,
        triggered: triggeredCount,
        tickers: tickers.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[check-price-alerts] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
