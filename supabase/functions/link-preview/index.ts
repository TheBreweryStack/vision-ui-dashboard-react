import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching link preview for: ${url}`);

    // Fetch the URL with a timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }

    const html = await response.text();

    // Extract Open Graph metadata
    const getMetaContent = (property: string): string | null => {
      // Try og: prefix first
      let match = html.match(new RegExp(`<meta[^>]*property=["']og:${property}["'][^>]*content=["']([^"']+)["']`, 'i'));
      if (match) return match[1];
      
      // Try name attribute
      match = html.match(new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i'));
      if (match) return match[1];
      
      // Try reversed attribute order
      match = html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:${property}["']`, 'i'));
      if (match) return match[1];
      
      return null;
    };

    // Get title from og:title, twitter:title, or <title> tag
    let title = getMetaContent('title');
    if (!title) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      title = titleMatch ? titleMatch[1].trim() : null;
    }

    const description = getMetaContent('description');
    const image = getMetaContent('image');
    const siteName = getMetaContent('site_name');

    // Generate AI summary if we have content and the API key
    let summary: string | null = null;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (LOVABLE_API_KEY && (title || description)) {
      try {
        console.log('Generating AI summary...');
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              { 
                role: 'system', 
                content: 'You are a helpful assistant that summarizes articles for traders. Provide a concise 1-2 sentence summary focusing on key takeaways relevant to trading or investing. Be direct and informative.' 
              },
              { 
                role: 'user', 
                content: `Summarize this article:\nTitle: ${title || 'Unknown'}\nDescription: ${description || 'No description available'}\nURL: ${url}` 
              }
            ],
            max_tokens: 100,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          summary = aiData.choices?.[0]?.message?.content?.trim() || null;
          console.log('AI summary generated:', summary);
        } else {
          console.warn('AI summary failed:', aiResponse.status);
        }
      } catch (aiError) {
        console.warn('AI summary error:', aiError);
        // Continue without summary
      }
    }

    console.log(`Preview extracted - Title: ${title}, Image: ${image ? 'yes' : 'no'}, Summary: ${summary ? 'yes' : 'no'}`);

    return new Response(
      JSON.stringify({
        url,
        title: title || new URL(url).hostname,
        description: description || null,
        image: image || null,
        siteName: siteName || null,
        summary: summary || null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Link preview error:', errorMessage);
    
    return new Response(
      JSON.stringify({
        url: '',
        title: 'Unknown',
        description: null,
        image: null,
        summary: null,
        error: errorMessage,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});