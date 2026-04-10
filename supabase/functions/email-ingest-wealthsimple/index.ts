import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import * as webpush from "jsr:@negrel/webpush";

const PARSER_VERSION = "1.3.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ingest-secret",
};

// Push notification subscription interface
interface PushSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Send push notification to all devices registered for a user
 */
async function sendPushToUser(
  // deno-lint-ignore no-explicit-any
  supabaseClient: any,
  appServer: webpush.ApplicationServer,
  userId: string,
  notification: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    tag?: string;
    data?: Record<string, unknown>;
  }
): Promise<{ sent: number; failed: number; staleDeleted: number }> {
  const result = { sent: 0, failed: 0, staleDeleted: 0 };

  // Get all push subscriptions for this user
  const { data, error } = await supabaseClient
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (error || !data?.length) {
    console.log(`[sendPushToUser] No subscriptions for user ${userId}`);
    return result;
  }

  // Cast to known type
  const subscriptions = data as unknown as PushSubscription[];

  const payload = JSON.stringify({
    ...notification,
    silent: false,
    requireInteraction: true,
  });

  for (const sub of subscriptions) {
    try {
      const subscriber = appServer.subscribe({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth }
      });

      await subscriber.pushTextMessage(payload, {});
      result.sent++;

      // Update last successful push timestamp
      await supabaseClient
        .from('push_subscriptions')
        .update({ last_successful_push_at: new Date().toISOString() })
        .eq('id', sub.id);

    } catch (pushError: unknown) {
      result.failed++;

      const response = (pushError as { response?: Response })?.response;
      const statusCode = response?.status;

      console.error(`[sendPushToUser] Push failed for sub ${sub.id}: status=${statusCode}`);

      // Handle stale subscriptions (410 Gone)
      if (statusCode === 410) {
        console.log(`[sendPushToUser] Deleting stale subscription ${sub.id}`);
        await supabaseClient.from('push_subscriptions').delete().eq('id', sub.id);
        result.staleDeleted++;
      }
    }
  }

  return result;
}

interface ParsedTrade {
  instrument_type: "option" | "stock";
  symbol: string;
  order_type: string | null;
  side: "BUY" | "SELL";
  action: "BUY_TO_OPEN" | "SELL_TO_CLOSE" | "BUY" | "SELL";
  put_call: "CALL" | "PUT" | null;
  strike: number | null;
  expiry: string | null;
  quantity: number;
  price: number;
  total_cost: number | null;
  currency: "USD" | "CAD";
  fees: number | null;
  filled_at: string | null;
  account_type: string | null;
  account_nickname: string | null;
  broker: string;
}

// Content patterns that indicate a Wealthsimple trade confirmation
// Detect by subject + body content only - NOT sender
const WEALTHSIMPLE_PATTERNS = [
  "wealthsimple",
  "your order has been filled",
  "order has been filled",
  "option:",
  "contracts:",
  "expiry:",
  "average price:",
  "total cost:",
  "total proceeds:",
];

// Check if email is a Gmail forwarding verification email
function isGmailVerificationEmail(text: string, subject: string, fromEmail: string): boolean {
  const textLower = text.toLowerCase();
  const subjectLower = subject.toLowerCase();
  
  // Check: raw_text contains "Gmail Team" OR subject contains "Gmail Forwarding Confirmation" OR raw_text contains "automatically forward mail"
  const hasGmailTeam = textLower.includes("gmail team");
  const hasSubjectMatch = subjectLower.includes("gmail forwarding confirmation");
  const hasAutoForward = textLower.includes("automatically forward mail");
  
  return hasGmailTeam || hasSubjectMatch || hasAutoForward;
}

// Extract Gmail verification URLs from email text
function extractGmailVerificationUrls(text: string): { confirm_url: string | null; cancel_url: string | null; target_forwarding_address: string | null; source_email: string | null } {
  // Extract all URLs from text
  const urlPattern = /https?:\/\/[^\s<>"']+/gi;
  const urls = text.match(urlPattern) || [];
  
  let confirm_url: string | null = null;
  let cancel_url: string | null = null;
  
  for (const url of urls) {
    // Clean URL (remove trailing punctuation)
    const cleanUrl = url.replace(/[.,;:!?)\]}>]+$/, '');
    
    // Match confirm URL: https://mail.google.com/mail/vf-... OR https://mail-settings.google.com/mail/vf-...
    if (/^https:\/\/mail(?:-settings)?\.google\.com\/mail\/vf-/i.test(cleanUrl) && !confirm_url) {
      confirm_url = cleanUrl;
    }
    // Match cancel URL: https://mail.google.com/mail/uf-... OR https://mail-settings.google.com/mail/uf-...
    if (/^https:\/\/mail(?:-settings)?\.google\.com\/mail\/uf-/i.test(cleanUrl) && !cancel_url) {
      cancel_url = cleanUrl;
    }
  }
  
  // Extract target forwarding address (ws+...@ingest.tradercafe.app)
  const targetMatch = text.match(/ws\+[a-f0-9]+@ingest\.tradercafe\.app/i);
  const target_forwarding_address = targetMatch ? targetMatch[0].toLowerCase() : null;
  
  // Extract source email (the gmail address that is setting up forwarding)
  const sourceMatch = text.match(/([a-zA-Z0-9._%+-]+@gmail\.com)\s+has requested to automatically forward/i);
  const source_email = sourceMatch ? sourceMatch[1].toLowerCase() : null;
  
  return { confirm_url, cancel_url, target_forwarding_address, source_email };
}

