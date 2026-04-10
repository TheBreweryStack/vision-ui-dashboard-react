// Types for Trade Inbox feature

export interface ParsedTrade {
  instrument_type?: "option" | "stock";
  symbol?: string;
  action?: "BUY_TO_OPEN" | "SELL_TO_CLOSE" | "BUY" | "SELL";
  put_call?: "CALL" | "PUT" | null;
  strike?: number | null;
  expiry?: string | null;
  quantity?: number;
  price?: number;
  currency?: "USD" | "CAD";
  fees?: number | null;
  filled_at?: string;
  account_type?: string | null;
  account_nickname?: string | null;
  broker?: string;
  parser_version?: string;
  needs_review?: boolean;
}

// Get display name for source/broker
export function getSourceDisplayName(source: string, parsedTrade?: ParsedTrade | GmailVerificationData | null): string {
  // Check if this is a Gmail verification
  if (parsedTrade && 'type' in parsedTrade && parsedTrade.type === 'gmail_forwarding_verification') {
    return "Gmail";
  }
  
  // Check if broker is set in parsed_trade (for ParsedTrade type)
  if (parsedTrade && 'broker' in parsedTrade && parsedTrade.broker) {
    return parsedTrade.broker;
  }
  
  // Map source to display name
  switch (source) {
    case "wealthsimple_email":
      return "Wealthsimple";
    case "email":
      return "Email Import";
    case "gmail_verification":
      return "Gmail";
    default:
      return source || "Unknown";
  }
}

// Get missing fields that need user attention
export function getMissingFields(parsedTrade?: ParsedTrade | GmailVerificationData | null): string[] {
  if (!parsedTrade) return ["All fields"];
  
  // Gmail verification doesn't have missing trade fields
  if ('type' in parsedTrade && parsedTrade.type === 'gmail_forwarding_verification') {
    return [];
  }
  
  const parsed = parsedTrade as ParsedTrade;
  const missing: string[] = [];
  
  if (!parsed.symbol) missing.push("Symbol");
  if (parsed.instrument_type === "option") {
    if (!parsed.strike) missing.push("Strike");
    if (!parsed.put_call) missing.push("Call/Put");
    if (!parsed.expiry) missing.push("Expiry");
  }
  if (!parsed.quantity) missing.push("Quantity");
  if (!parsed.price) missing.push("Price");
  if (!parsed.action) missing.push("Action");
  
  return missing;
}

export interface GmailVerificationData {
  type: 'gmail_forwarding_verification';
  confirm_url: string | null;
  cancel_url: string | null;
  target_forwarding_address: string;
  source_email: string;
}

export interface TradeInboxItem {
  id: string;
  user_id: string;
  source: string;
  source_message_id?: string | null;
  source_hash: string;
  raw_payload?: Record<string, unknown> | null;
  raw_text?: string | null;
  parsed_trade?: (ParsedTrade | GmailVerificationData) | null;
  status: 'pending' | 'imported' | 'ignored' | 'needs_review' | 'failed' | 'system' | 'action_required';
  confidence: number;
  errors?: string | null;
  received_at: string;
  imported_trade_id?: string | null; // Legacy field
  imported_group_id?: string | null; // New field for trade_groups
}

// Type guard to check if parsed_trade is a Gmail verification
export function isGmailVerification(parsed: ParsedTrade | GmailVerificationData | null | undefined): parsed is GmailVerificationData {
  return parsed !== null && parsed !== undefined && 'type' in parsed && parsed.type === 'gmail_forwarding_verification';
}

export interface EmailIngestAddress {
  id: string;
  user_id: string;
  provider: string;
  token: string;
  email_address: string;
  is_active: boolean;
  created_at: string;
}

// Map parsed trade to the trades table format
export function mapParsedTradeToTrade(parsed: ParsedTrade) {
  // Determine trade_type from instrument type and put_call
  let trade_type: 'call' | 'put' | 'stock' = 'stock';
  if (parsed.instrument_type === 'option') {
    trade_type = parsed.put_call?.toLowerCase() === 'call' ? 'call' : 'put';
  }

  // Determine if this is an entry or exit based on action
  const isEntry = parsed.action === 'BUY_TO_OPEN' || parsed.action === 'BUY';
  
  const filledDate = parsed.filled_at ? new Date(parsed.filled_at) : new Date();
  const dateStr = filledDate.toISOString().split('T')[0];
  const timeStr = filledDate.toTimeString().substring(0, 5);

  return {
    ticker: parsed.symbol || '',
    trade_type,
    entry_price: isEntry ? (parsed.price || 0) : 0,
    entry_date: isEntry ? dateStr : '',
    entry_time: isEntry ? timeStr : null,
    exit_price: !isEntry ? (parsed.price || 0) : null,
    exit_date: !isEntry ? dateStr : null,
    exit_time: !isEntry ? timeStr : null,
    quantity: parsed.quantity || 1,
    strategy: null,
    notes: `Imported from Wealthsimple email. Account: ${parsed.account_nickname || parsed.account_type || 'Unknown'}`,
    status: isEntry ? 'open' as const : 'closed' as const,
    pnl: null,
    strike_price: parsed.strike || null,
    expiration_date: parsed.expiry || null,
    images: null,
  };
}
