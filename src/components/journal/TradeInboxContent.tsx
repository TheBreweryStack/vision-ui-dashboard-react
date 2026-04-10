import React, { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTradeInbox } from '@/hooks/useTradeInbox';
import { useSmartTradeImport } from '@/hooks/useSmartTradeImport';
import { TradeInboxItem, ParsedTrade, GmailVerificationData, isGmailVerification, getMissingFields, getSourceDisplayName } from '@/lib/tradeInbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { TickerLogo } from '@/components/common/TickerLogo';
import { 
  Inbox, ChevronLeft, Check, X, AlertCircle, ExternalLink, 
  Copy, Mail, Clock, CheckCircle2, XCircle, Edit3, 
  Loader2, FileText, AlertTriangle, CheckSquare, Square, Undo2
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface TradeInboxContentProps {
  mode: 'dialog' | 'page';
  initialItemId?: string | null;
  onClose?: () => void;
}

export const TradeInboxContent: React.FC<TradeInboxContentProps> = ({ 
  mode, 
  initialItemId,
  onClose 
}) => {
  const queryClient = useQueryClient();
  const { items, isLoading, counts, updateStatus, deleteItem, refetch } = useTradeInbox();
  const { smartImport } = useSmartTradeImport();
  
  const [activeTab, setActiveTab] = useState<string>('pending');
  const [selectedItem, setSelectedItem] = useState<TradeInboxItem | null>(null);
  const [isImporting, setIsImporting] = useState<string | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  
  // Batch selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchImporting, setIsBatchImporting] = useState(false);
  
  // Animation state for removing cards
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editedTrade, setEditedTrade] = useState<Partial<ParsedTrade>>({});
  const pendingEditModeRef = useRef(false);

  // Auto-select item from URL param
  useEffect(() => {
    if (initialItemId && items.length > 0) {
      const item = items.find(i => i.id === initialItemId);
      if (item) {
        setSelectedItem(item);
        if (item.status === 'pending' || item.status === 'needs_review' || item.status === 'action_required') {
          setActiveTab('pending');
        } else if (item.status === 'imported') {
          setActiveTab('imported');
        } else if (item.status === 'ignored') {
          setActiveTab('ignored');
        } else if (item.status === 'failed') {
          setActiveTab('failed');
        }
      }
    }
  }, [initialItemId, items]);

  // Initialize edit state when selecting an item
  useEffect(() => {
    if (selectedItem && !isGmailVerification(selectedItem.parsed_trade)) {
      setEditedTrade(selectedItem.parsed_trade as ParsedTrade || {});
      // Only reset editing if we didn't request edit mode
      if (pendingEditModeRef.current) {
        setIsEditing(true);
        pendingEditModeRef.current = false;
      } else {
        setIsEditing(false);
      }
    }
  }, [selectedItem]);

  // Helper to animate card removal
  const animateRemoval = (id: string): Promise<void> => {
    return new Promise((resolve) => {
      setRemovingIds(prev => new Set(prev).add(id));
      setTimeout(() => {
        setRemovingIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        resolve();
      }, 250); // Match animation duration
    });
  };

  // Handlers
  const handleImport = async (item: TradeInboxItem, overrideParsed?: Partial<ParsedTrade>) => {
    if (isGmailVerification(item.parsed_trade)) return;
    
    setIsImporting(item.id);
    try {
      const tradeData = overrideParsed 
        ? { ...(item.parsed_trade as ParsedTrade), ...overrideParsed }
        : item.parsed_trade as ParsedTrade;
      
      const result = await smartImport(tradeData, item.id);
      
      if (result.data && !result.error) {
        // Animate removal before updating status
        await animateRemoval(item.id);
        await updateStatus(item.id, 'imported', result.data.id);
        toast.success(result.message);
        queryClient.invalidateQueries({ queryKey: ['trade-groups'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
        queryClient.invalidateQueries({ queryKey: ['journal-data'] });
        queryClient.invalidateQueries({ queryKey: ['trades'] });
        setSelectedItem(null);
        setDetailDialogOpen(false);
        setIsEditing(false);
        onClose?.();
      } else {
        await updateStatus(item.id, 'failed');
        toast.error(result.message || 'Import failed');
      }
    } catch (error) {
      logger.error('Error importing trade:', error);
      toast.error('Failed to import trade');
    } finally {
      setIsImporting(null);
    }
  };

  const handleBatchImport = async () => {
    const pendingItems = getFilteredItems('pending').filter(i => selectedIds.has(i.id));
    if (pendingItems.length === 0) return;
    
    setIsBatchImporting(true);
    let successCount = 0;
    let failCount = 0;
    
    for (const item of pendingItems) {
      try {
        const result = await smartImport(item.parsed_trade as ParsedTrade, item.id);
        if (result.data && !result.error) {
          await updateStatus(item.id, 'imported', result.data.id);
          successCount++;
        } else {
          await updateStatus(item.id, 'failed');
          failCount++;
        }
      } catch {
        await updateStatus(item.id, 'failed');
        failCount++;
      }
    }
    
    setIsBatchImporting(false);
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ['trade-groups'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
    queryClient.invalidateQueries({ queryKey: ['journal-data'] });
    
    if (successCount > 0) {
      toast.success(`Imported ${successCount} trade${successCount > 1 ? 's' : ''}`);
    }
    if (failCount > 0) {
      toast.error(`${failCount} trade${failCount > 1 ? 's' : ''} failed to import`);
    }
  };

  const handleIgnore = async (item: TradeInboxItem) => {
    try {
      // Animate removal before updating status
      await animateRemoval(item.id);
      await updateStatus(item.id, 'ignored');
      toast.success('Trade ignored');
      setSelectedItem(null);
    } catch (error) {
      logger.error('Error ignoring trade:', error);
    }
  };

  const handleUndo = async (item: TradeInboxItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await updateStatus(item.id, 'pending');
      toast.success('Moved back to pending');
    } catch (error) {
      logger.error('Error undoing:', error);
      toast.error('Failed to undo');
    }
  };

  const toggleSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    const pendingItems = getFilteredItems('pending');
    const importableItems = pendingItems.filter(i => getMissingFields(i.parsed_trade as ParsedTrade).length === 0);
    
    if (selectedIds.size === importableItems.length && importableItems.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(importableItems.map(i => i.id)));
    }
  };

  const getFilteredItems = (status: string) => {
    return items.filter(i => {
      if (isGmailVerification(i.parsed_trade)) return false;
      if (status === 'pending') {
        return i.status === 'pending' || i.status === 'needs_review' || i.status === 'action_required';
      }
      return i.status === status;
    });
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-profit';
    if (confidence >= 0.5) return 'text-yellow-500';
    return 'text-loss';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.5) return 'Medium';
    return 'Low';
  };

  // Gmail Verification Card
  const renderGmailVerificationCard = (item: TradeInboxItem) => {
    const data = item.parsed_trade as GmailVerificationData;
    const confirmUrl = data?.confirm_url;
    
    return (
      <div 
        key={item.id}
        className="p-3 border border-border rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Mail className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-sm text-foreground">Gmail Forwarding Verification</h4>
              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                Action Required
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Confirm to start importing trades automatically.
            </p>
            {confirmUrl && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => window.open(confirmUrl, '_blank')}
                  className="bg-primary hover:bg-primary/90 h-7 text-xs"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => {
                    navigator.clipboard.writeText(confirmUrl);
                    toast.success('Link copied');
                  }}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Trade Card
  const renderTradeCard = (item: TradeInboxItem) => {
    if (isGmailVerification(item.parsed_trade)) {
      return renderGmailVerificationCard(item);
    }
    
    const parsed = item.parsed_trade as ParsedTrade | null;
    const missingFields = getMissingFields(parsed);
    const sourceName = getSourceDisplayName(item.source, parsed);
    const isImportingThis = isImporting === item.id;
    const isSelected = selectedIds.has(item.id);
    const canImport = missingFields.length === 0;
    const isPending = item.status === 'pending' || item.status === 'needs_review';
    const isRemoving = removingIds.has(item.id);
    
    const getStatusBadge = () => {
      switch (item.status) {
        case 'imported':
          return <Badge className="bg-profit/20 text-profit border-0 text-xs px-1.5 py-0"><CheckCircle2 className="h-3 w-3 mr-0.5" />Imported</Badge>;
        case 'ignored':
          return <Badge variant="secondary" className="text-xs px-1.5 py-0"><XCircle className="h-3 w-3 mr-0.5" />Ignored</Badge>;
        case 'failed':
          return <Badge className="bg-loss/20 text-loss border-0 text-xs px-1.5 py-0"><AlertTriangle className="h-3 w-3 mr-0.5" />Failed</Badge>;
        case 'needs_review':
          return <Badge variant="outline" className="border-yellow-500/30 text-yellow-500 text-xs px-1.5 py-0"><AlertCircle className="h-3 w-3 mr-0.5" />Review</Badge>;
        case 'action_required':
          return <Badge variant="outline" className="border-primary/30 text-primary text-xs px-1.5 py-0"><AlertCircle className="h-3 w-3 mr-0.5" />Action</Badge>;
        default:
          return <Badge variant="outline" className="text-xs px-1.5 py-0"><Clock className="h-3 w-3 mr-0.5" />Pending</Badge>;
      }
    };

    return (
      <div 
        key={item.id}
        onClick={() => setSelectedItem(item)}
        className={cn(
          "p-3 border border-border rounded-lg transition-all cursor-pointer",
          "hover:bg-secondary/50 hover:border-primary/30",
          selectedItem?.id === item.id && "border-primary bg-secondary/50",
          isSelected && "bg-primary/5 border-primary/50",
          isRemoving && "animate-fade-out opacity-0 scale-95 pointer-events-none"
        )}
        style={{ 
          transition: isRemoving ? 'opacity 0.25s ease-out, transform 0.25s ease-out' : undefined 
        }}
      >
        <div className="flex items-center gap-4">
          {/* LEFT: Trade info */}
          <div className="flex-1 min-w-0">
            {/* Row 1: Ticker, type, strike, source - all inline */}
            <div className="flex items-center gap-2 flex-wrap">
              {isPending && canImport && (
                <div onClick={(e) => toggleSelection(item.id, e)} className="shrink-0">
                  <Checkbox checked={isSelected} className="h-4 w-4" />
                </div>
              )}
              {parsed?.symbol && (
                <TickerLogo symbol={parsed.symbol} size="sm" className="shrink-0" />
              )}
              <span className="font-semibold text-foreground">{parsed?.symbol || 'Unknown'}</span>
              {parsed?.put_call && (
                <Badge variant="outline" className="text-[10px] uppercase px-1.5 py-0 h-4">
                  {parsed.put_call}
                </Badge>
              )}
              {parsed?.strike && <span className="text-sm text-muted-foreground">${parsed.strike}</span>}
              <span className="text-xs text-muted-foreground/60">{sourceName}</span>
            </div>
            
            {/* Row 2: Action, quantity, price */}
            <div className="flex items-center gap-2 mt-1">
              <span className={cn(
                "text-sm font-medium",
                parsed?.action?.toLowerCase().includes('buy') ? "text-profit" : "text-loss"
              )}>
                {parsed?.action?.replace(/_/g, ' ').toUpperCase() || 'Trade'}
              </span>
              {parsed?.quantity && (
                <span className="text-sm text-muted-foreground">
                  {parsed.quantity} {parsed.quantity === 1 ? 'contract' : 'contracts'}
                </span>
              )}
              {parsed?.price && (
                <span className="text-sm text-muted-foreground">
                  ${parsed.price.toFixed(2)}
                </span>
              )}
            </div>
            
            {/* Row 3: Date/time */}
            <p className="text-xs text-muted-foreground/70 mt-1">
              {format(parseISO(item.received_at), 'MMM d, h:mm a')}
              {parsed?.expiry && <span className="ml-2">• Exp: {parsed.expiry}</span>}
            </p>
            
            {/* Row 4: Status indicator or missing fields */}
            <div className="flex items-center gap-2 mt-1">
              {missingFields.length > 0 && item.status !== 'imported' && item.status !== 'ignored' ? (
                <div className="flex items-center gap-1 text-xs text-yellow-500">
                  <AlertCircle className="h-3 w-3" />
                  Missing: {missingFields.join(', ')}
                </div>
              ) : isPending ? (
                <div className="flex items-center gap-1 text-xs text-profit">
                  <Clock className="h-3 w-3" />
                  Ready to import
                </div>
              ) : item.status === 'imported' ? (
                <div className="flex items-center gap-1 text-xs text-profit">
                  <Check className="h-3 w-3" />
                  Imported
                </div>
              ) : item.status === 'ignored' ? (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <X className="h-3 w-3" />
                  Ignored
                </div>
              ) : null}
            </div>
          </div>
          
          {/* RIGHT: Action buttons (stacked vertically) */}
          <div className="flex flex-col gap-1.5 shrink-0">
            {isPending && (
              <>
                <Button
                  size="sm"
                  disabled={isImportingThis || !canImport}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleImport(item);
                  }}
                  className="bg-primary hover:bg-primary/90 h-7 px-3 text-xs"
                >
                  {isImportingThis ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Import
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    pendingEditModeRef.current = true;
                    setSelectedItem(item);
                  }}
                  className="h-7 px-3 text-xs"
                >
                  <Edit3 className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleIgnore(item);
                  }}
                  className="h-7 px-3 text-xs text-muted-foreground hover:text-loss"
                >
                  <X className="h-3 w-3 mr-1" />
                  Ignore
                </Button>
              </>
            )}
            
            {item.status === 'imported' && (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => handleUndo(item, e)}
                className="h-7 px-3 text-xs text-muted-foreground hover:text-foreground"
              >
                <Undo2 className="h-3 w-3 mr-1" />
                Undo
              </Button>
            )}
            
            {item.status === 'ignored' && (
              <>
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    pendingEditModeRef.current = true;
                    setSelectedItem(item);
                  }}
                  className="bg-primary hover:bg-primary/90 h-7 px-3 text-xs"
                >
                  <Check className="h-3 w-3 mr-1" />
                  Import
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => handleUndo(item, e)}
                  className="h-7 px-3 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Undo2 className="h-3 w-3 mr-1" />
                  Restore
                </Button>
              </>
            )}
            
            {item.status === 'failed' && (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => handleUndo(item, e)}
                className="h-7 px-3 text-xs text-muted-foreground hover:text-foreground"
              >
                <Undo2 className="h-3 w-3 mr-1" />
                Retry
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Detail View with Edit Mode
  const renderDetailView = () => {
    if (!selectedItem) return null;
    
    const parsed = selectedItem.parsed_trade as ParsedTrade | null;
    const isGmailVer = isGmailVerification(selectedItem.parsed_trade);
    const editedMissingFields = getMissingFields(editedTrade as ParsedTrade);
    const isImportingThis = isImporting === selectedItem.id;
    const isPending = selectedItem.status === 'pending' || selectedItem.status === 'needs_review';
    
    return (
      <div className="space-y-3">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSelectedItem(null);
            setIsEditing(false);
          }}
          className="-ml-2 h-7"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        
        {isGmailVer ? (
          renderGmailVerificationCard(selectedItem)
        ) : (
          <>
            {/* Trade header */}
            <div className="flex items-start gap-3">
              {(editedTrade.symbol || parsed?.symbol) && (
                <TickerLogo symbol={editedTrade.symbol || parsed?.symbol || ''} size="lg" />
              )}
              <div className="flex-1">
                <h3 className="text-lg font-bold text-foreground">
                  {editedTrade.symbol || parsed?.symbol || 'Unknown Trade'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {(editedTrade.action || parsed?.action)?.replace(/_/g, ' ').toUpperCase()}
                </p>
              </div>
              {isPending && (
                <Button
                  size="sm"
                  variant={isEditing ? "default" : "outline"}
                  onClick={() => setIsEditing(!isEditing)}
                  className="h-7"
                >
                  <Edit3 className="h-3 w-3 mr-1" />
                  {isEditing ? 'Editing' : 'Edit'}
                </Button>
              )}
            </div>
            
            {/* Edit form or display grid */}
            {isEditing ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Symbol</Label>
                  <Input
                    value={editedTrade.symbol || ''}
                    onChange={(e) => setEditedTrade({ ...editedTrade, symbol: e.target.value.toUpperCase() })}
                    className="h-8 text-sm"
                    placeholder="e.g. AAPL"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Action</Label>
                  <Select
                    value={editedTrade.action || ''}
                    onValueChange={(v) => setEditedTrade({ ...editedTrade, action: v as ParsedTrade['action'] })}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BUY_TO_OPEN">Buy to Open</SelectItem>
                      <SelectItem value="SELL_TO_CLOSE">Sell to Close</SelectItem>
                      <SelectItem value="BUY">Buy</SelectItem>
                      <SelectItem value="SELL">Sell</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Quantity</Label>
                  <Input
                    type="number"
                    value={editedTrade.quantity || ''}
                    onChange={(e) => setEditedTrade({ ...editedTrade, quantity: parseInt(e.target.value) || undefined })}
                    className="h-8 text-sm"
                    placeholder="1"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editedTrade.price || ''}
                    onChange={(e) => setEditedTrade({ ...editedTrade, price: parseFloat(e.target.value) || undefined })}
                    className="h-8 text-sm"
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={editedTrade.put_call || 'none'}
                    onValueChange={(v) => setEditedTrade({ 
                      ...editedTrade, 
                      put_call: v === 'none' ? null : v as 'CALL' | 'PUT',
                      instrument_type: v === 'none' ? 'stock' : 'option'
                    })}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Stock/Option" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Stock</SelectItem>
                      <SelectItem value="CALL">Call</SelectItem>
                      <SelectItem value="PUT">Put</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Strike</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={editedTrade.strike || ''}
                    onChange={(e) => setEditedTrade({ ...editedTrade, strike: parseFloat(e.target.value) || undefined })}
                    className="h-8 text-sm"
                    placeholder="0.00"
                    disabled={!editedTrade.put_call}
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Expiration</Label>
                  <Input
                    type="date"
                    value={editedTrade.expiry || ''}
                    onChange={(e) => setEditedTrade({ ...editedTrade, expiry: e.target.value || undefined })}
                    className="h-8 text-sm"
                    disabled={!editedTrade.put_call}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-sm">
                {(editedTrade.quantity || parsed?.quantity) && (
                  <div className="p-2 rounded-lg bg-secondary/50">
                    <p className="text-muted-foreground text-[10px]">Quantity</p>
                    <p className="font-semibold text-sm">{editedTrade.quantity || parsed?.quantity}</p>
                  </div>
                )}
                {(editedTrade.price || parsed?.price) && (
                  <div className="p-2 rounded-lg bg-secondary/50">
                    <p className="text-muted-foreground text-[10px]">Price</p>
                    <p className="font-semibold text-sm">${(editedTrade.price || parsed?.price)?.toFixed(2)}</p>
                  </div>
                )}
                {(editedTrade.put_call || parsed?.put_call) && (
                  <div className="p-2 rounded-lg bg-secondary/50">
                    <p className="text-muted-foreground text-[10px]">Type</p>
                    <p className="font-semibold text-sm uppercase">{editedTrade.put_call || parsed?.put_call}</p>
                  </div>
                )}
                {(editedTrade.strike || parsed?.strike) && (
                  <div className="p-2 rounded-lg bg-secondary/50">
                    <p className="text-muted-foreground text-[10px]">Strike</p>
                    <p className="font-semibold text-sm">${editedTrade.strike || parsed?.strike}</p>
                  </div>
                )}
                {(editedTrade.expiry || parsed?.expiry) && (
                  <div className="p-2 rounded-lg bg-secondary/50">
                    <p className="text-muted-foreground text-[10px]">Expiration</p>
                    <p className="font-semibold text-sm">{editedTrade.expiry || parsed?.expiry}</p>
                  </div>
                )}
                {parsed?.filled_at && (
                  <div className="p-2 rounded-lg bg-secondary/50">
                    <p className="text-muted-foreground text-[10px]">Trade Date</p>
                    <p className="font-semibold text-sm">{format(new Date(parsed.filled_at), 'MMM d, yyyy')}</p>
                  </div>
                )}
              </div>
            )}
            
            {/* Missing fields warning */}
            {editedMissingFields.length > 0 && (
              <div className="flex items-start gap-2 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <AlertCircle className="h-3.5 w-3.5 text-yellow-500 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-yellow-500">Missing Information</p>
                  <p className="text-[10px] text-muted-foreground">
                    {editedMissingFields.join(', ')}
                  </p>
                </div>
              </div>
            )}
            
            {/* Raw data preview */}
            {selectedItem.raw_text && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDetailDialogOpen(true)}
                className="text-muted-foreground h-7 text-xs"
              >
                <FileText className="h-3 w-3 mr-1" />
                View Raw Email
              </Button>
            )}
            
            {/* Actions */}
            {isPending && (
              <div className="flex items-center gap-2 pt-3 border-t border-border">
                <Button
                  disabled={isImportingThis || editedMissingFields.length > 0}
                  onClick={() => handleImport(selectedItem, editedTrade)}
                  className="flex-1 bg-primary hover:bg-primary/90"
                >
                  {isImportingThis ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Import{isEditing ? ' with Edits' : ''}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => handleIgnore(selectedItem)}
                >
                  <X className="h-4 w-4 mr-2" />
                  Ignore
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // List View
  const renderListView = () => {
    const pendingCount = counts.pending + counts.needs_review + counts.action_required;
    const gmailVerification = items.find(i => i.source === 'gmail_verification' && i.status === 'action_required');
    const pendingItems = getFilteredItems('pending');
    const importableItems = pendingItems.filter(i => getMissingFields(i.parsed_trade as ParsedTrade).length === 0);
    const allSelected = selectedIds.size === importableItems.length && importableItems.length > 0;
    
    return (
      <div className="flex flex-col min-h-0">
        {/* Gmail verification banner */}
        {gmailVerification && (
          <div className="shrink-0 mb-2">
            {renderGmailVerificationCard(gmailVerification)}
          </div>
        )}
        
        <Tabs 
          value={activeTab} 
          onValueChange={(v) => { setActiveTab(v); setSelectedIds(new Set()); }}
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="w-full grid grid-cols-4 bg-secondary/50 h-10 shrink-0">
            <TabsTrigger value="pending" className="text-xs font-medium px-2">
              Pending ({pendingCount})
            </TabsTrigger>
            <TabsTrigger value="imported" className="text-xs font-medium px-2">
              Imported ({counts.imported})
            </TabsTrigger>
            <TabsTrigger value="ignored" className="text-xs font-medium px-2">
              Ignored ({counts.ignored})
            </TabsTrigger>
            <TabsTrigger value="failed" className="text-xs font-medium px-2">
              Failed ({counts.failed})
            </TabsTrigger>
          </TabsList>
          
          {/* Batch actions bar */}
          {activeTab === 'pending' && importableItems.length > 0 && (
            <div className="shrink-0 flex items-center justify-between py-2 px-1 border-b border-border/50">
              <button 
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                {allSelected ? (
                  <CheckSquare className="h-4 w-4 text-primary" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                Select All ({importableItems.length})
              </button>
              {selectedIds.size > 0 && (
                <Button
                  size="sm"
                  disabled={isBatchImporting}
                  onClick={handleBatchImport}
                  className="h-7 px-2.5 text-xs bg-primary hover:bg-primary/90"
                >
                  {isBatchImporting ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Check className="h-3 w-3 mr-1" />
                  )}
                  Import {selectedIds.size}
                </Button>
              )}
            </div>
          )}
          
          <div className="flex-1 min-h-0 overflow-y-auto scroll-area">
              <TabsContent value="pending" className="mt-1 space-y-1">
                {isLoading ? (
                  <div className="flex items-center justify-center py-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : pendingItems.length === 0 ? (
                  <div className="text-center py-3">
                    <Inbox className="h-5 w-5 text-muted-foreground/50 mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">No pending trades</p>
                  </div>
                ) : (
                  pendingItems.map(renderTradeCard)
                )}
              </TabsContent>
              
              <TabsContent value="imported" className="mt-1 space-y-1">
                {getFilteredItems('imported').length === 0 ? (
                  <div className="text-center py-3">
                    <CheckCircle2 className="h-5 w-5 text-muted-foreground/50 mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">No imported trades yet</p>
                  </div>
                ) : (
                  getFilteredItems('imported').map(renderTradeCard)
                )}
              </TabsContent>
              
              <TabsContent value="ignored" className="mt-1 space-y-1">
                {getFilteredItems('ignored').length === 0 ? (
                  <div className="text-center py-3">
                    <XCircle className="h-5 w-5 text-muted-foreground/50 mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">No ignored trades</p>
                  </div>
                ) : (
                  getFilteredItems('ignored').map(renderTradeCard)
                )}
              </TabsContent>
              
              <TabsContent value="failed" className="mt-1 space-y-1">
                {getFilteredItems('failed').length === 0 ? (
                  <div className="text-center py-3">
                    <AlertTriangle className="h-5 w-5 text-muted-foreground/50 mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">No failed imports</p>
                  </div>
                ) : (
                  getFilteredItems('failed').map(renderTradeCard)
                )}
              </TabsContent>
          </div>
        </Tabs>
      </div>
    );
  };

  return (
    <>
      <div className={cn(
        mode === 'dialog' 
          ? 'flex flex-col min-h-0 p-3' 
          : 'content-card flex flex-col max-h-[calc(100vh-200px)] min-h-0 p-3'
      )}>
        {selectedItem ? renderDetailView() : renderListView()}
      </div>
      
      {/* Raw detail dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] bg-card border-border">
          <DialogHeader>
            <DialogTitle>Raw Email Content</DialogTitle>
          </DialogHeader>
          <div className="h-[60vh] overflow-y-auto scroll-area">
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap p-4 bg-secondary/50 rounded-lg">
              {selectedItem?.raw_text || 'No raw content available'}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
