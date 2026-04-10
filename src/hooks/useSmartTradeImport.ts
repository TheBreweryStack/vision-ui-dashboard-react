import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { usePortfolios } from './usePortfolios';
import { ParsedTrade } from '@/lib/tradeInbox';
import { TradeGroup, useTradeGroups } from './useTradeGroups';

interface SmartImportResult {
  data: TradeGroup | null;
  error: Error | null;
  action: 'created' | 'updated' | 'added_to_position' | 'closed' | null;
  message: string;
}

export const useSmartTradeImport = () => {
  const { user } = useAuth();
  const { activePortfolioId } = usePortfolios();
  const { closePosition, addToPosition, findMatchingOpenGroup } = useTradeGroups();

  // Create a new group directly without checking for duplicates
  const createGroupDirect = async (params: {
    ticker: string;
    trade_type: string;
    strike_price?: number | null;
    expiration_date?: string | null;
    entry_date: string;
    entry_time?: string | null;
    quantity: number;
    price: number;
    strategy?: string | null;
    notes?: string | null;
    images?: string[] | null;
    source?: string;
    source_inbox_id?: string | null;
  }): Promise<{ data: TradeGroup | null; error: Error | null }> => {
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    try {
      // Create new group
      const { data: group, error: groupError } = await supabase
        .from('trade_groups')
        .insert({
          user_id: user.id,
          ticker: params.ticker.toUpperCase(),
          trade_type: params.trade_type,
          strike_price: params.strike_price || null,
          expiration_date: params.expiration_date || null,
          entry_date: params.entry_date,
          status: 'open',
          opened_qty: params.quantity,
          closed_qty: 0,
          remaining_qty: params.quantity,
          avg_entry_price: params.price,
          strategy: params.strategy || null,
          notes: params.notes || null,
          images: params.images || [],
          portfolio_id: activePortfolioId,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Create the initial fill
      const { error: fillError } = await supabase
        .from('trade_fills')
        .insert({
          trade_group_id: group.id,
          user_id: user.id,
          side: 'buy',
          effect: 'open',
          qty: params.quantity,
          price: params.price,
          fill_date: params.entry_date,
          fill_time: params.entry_time || null,
          source: params.source || 'manual',
          source_inbox_id: params.source_inbox_id || null,
        });

      if (fillError) throw fillError;

      return { data: { ...group, status: group.status as 'open' | 'closed' }, error: null };
    } catch (error) {
      console.error('Error creating trade group:', error);
      return { data: null, error: error as Error };
    }
  };

  // Determine trade_type from parsed data
  const getTradeType = (parsed: ParsedTrade): 'call' | 'put' | 'stock' => {
    if (parsed.instrument_type === 'option') {
      return parsed.put_call?.toLowerCase() === 'call' ? 'call' : 'put';
    }
    return 'stock';
  };

  // Get entry date from parsed trade
  const getEntryDate = (parsed: ParsedTrade): string => {
    if (parsed.filled_at) {
      return new Date(parsed.filled_at).toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
  };

  // Smart import: handles BUY_TO_OPEN with DCA, SELL_TO_CLOSE with position matching
  const smartImport = async (
    parsed: ParsedTrade,
    sourceInboxId?: string
  ): Promise<SmartImportResult> => {
    if (!user) {
      return { data: null, error: new Error('Not authenticated'), action: null, message: 'Not authenticated' };
    }

    const isBuyToOpen = parsed.action === 'BUY_TO_OPEN' || parsed.action === 'BUY';
    const isSellToClose = parsed.action === 'SELL_TO_CLOSE' || parsed.action === 'SELL';
    const trade_type = getTradeType(parsed);
    const entry_date = getEntryDate(parsed);
    const quantity = parsed.quantity || 1;
    const price = parsed.price || 0;

    try {
      if (isBuyToOpen) {
        // BUY_TO_OPEN: Check for existing OPEN position to DCA into
        const existingOpen = await findMatchingOpenGroup({
          ticker: parsed.symbol || '',
          trade_type,
          strike_price: parsed.strike || null,
          expiration_date: parsed.expiry || null,
        });

        if (existingOpen) {
          // DCA into existing open position
          const { error } = await addToPosition(existingOpen.id, {
            quantity,
            price,
            fill_date: entry_date,
            fill_time: parsed.filled_at ? new Date(parsed.filled_at).toTimeString().substring(0, 5) : null,
            source: 'email_import',
            source_inbox_id: sourceInboxId,
          });

          if (error) throw error;

          const newQty = existingOpen.remaining_qty + quantity;
          const newAvg = ((existingOpen.avg_entry_price * existingOpen.remaining_qty) + (price * quantity)) / newQty;

          return {
            data: existingOpen,
            error: null,
            action: 'added_to_position',
            message: `Added ${quantity}x ${parsed.symbol} @ $${price.toFixed(2)} to existing position. Now ${newQty}x @ $${newAvg.toFixed(2)} avg.`,
          };
        } else {
          // No existing open position - create new
          const { data, error } = await createGroupDirect({
            ticker: parsed.symbol || '',
            trade_type,
            strike_price: parsed.strike || null,
            expiration_date: parsed.expiry || null,
            entry_date,
            entry_time: parsed.filled_at ? new Date(parsed.filled_at).toTimeString().substring(0, 5) : null,
            quantity,
            price,
            notes: parsed.broker ? `Imported from ${parsed.broker}` : 'Imported via email',
            source: 'email_import',
            source_inbox_id: sourceInboxId,
          });

          if (error) throw error;

          return {
            data,
            error: null,
            action: 'created',
            message: `Opened new position: ${quantity}x ${parsed.symbol} @ $${price.toFixed(2)}`,
          };
        }
      } else if (isSellToClose) {
        // For SELL_TO_CLOSE, find ANY matching open position (FIFO)
        let sellQuery = supabase
          .from('trade_groups')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'open')
          .eq('ticker', parsed.symbol || '')
          .eq('trade_type', trade_type)
          .order('entry_date', { ascending: true }); // FIFO - close oldest first

        if (activePortfolioId) {
          sellQuery = sellQuery.eq('portfolio_id', activePortfolioId);
        }

        const { data: openGroups, error: searchError } = await sellQuery;

        if (searchError) throw searchError;

        // Filter for matching strike/expiration if options
        let matchingGroups = openGroups || [];
        if (trade_type !== 'stock') {
          matchingGroups = matchingGroups.filter(g => {
            const strikeMatch = !parsed.strike || g.strike_price === parsed.strike;
            const expiryMatch = !parsed.expiry || g.expiration_date === parsed.expiry;
            return strikeMatch && expiryMatch;
          });
        }

        if (matchingGroups.length > 0) {
          // Close from oldest position first (FIFO)
          const targetGroup = matchingGroups[0];
          
          const { error } = await closePosition(targetGroup.id, {
            quantity,
            price,
            fill_date: entry_date,
            fill_time: parsed.filled_at ? new Date(parsed.filled_at).toTimeString().substring(0, 5) : null,
            source: 'email_import',
            source_inbox_id: sourceInboxId,
          });

          if (error) throw error;

          const remainingQty = targetGroup.remaining_qty - quantity;
          const multiplier = trade_type === 'stock' ? 1 : 100;
          const pnl = (price - targetGroup.avg_entry_price) * quantity * multiplier;

          return {
            data: { ...targetGroup, status: targetGroup.status as 'open' | 'closed' },
            error: null,
            action: 'closed',
            message: remainingQty > 0
              ? `Closed ${quantity}/${targetGroup.remaining_qty} ${parsed.symbol} @ $${price.toFixed(2)} (PnL: $${pnl.toFixed(2)}). ${remainingQty} remaining.`
              : `Closed position: ${parsed.symbol} @ $${price.toFixed(2)} (PnL: $${pnl.toFixed(2)})`,
          };
        } else {
          // No matching open position - BLOCK the import
          return {
            data: null,
            error: new Error('No matching open position found'),
            action: null,
            message: `Cannot import SELL_TO_CLOSE: No matching open position found for ${quantity}x ${parsed.symbol}${trade_type !== 'stock' ? ` $${parsed.strike} ${parsed.expiry}` : ''}. Please import the BUY_TO_OPEN trade first.`,
          };
        }
      } else {
        // Unknown action - create as new position
        const { data, error } = await createGroupDirect({
          ticker: parsed.symbol || '',
          trade_type,
          strike_price: parsed.strike || null,
          expiration_date: parsed.expiry || null,
          entry_date,
          entry_time: parsed.filled_at ? new Date(parsed.filled_at).toTimeString().substring(0, 5) : null,
          quantity,
          price,
          notes: `Imported: ${parsed.action || 'Unknown action'}`,
          source: 'email_import',
          source_inbox_id: sourceInboxId,
        });

        if (error) throw error;

        return {
          data,
          error: null,
          action: 'created',
          message: `Created position: ${quantity}x ${parsed.symbol} @ $${price.toFixed(2)}`,
        };
      }
    } catch (error) {
      console.error('Smart import error:', error);
      return {
        data: null,
        error: error as Error,
        action: null,
        message: 'Failed to import trade',
      };
    }
  };

  return {
    smartImport,
  };
};
