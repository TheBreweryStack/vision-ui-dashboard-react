import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { TradeInboxItem, ParsedTrade, GmailVerificationData } from '@/lib/tradeInbox';
import { logger } from '@/lib/logger';

const fetchTradeInbox = async (userId: string): Promise<TradeInboxItem[]> => {
  const { data, error } = await supabase
    .from('trade_inbox')
    .select('*')
    .eq('user_id', userId)
    .order('received_at', { ascending: false });
  
  if (error) throw error;
  
  return (data || []).map(item => ({
    id: item.id,
    user_id: item.user_id,
    source: item.source,
    source_message_id: item.source_message_id,
    source_hash: item.source_hash,
    raw_payload: typeof item.raw_payload === 'object' && item.raw_payload !== null && !Array.isArray(item.raw_payload) 
      ? item.raw_payload as Record<string, unknown> 
      : null,
    raw_text: item.raw_text,
    parsed_trade: item.parsed_trade as (ParsedTrade | GmailVerificationData) | null,
    status: item.status as TradeInboxItem['status'],
    confidence: item.confidence,
    errors: item.errors,
    received_at: item.received_at,
    imported_trade_id: item.imported_trade_id,
    imported_group_id: (item as typeof item & { imported_group_id?: string | null }).imported_group_id,
  }));
};

export const useTradeInbox = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['trade-inbox', user?.id];

  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchTradeInbox(user!.id),
    enabled: !!user,
    staleTime: 30000, // 30 seconds - data shared across components
  });

  const updateStatus = async (id: string, status: TradeInboxItem['status'], importedGroupId?: string) => {
    try {
      const updateData: Record<string, unknown> = { status };
      if (importedGroupId) {
        updateData.imported_group_id = importedGroupId;
      }

      const { error } = await supabase
        .from('trade_inbox')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
      
      // Optimistically update cache
      queryClient.setQueryData<TradeInboxItem[]>(queryKey, (prev) =>
        prev?.map(item =>
          item.id === id ? { ...item, status, imported_group_id: importedGroupId || item.imported_group_id } : item
        )
      );
    } catch (error) {
      logger.error('Error updating trade inbox item:', error);
      toast.error('Failed to update item');
      throw error;
    }
  };

  const deleteItem = async (id: string) => {
    try {
      const { error } = await supabase
        .from('trade_inbox')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      // Optimistically update cache
      queryClient.setQueryData<TradeInboxItem[]>(queryKey, (prev) =>
        prev?.filter(item => item.id !== id)
      );
      toast.success('Item deleted');
    } catch (error) {
      logger.error('Error deleting trade inbox item:', error);
      toast.error('Failed to delete item');
    }
  };

  const counts = {
    pending: items.filter(i => i.status === 'pending').length,
    needs_review: items.filter(i => i.status === 'needs_review').length,
    imported: items.filter(i => i.status === 'imported').length,
    ignored: items.filter(i => i.status === 'ignored').length,
    failed: items.filter(i => i.status === 'failed').length,
    system: items.filter(i => i.status === 'system').length,
    action_required: items.filter(i => i.status === 'action_required').length,
  };

  const gmailVerification = items.find(i => i.source === 'gmail_verification' && i.status === 'action_required');

  return {
    items,
    isLoading,
    counts,
    gmailVerification,
    updateStatus,
    deleteItem,
    refetch,
  };
};