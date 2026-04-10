import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALPHA_VANTAGE_API_KEY = Deno.env.get('ALPHA_VANTAGE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Major tickers to fetch news for
const TICKERS = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'JPM'];

// Parse Alpha Vantage date format (20231215T143000)
function parseAlphaVantageDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  
  const match = dateStr.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
  if (!match) return new Date().toISOString();
  
  const [, year, month, day, hour, min, sec] = match;
  return new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}Z`).toISOString();
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!ALPHA_VANTAGE_API_KEY) {
      throw new Error('Alpha Vantage API key not configured');
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log('Starting market news fetch for tickers:', TICKERS.join(', '));

    let totalInserted = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    // Fetch news for each ticker (with rate limiting)
    for (const ticker of TICKERS) {
      try {
        console.log(`Fetching news for ${ticker}...`);
        
        const response = await fetch(
          `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${ticker}&limit=10&apikey=${ALPHA_VANTAGE_API_KEY}`
        );

        if (!response.ok) {
          console.error(`Alpha Vantage API error for ${ticker}: ${response.status}`);
          totalErrors++;
          continue;
        }

        const data = await response.json();

        if (data.Information) {
          console.warn(`Alpha Vantage rate limit or issue: ${data.Information}`);
          break; // Stop if rate limited
        }

        const newsItems = data.feed || [];
        console.log(`Found ${newsItems.length} news items for ${ticker}`);

        for (const item of newsItems) {
          try {
            // Extract ticker sentiment
            const tickerSentiments = item.ticker_sentiment || [];
            const tickers = tickerSentiments.map((t: any) => t.ticker);

            // Upsert to avoid duplicates (using URL as unique key)
            const { error } = await supabase
              .from('market_news')
              .upsert({
                title: item.title || 'Untitled',
                summary: item.summary || null,
                url: item.url,
                source: item.source || null,
                image_url: item.banner_image || null,
                published_at: parseAlphaVantageDate(item.time_published),
                sentiment: item.overall_sentiment_label || null,
                sentiment_score: item.overall_sentiment_score ? parseFloat(item.overall_sentiment_score) : null,
                ticker: ticker,
                tickers: tickers.length > 0 ? tickers : [ticker],
              }, { 
                onConflict: 'url',
                ignoreDuplicates: true
              });

            if (error) {
              console.error(`Error upserting news item: ${error.message}`);
              totalErrors++;
            } else {
              totalInserted++;
            }
          } catch (itemError) {
            console.error(`Error processing news item: ${itemError}`);
            totalErrors++;
          }
        }

        // Rate limit: wait 1 second between API calls
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (tickerError) {
        console.error(`Error fetching news for ${ticker}: ${tickerError}`);
        totalErrors++;
      }
    }

    console.log(`News fetch complete. Inserted: ${totalInserted}, Errors: ${totalErrors}`);

    return new Response(
      JSON.stringify({
        success: true,
        inserted: totalInserted,
        errors: totalErrors,
        tickers: TICKERS,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Market news fetch error:', errorMessage);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});