// Extract source email from Gmail verification text (the email that forwarding is being set up for)
function extractSourceEmail(text: string): string | null {
  // Pattern: "Receive Mail from email@domain.com" or "kawthaman.thambirajah@gmail.com is requesting..."
  const patterns = [
    /Receive Mail from\s+([^\s<>]+@[^\s<>]+)/i,
    /from\s+([^\s<>]+@[^\s<>]+)\s+is requesting/i,
    /([a-zA-Z0-9._%+-]+@gmail\.com)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].toLowerCase();
    }
  }
  return null;
}

// Stage 1: Decode quoted-printable encoding (=0A, =20, etc.)
function decodeQuotedPrintable(text: string): string {
  return text
    // Handle soft line breaks (= at end of line)
    .replace(/=\r?\n/g, "")
    // Decode hex-encoded characters
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });
}

// Stage 2: Strip HTML tags while preserving text structure
function stripHtml(html: string): string {
  return html
    // First decode quoted-printable in case HTML contains it
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    // Remove style and script blocks entirely
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    // Remove hidden elements (Wealthsimple uses these for padding/tracking)
    .replace(/<div[^>]*style="[^"]*display:\s*none[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<span[^>]*style="[^"]*display:\s*none[^"]*"[^>]*>[\s\S]*?<\/span>/gi, "")
    // Add newlines before block elements to preserve structure
    .replace(/<(div|p|br|tr|li|h[1-6])[^>]*>/gi, "\n")
    // Add space for table cells
    .replace(/<td[^>]*>/gi, " ")
    // Remove all remaining HTML tags
    .replace(/<[^>]+>/g, " ")
    // Decode HTML entities
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/gi, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9A-Fa-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// Stage 3: Clean and normalize text
function cleanText(text: string): string {
  return text
    // Remove invisible Unicode characters (U+034F combining grapheme joiner, zero-width chars, etc.)
    .replace(/[\u034F\u200B\u200C\u200D\u2060\uFEFF\u00AD]/g, "")
    // Remove other control characters but keep newlines
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // Normalize various dash/hyphen characters to standard hyphen
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, "-")
    // Collapse multiple spaces (but preserve newlines)
    .replace(/[ \t]+/g, " ")
    // Clean up spaces around newlines
    .replace(/ ?\n ?/g, "\n")
    // Collapse multiple newlines into max 2
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Two-stage parsing pipeline: body-html → text normalization → clean text
function normalizeBodyText(formData: Record<string, string>): string {
  console.log("Starting text normalization...");
  console.log("Available sources:", {
    hasBodyHtml: !!formData["body-html"],
    bodyHtmlLength: formData["body-html"]?.length || 0,
    hasStrippedText: !!formData["stripped-text"],
    strippedTextLength: formData["stripped-text"]?.length || 0,
    hasBodyPlain: !!formData["body-plain"],
    bodyPlainLength: formData["body-plain"]?.length || 0,
  });

  // Priority 1: body-html (most reliable for forwarded emails)
  // Parse HTML → decode quoted-printable → strip tags → clean
  if (formData["body-html"]) {
    const decoded = decodeQuotedPrintable(formData["body-html"]);
    const stripped = stripHtml(decoded);
    const cleaned = cleanText(stripped);
    console.log("Using body-html source, cleaned length:", cleaned.length);
    
    // Log first and last 300 chars for debugging
    console.log("First 300 chars:", cleaned.substring(0, 300));
    console.log("Last 300 chars:", cleaned.substring(Math.max(0, cleaned.length - 300)));
    
    return cleaned;
  }
  
  // Priority 2: body-plain (fallback if no HTML)
  if (formData["body-plain"]) {
    const decoded = decodeQuotedPrintable(formData["body-plain"]);
    const cleaned = cleanText(decoded);
    console.log("Using body-plain source, cleaned length:", cleaned.length);
    return cleaned;
  }
  
  // Priority 3: stripped-text (last resort)
  if (formData["stripped-text"]) {
    const decoded = decodeQuotedPrintable(formData["stripped-text"]);
    const cleaned = cleanText(decoded);
    console.log("Using stripped-text source, cleaned length:", cleaned.length);
    return cleaned;
  }
  
  console.log("No text source available!");
  return "";
}

// Classify email by content patterns (not sender) - detect by subject + body
function classifyByContent(text: string, subject: string): { isWealthsimple: boolean; matchCount: number; matchedPatterns: string[] } {
  const normalizedText = (text + " " + subject).toLowerCase();
  const matchedPatterns: string[] = [];
  
  for (const pattern of WEALTHSIMPLE_PATTERNS) {
    if (normalizedText.includes(pattern.toLowerCase())) {
      matchedPatterns.push(pattern);
    }
  }
  
  // Require at least 2 pattern matches to classify as Wealthsimple
  const isWealthsimple = matchedPatterns.length >= 2;
  
  return { isWealthsimple, matchCount: matchedPatterns.length, matchedPatterns };
}

// Parse Wealthsimple email format using flexible patterns (not fixed positions)
function parseWealthsimpleEmail(text: string): { parsed: Partial<ParsedTrade>; confidence: number; errors: string[]; fieldScores: Record<string, boolean> } {
  const errors: string[] = [];
  const parsed: Partial<ParsedTrade> = {};
  const fieldScores: Record<string, boolean> = {};
  
  // Set broker
  parsed.broker = "Wealthsimple";

  // Log a cleaned version for debugging - find the "Your order has been filled" section
  const orderFilledIndex = text.toLowerCase().indexOf("your order has been filled");
  const relevantSection = orderFilledIndex > -1 
    ? text.substring(orderFilledIndex, Math.min(orderFilledIndex + 800, text.length))
    : text.substring(0, 800);
  console.log("Relevant section for parsing:", relevantSection);

  // Normalize whitespace and currency symbols for easier parsing
  // Be more aggressive about normalizing to handle HTML artifacts
  const normalizedText = text
    .replace(/US\s*\$/gi, "US$")
    .replace(/CA\s*\$/gi, "CA$")
    .replace(/CAD\s*\$/gi, "CAD$")
    // Normalize various whitespace to single space
    .replace(/[\t\r\n]+/g, " ")
    .replace(/\s{2,}/g, " ");

  console.log("Searching for patterns in normalized text length:", normalizedText.length);

  // Account type - more flexible pattern
  const accountPatterns = [
    /Account:\s*([A-Za-z0-9\s-]+?)(?:\s+Account nickname|\s+Type|\s*$)/i,
    /Account:\s*([A-Z]{3,}(?:\s*-\s*[A-Za-z&\s]+)?)/i,
  ];
  for (const pattern of accountPatterns) {
    const match = normalizedText.match(pattern);
    if (match) {
      parsed.account_type = match[1].trim();
      console.log("Found account_type:", parsed.account_type);
      break;
    }
  }

  // Account nickname
  const nicknamePatterns = [
    /Account nickname:\s*([^T]+?)(?:\s+Type|\s*$)/i,
    /nickname:\s*(.+?)(?:\s+Type|\s*$)/i,
  ];
  for (const pattern of nicknamePatterns) {
    const match = normalizedText.match(pattern);
    if (match) {
      parsed.account_nickname = match[1].trim();
      console.log("Found account_nickname:", parsed.account_nickname);
      break;
    }
  }

  // Type (order_type and action) - more flexible patterns
  const typePatterns = [
    /Type:\s*((?:Limit|Market)\s*(?:Buy|Sell)\s*(?:to\s*(?:Open|Close))?)/i,
    /(Limit\s*Buy\s*to\s*Open)/i,
    /(Limit\s*Sell\s*to\s*Close)/i,
    /(Market\s*Buy\s*to\s*Open)/i,
    /(Market\s*Sell\s*to\s*Close)/i,
    /(Market\s*Buy)/i,
    /(Market\s*Sell)/i,
    /(Buy\s*to\s*Open)/i,
    /(Sell\s*to\s*Close)/i,
    /Type:\s*(Buy|Sell)/i,
  ];

  for (const pattern of typePatterns) {
    const match = normalizedText.match(pattern);
    if (match) {
      const orderType = match[1].trim().replace(/\s+/g, " ");
      parsed.order_type = orderType;
      fieldScores.order_type = true;
      console.log("Found order_type:", orderType);
      
      const actionLower = orderType.toLowerCase();
      if (actionLower.includes("buy") && actionLower.includes("open")) {
        parsed.action = "BUY_TO_OPEN";
        parsed.side = "BUY";
      } else if (actionLower.includes("sell") && actionLower.includes("close")) {
        parsed.action = "SELL_TO_CLOSE";
        parsed.side = "SELL";
      } else if (actionLower.includes("buy")) {
        parsed.action = "BUY";
        parsed.side = "BUY";
      } else if (actionLower.includes("sell")) {
        parsed.action = "SELL";
        parsed.side = "SELL";
      }
      break;
    }
  }

  if (!parsed.order_type) {
    errors.push("Could not parse order type");
    fieldScores.order_type = false;
  }

  // Symbol extraction - Extract from "Option: SYMBOL STRIKE call|put"
  // More flexible to handle various spacing and formats
  const optionPatterns = [
    /Option:\s*([A-Z]{1,5})\s+(\d+(?:\.\d+)?)\s*(call|put)/i,
    /Option:\s*([A-Z]{1,5})\s+\$?(\d+(?:\.\d+)?)\s*(call|put)/i,
    /([A-Z]{1,5})\s+(\d+(?:\.\d+)?)\s*(call|put)\s*option/i,
    // Pattern for when there might be odd spacing
    /Option\s*:\s*([A-Z]{1,5})\s+(\d+(?:[.,]\d+)?)\s*(call|put)/i,
  ];

  let optionFound = false;
  for (const pattern of optionPatterns) {
    const match = normalizedText.match(pattern);
    if (match) {
      parsed.instrument_type = "option";
      parsed.symbol = match[1].toUpperCase();
      parsed.strike = parseFloat(match[2].replace(",", "."));
      parsed.put_call = match[3].toUpperCase() as "CALL" | "PUT";
      fieldScores.symbol = true;
      fieldScores.strike = true;
      fieldScores.put_call = true;
      optionFound = true;
      console.log("Found option:", { symbol: parsed.symbol, strike: parsed.strike, put_call: parsed.put_call });
      break;
    }
  }

  if (!optionFound) {
    // Try to find just symbol from Option: line
    const partialOptionMatch = normalizedText.match(/Option\s*:\s*([A-Z]{1,5})/i);
    if (partialOptionMatch) {
      parsed.instrument_type = "option";
      parsed.symbol = partialOptionMatch[1].toUpperCase();
      fieldScores.symbol = true;
      fieldScores.strike = false;
      fieldScores.put_call = false;
      console.log("Found partial option symbol:", parsed.symbol);
      errors.push("Could not parse strike price or call/put from option");
    } else {
      // Try to find stock symbol
      const stockMatch = normalizedText.match(/Symbol:\s*([A-Z]{1,5})/i);
      if (stockMatch) {
        parsed.instrument_type = "stock";
        parsed.symbol = stockMatch[1].toUpperCase();
        parsed.put_call = null;
        parsed.strike = null;
        fieldScores.symbol = true;
        console.log("Found stock symbol:", parsed.symbol);
      } else {
        errors.push("Could not parse symbol");
        fieldScores.symbol = false;
      }
    }
  }

  // Quantity - Match Contracts:\s*(\d+) with flexible spacing
  const contractsPatterns = [
    /Contracts\s*:\s*(\d+)/i,
    /(\d+)\s*contracts?/i,
  ];
  
  let quantityFound = false;
  for (const pattern of contractsPatterns) {
    const match = normalizedText.match(pattern);
    if (match) {
      parsed.quantity = parseInt(match[1], 10);
      fieldScores.quantity = true;
      quantityFound = true;
      console.log("Found quantity:", parsed.quantity);
      break;
    }
  }

  if (!quantityFound) {
    // Try shares for stock
    const sharesMatch = normalizedText.match(/Shares\s*:\s*(\d+)/i);
    if (sharesMatch) {
      parsed.quantity = parseInt(sharesMatch[1], 10);
      fieldScores.quantity = true;
      console.log("Found shares quantity:", parsed.quantity);
    } else {
      errors.push("Could not parse quantity");
      fieldScores.quantity = false;
    }
  }

  // Average price - Match Average price:\s*(US\$|CAD\$)?([\d.]+) with flexible spacing
  const pricePatterns = [
    /Average\s*price\s*:\s*(US\$|CA\$|CAD\$|USD|CAD|\$)?\s*(\d+(?:,\d{3})*(?:[.,]\d+)?)/i,
    /Avg\.?\s*price\s*:\s*(US\$|CA\$|CAD\$|USD|CAD|\$)?\s*(\d+(?:,\d{3})*(?:[.,]\d+)?)/i,
    /Price\s*:\s*(US\$|CA\$|CAD\$|USD|CAD|\$)?\s*(\d+(?:,\d{3})*(?:[.,]\d+)?)/i,
  ];

  let priceFound = false;
  for (const pattern of pricePatterns) {
    const match = normalizedText.match(pattern);
    if (match) {
      parsed.price = parseFloat(match[2].replace(/,/g, ""));
      parsed.currency = (match[1]?.includes("CA") || match[1]?.includes("CAD")) ? "CAD" : "USD";
      fieldScores.price = true;
      priceFound = true;
      console.log("Found price:", parsed.price, "currency:", parsed.currency);
      break;
    }
  }

  if (!priceFound) {
    errors.push("Could not parse average price");
    fieldScores.price = false;
  }

  // Expiry - Match Expiry:\s*(\d{4}-\d{2}-\d{2}) with flexible patterns
  const expiryPatterns = [
    /Expiry\s*:\s*(\d{4}-\d{2}-\d{2})/i,
    /Expir(?:y|ation)\s*:\s*([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i,
    /Exp(?:iry)?\s*:\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
  ];

  let expiryFound = false;
  for (const pattern of expiryPatterns) {
    const match = normalizedText.match(pattern);
    if (match) {
      const dateStr = match[1];
      // Check if it's already in YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        parsed.expiry = dateStr;
        fieldScores.expiry = true;
        expiryFound = true;
        console.log("Found expiry (ISO format):", parsed.expiry);
        break;
      }
      // Try to parse other formats
      try {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          parsed.expiry = date.toISOString().split('T')[0];
          fieldScores.expiry = true;
          expiryFound = true;
          console.log("Found expiry (parsed):", parsed.expiry);
          break;
        }
      } catch {
        // Continue to next pattern
      }
    }
  }

  if (!expiryFound && parsed.instrument_type === "option") {
    errors.push("Could not parse expiry date");
    fieldScores.expiry = false;
  }

  // Total cost/proceeds (e.g., "Total cost: US$114.00")
  const totalPatterns = [
    /Total\s*(?:cost|proceeds)\s*:\s*(US\$|CA\$|CAD\$|USD|CAD|\$)?\s*(\d+(?:,\d{3})*(?:[.,]\d+)?)/i,
  ];
  for (const pattern of totalPatterns) {
    const match = normalizedText.match(pattern);
    if (match) {
      parsed.total_cost = parseFloat(match[2].replace(/,/g, ""));
      if (!parsed.currency && match[1]) {
        parsed.currency = (match[1]?.includes("CA") || match[1]?.includes("CAD")) ? "CAD" : "USD";
      }
      console.log("Found total_cost:", parsed.total_cost);
      break;
    }
  }

  // Time/filled_at: Month DD, YYYY HH:MM TZ
  const timePatterns = [
    /Time\s*:\s*([A-Za-z]+\s+\d{1,2},?\s*\d{4}\s+\d{1,2}:\d{2}\s*(?:AM|PM)?\s*[A-Z]*)/i,
    /Filled(?:\s+at)?\s*:\s*([A-Za-z]+\s+\d{1,2},?\s*\d{4}\s+\d{1,2}:\d{2}\s*(?:AM|PM)?)/i,
  ];

  for (const pattern of timePatterns) {
    const match = normalizedText.match(pattern);
    if (match) {
      try {
        const dateStr = match[1].trim();
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          parsed.filled_at = date.toISOString();
          console.log("Found filled_at:", parsed.filled_at);
        }
      } catch {
        errors.push("Could not parse filled_at time");
      }
      break;
    }
  }

  // Calculate confidence based on parsed fields
  // Each successfully parsed field adds confidence
  // Weight: symbol (25%), price (20%), quantity (15%), strike (15%), expiry (15%), order_type (10%)
  const weights = {
    symbol: 0.25,
    price: 0.20,
    quantity: 0.15,
    strike: 0.15,
    expiry: 0.15,
    order_type: 0.10,
  };

  let confidence = 0;
  for (const [field, weight] of Object.entries(weights)) {
    if (fieldScores[field]) {
      confidence += weight;
    }
  }

  // Round to 2 decimal places
  confidence = Math.round(confidence * 100) / 100;

  console.log("Parse result:", { 
    confidence, 
    fieldScores,
    parsedFields: Object.keys(parsed).filter(k => parsed[k as keyof typeof parsed] !== undefined),
    errors 
  });

  return { parsed, confidence, errors, fieldScores };
}

// Generate a stable hash for deduplication
async function generateSourceHash(data: Record<string, unknown>): Promise<string> {
  const stableString = JSON.stringify(data);
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(stableString));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Extract email address from a string like "Name <email@domain.com>" or just "email@domain.com"
function extractEmailAddress(emailString: string): string {
  const match = emailString.match(/<([^>]+)>/);
  if (match) {
    return match[1].toLowerCase();
  }
  return emailString.toLowerCase().trim();
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Email ingest request received");

    // Verify secret from query param or header
    const url = new URL(req.url);
    const qpSecret = url.searchParams.get("secret");
    const headerSecret = req.headers.get("x-ingest-secret");
    const expected = Deno.env.get("INBOUND_INGEST_SECRET");

    if (!expected || (qpSecret !== expected && headerSecret !== expected)) {
      console.error("Invalid or missing ingest secret");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get token from query params (legacy support)
    const token = url.searchParams.get("token");

    // Initialize Supabase client with service role key (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    console.log("Supabase URL exists:", !!supabaseUrl);
    console.log("Service role key exists:", !!serviceRoleKey);
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Parse form data from Mailgun (application/x-www-form-urlencoded)
    let subject = "";
    let fromEmail = "";
    let recipientEmail = "";
    let messageId = "";
    let rawPayload: Record<string, string> = {};

    try {
      const formData = await req.formData();
      
      // Extract all fields from Mailgun's form data
      for (const [key, value] of formData.entries()) {
        if (typeof value === "string") {
          rawPayload[key] = value.substring(0, 50000); // Limit size but keep more for parsing
        }
      }
      
      subject = rawPayload["subject"] || rawPayload["Subject"] || "";
      fromEmail = rawPayload["from"] || rawPayload["From"] || "";
      recipientEmail = rawPayload["recipient"] || rawPayload["to"] || rawPayload["To"] || "";
      messageId = rawPayload["Message-Id"] || rawPayload["message-id"] || "";
      
      console.log("Form data parsed:", { 
        hasStrippedText: !!rawPayload["stripped-text"],
        hasPlainText: !!rawPayload["body-plain"], 
        hasHtml: !!rawPayload["body-html"], 
        subject,
        from: fromEmail,
        recipient: recipientEmail,
        messageId
      });
    } catch (formError) {
      console.error("Failed to parse form data:", formError);
      rawPayload = { error: "Failed to parse form data", message: String(formError) };
    }

    // Normalize body text (prefer stripped-text > body-plain > body-html converted)
    const normalizedText = normalizeBodyText(rawPayload);
    console.log("Normalized text length:", normalizedText.length);

    // Determine user_id from multiple sources
    let userId: string | null = null;
    let lookupMethod = "none";
    
    // Method 1: Token lookup
    if (token) {
      const { data: ingestAddress, error: lookupError } = await supabase
        .from("email_ingest_addresses")
        .select("user_id, is_active")
        .eq("token", token)
        .maybeSingle();

      if (lookupError) {
        console.error("Token lookup error:", lookupError);
      } else if (ingestAddress && ingestAddress.is_active) {
        userId = ingestAddress.user_id;
        lookupMethod = "token";
        console.log("User found via token:", userId);
      }
    }
    
    // Method 2: Recipient email lookup (if no user found via token)
    if (!userId && recipientEmail) {
      const cleanRecipient = extractEmailAddress(recipientEmail);
      console.log("Looking up user by recipient email:", cleanRecipient);
      
      const { data: ingestAddress, error: lookupError } = await supabase
        .from("email_ingest_addresses")
        .select("user_id, is_active")
        .eq("email_address", cleanRecipient)
        .maybeSingle();

      if (lookupError) {
        console.error("Recipient email lookup error:", lookupError);
      } else if (ingestAddress && ingestAddress.is_active) {
        userId = ingestAddress.user_id;
        lookupMethod = "recipient_email";
        console.log("User found via recipient email:", userId);
      } else {
        console.log("No active ingest address found for:", cleanRecipient);
      }
    }

    console.log("Final user lookup result:", { userId, lookupMethod });

    // Check if this is a Gmail verification email FIRST - handle specially
    const isGmailVerification = isGmailVerificationEmail(normalizedText, subject, fromEmail);
    console.log("Gmail verification check:", isGmailVerification);

    if (isGmailVerification) {
      // Gmail verification email - store with special status
      const hashData = {
        from: fromEmail,
        subject,
        messageId,
        text: normalizedText.substring(0, 1000),
      };
      const sourceHash = await generateSourceHash(hashData);

      // Check for duplicates
      if (userId) {
        const { data: existingEntry } = await supabase
          .from("trade_inbox")
          .select("id")
          .eq("source_hash", sourceHash)
          .eq("user_id", userId)
          .maybeSingle();

        if (existingEntry) {
          console.log("Duplicate Gmail verification detected, returning success");
          return new Response(JSON.stringify({ 
            success: true, 
            deduped: true, 
            id: existingEntry.id,
            isGmailVerification: true,
          }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Extract verification URLs and email info
      const verificationData = extractGmailVerificationUrls(normalizedText);
      
      console.log("Gmail verification data extracted:", { 
        confirm_url: !!verificationData.confirm_url, 
        cancel_url: !!verificationData.cancel_url, 
        target: verificationData.target_forwarding_address,
        source: verificationData.source_email 
      });

      // Build row for Gmail verification
      const gmailRow = {
        user_id: userId,
        source: "gmail_verification",
        source_message_id: messageId || null,
        source_hash: sourceHash,
        raw_payload: { 
          recipient: recipientEmail, 
          sender: fromEmail, 
          subject,
          parser_version: PARSER_VERSION,
        },
        raw_text: normalizedText || null,
        parsed_trade: {
          type: "gmail_forwarding_verification",
          confirm_url: verificationData.confirm_url,
          cancel_url: verificationData.cancel_url,
          target_forwarding_address: verificationData.target_forwarding_address || recipientEmail,
          source_email: verificationData.source_email || fromEmail,
        },
        status: "action_required",
        confidence: 1.0,
        errors: null,
        received_at: new Date().toISOString(),
      };

      console.log("Inserting Gmail verification row:", { 
        user_id: gmailRow.user_id,
        status: gmailRow.status,
        source: gmailRow.source,
      });

      const { data, error } = await supabase
        .from("trade_inbox")
        .insert(gmailRow)
        .select()
        .single();

      if (error) {
        console.error("Gmail verification insert failed:", error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Gmail verification entry created:", data.id);

      return new Response(
        JSON.stringify({
          success: true,
          id: data.id,
          status: "system",
          isGmailVerification: true,
          lookupMethod,
          parserVersion: PARSER_VERSION,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Classify by content patterns (not sender domain) - detect by subject + body
    const classification = classifyByContent(normalizedText, subject);
    console.log("Content classification:", classification);
    
    // Check if subject contains "order has been filled" - if so, always keep as pending
    const subjectContainsOrderFilled = subject.toLowerCase().includes("order has been filled");
    
    // Parse the email if it looks like Wealthsimple or has partial matches
    let parsed: Partial<ParsedTrade> = {};
    let confidence = 0;
    let parseErrors: string[] = [];
    let fieldScores: Record<string, boolean> = {};
    
    if (classification.isWealthsimple && normalizedText) {
      const parseResult = parseWealthsimpleEmail(normalizedText);
      parsed = parseResult.parsed;
      confidence = parseResult.confidence;
      parseErrors = parseResult.errors;
      fieldScores = parseResult.fieldScores;
    } else if ((classification.matchCount >= 1 || subjectContainsOrderFilled) && normalizedText) {
      // Partial match - try parsing anyway for review
      const parseResult = parseWealthsimpleEmail(normalizedText);
      parsed = parseResult.parsed;
      confidence = Math.min(parseResult.confidence, 0.5); // Cap at 0.5 for partial classification
      parseErrors = parseResult.errors;
      fieldScores = parseResult.fieldScores;
      parseErrors.push("Partial content match only");
    }

    // Generate source hash for deduplication
    const hashData = {
      from: fromEmail,
      subject,
      messageId,
      text: normalizedText.substring(0, 1000),
    };
    const sourceHash = await generateSourceHash(hashData);

    // Check for duplicates (only if we have a user to check against)
    if (userId) {
      const { data: existingEntry } = await supabase
        .from("trade_inbox")
        .select("id")
        .eq("source_hash", sourceHash)
        .eq("user_id", userId)
        .maybeSingle();

      if (existingEntry) {
        console.log("Duplicate entry detected, returning success");
        return new Response(JSON.stringify({ 
          success: true, 
          deduped: true, 
          id: existingEntry.id 
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Determine status based on classification and confidence
    // NEVER mark as Ignored automatically if subject contains "order has been filled"
    let status: string;
    let needsReview = false;
    
    if (!userId) {
      status = "unmatched";
    } else if (classification.isWealthsimple || subjectContainsOrderFilled || classification.matchCount >= 1) {
      // Any Wealthsimple indication - keep as pending
      if (confidence >= 0.7) {
        status = "pending"; // ≥70% → auto-ready
      } else {
        status = "pending";
        needsReview = true; // <70% → pending (manual confirmation)
      }
    } else {
      // No patterns matched at all AND subject doesn't indicate order filled
      // Still keep as pending for manual review instead of ignored
      status = "pending";
      needsReview = true;
    }

    // Determine broker from content
    const broker = classification.isWealthsimple || classification.matchCount >= 1 ? "Wealthsimple" : "Unknown";

    // Build the row to insert - always store raw_text, parser_version, and parse_errors
    const row = {
      user_id: userId,
      source: classification.isWealthsimple || classification.matchCount >= 1 ? "wealthsimple_email" : "email",
      source_message_id: messageId || null,
      source_hash: sourceHash,
      raw_payload: { 
        ...rawPayload, 
        recipient: recipientEmail, 
        sender: fromEmail, 
        subject,
        parser_version: PARSER_VERSION,
        matched_patterns: classification.matchedPatterns,
        field_scores: fieldScores,
      },
      raw_text: normalizedText || null,
      parsed_trade: Object.keys(parsed).length > 0 ? { 
        ...parsed, 
        parser_version: PARSER_VERSION,
        needs_review: needsReview,
        broker,
      } : { broker, parser_version: PARSER_VERSION, needs_review: true },
      status,
      confidence,
      errors: parseErrors.length > 0 ? parseErrors.join("; ") : null,
      received_at: new Date().toISOString(),
    };

    console.log("Inserting trade_inbox row:", { 
      user_id: row.user_id,
      status: row.status,
      source: row.source,
      confidence: row.confidence,
      needsReview,
      matchedPatterns: classification.matchedPatterns,
      source_hash: row.source_hash.substring(0, 16) + "..."
    });

    // Insert into trade_inbox
    const { data, error } = await supabase
      .from("trade_inbox")
      .insert(row)
      .select()
      .single();

    console.log("TRADE_INBOX_INSERT_RESULT", { data, error });

    if (error) {
      console.error("TRADE_INBOX_INSERT_FAILED", error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Trade inbox entry created:", data.id, "Status:", status, "Confidence:", confidence);

    // Insert notification for in-app history (trades needing review)
    if (userId && (status === 'needs_review' || status === 'action_required')) {
      try {
        const { error: notifError } = await supabase
          .from('notifications')
          .insert({
            user_id: userId,
            title: 'Trade needs review',
            body: parsed.symbol 
              ? `${parsed.symbol} trade requires your attention`
              : 'New trade requires manual review',
            type: 'trade_inbox',
            data: { 
              tradeInboxId: data.id, 
              url: '/trade-inbox',
              status,
            },
          });
        
        if (notifError) {
          console.error('[Notification] Failed to save:', notifError);
        } else {
          console.log('[Notification] Saved to history');
        }
      } catch (notifErr) {
        console.error('[Notification] Error:', notifErr);
      }
    }

    // Send push notification if user has valid subscription and preferences allow
    if (userId && (status === 'pending' || status === 'needs_review')) {
      try {
        // Check user preferences first
        const { data: prefs } = await supabase
          .from('notification_preferences')
          .select('inbox_alerts, mute_all_notifications')
          .eq('user_id', userId)
          .maybeSingle();
        
        const shouldPush = prefs?.inbox_alerts !== false && 
                           prefs?.mute_all_notifications !== true;
        
        if (shouldPush) {
          // Initialize VAPID keys for push notifications
          const vapidKeysJwk = Deno.env.get('VAPID_KEYS_JWK');
          const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:hello@tradercafe.app';
          
          if (vapidKeysJwk) {
            try {
              const parsedKeys = JSON.parse(vapidKeysJwk);
              const vapidKeys = await webpush.importVapidKeys(parsedKeys, { extractable: true });
              const appServer = await webpush.ApplicationServer.new({
                contactInformation: vapidSubject,
                vapidKeys,
              });
              
              const ticker = parsed.symbol || 'Trade';
              const pushResult = await sendPushToUser(supabase, appServer, userId, {
                title: '📥 New Trade Received',
                body: `${ticker} trade ready for review`,
                icon: '/app-icon.png',
                badge: '/app-icon.png',
                tag: `trade-inbox-${data.id}`,
                data: {
                  url: '/trade-inbox',
                  type: 'trade_inbox',
                  tradeInboxId: data.id,
                }
              });
              
              console.log('[Push] Sent:', pushResult.sent, 'Failed:', pushResult.failed, 'Stale deleted:', pushResult.staleDeleted);
            } catch (vapidErr) {
              console.warn('[Push] Failed to initialize VAPID:', vapidErr);
            }
          } else {
            console.log('[Push] VAPID_KEYS_JWK not configured, skipping push');
          }
        } else {
          console.log('[Push] Skipped - user preferences disabled');
        }
      } catch (pushErr) {
        console.error('[Push] Error:', pushErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        id: data.id,
        status,
        confidence,
        needsReview,
        isWealthsimple: classification.isWealthsimple,
        matchedPatterns: classification.matchedPatterns,
        lookupMethod,
        parserVersion: PARSER_VERSION,
        broker,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error in email-ingest-wealthsimple:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
