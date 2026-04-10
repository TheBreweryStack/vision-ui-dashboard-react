import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWatchlists } from '@/hooks/useWatchlists';
import { useFinnhub } from '@/hooks/useFinnhub';
import { useFinnhubWebSocket } from '@/hooks/useFinnhubWebSocket';
import { Watchlist as WatchlistType, WatchlistItem } from '@/lib/supabase';
import { CompanyDetailSheet } from '@/components/watchlist/CompanyDetailSheet';
import { WatchlistItemCard } from '@/components/watchlist/WatchlistItemCard';
import { PriceAlertModal, ALERT_TYPES } from '@/components/watchlist/PriceAlertModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Plus, Eye, Trash2,
  Loader2, FolderPlus, List, RefreshCw,
  Radio, Star
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface Alert {
  id: string;
  alert_type: string;
  threshold: number | null;
  target_value: number | null;
  fast_period: number | null;
  slow_period: number | null;
  is_active: boolean;
  watchlist_item_id: string;
}

const Watchlist: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { 
    watchlists, 
    items, 
    isLoading, 
    createWatchlist, 
    deleteWatchlist, 
    addItem, 
    updateItem, 
    deleteItem, 
    fetchItems,
    setDefaultWatchlist,
    getDefaultWatchlist,
  } = useWatchlists();
  
  const { quotes, isLoading: quotesLoading, fetchQuotes } = useFinnhub();
  const { prices: realtimePrices, isConnected: wsConnected, subscribe, unsubscribe } = useFinnhubWebSocket();
  
  const [activeWatchlist, setActiveWatchlist] = useState<WatchlistType | null>(null);
  const [showWatchlistModal, setShowWatchlistModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<WatchlistItem | null>(null);
  const [editItem, setEditItem] = useState<WatchlistItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Company detail sidebar
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  // Watchlist form
  const [watchlistName, setWatchlistName] = useState('');
  const [watchlistDesc, setWatchlistDesc] = useState('');

  // Item form
  const [ticker, setTicker] = useState('');
  const [notes, setNotes] = useState('');

  // Alert form - enhanced with all types
  const [alertType, setAlertType] = useState<string>('price_above');
  const [alertThreshold, setAlertThreshold] = useState('');
  const [alertEnabled, setAlertEnabled] = useState(true);
  const [fastEma, setFastEma] = useState('9');
  const [slowEma, setSlowEma] = useState('21');

  // Item alerts - enhanced to store all alert data
  const [itemAlerts, setItemAlerts] = useState<Record<string, Alert>>({});

  // Handle ?ticker= query parameter from notes "View on Watchlist" link
  useEffect(() => {
    const tickerParam = searchParams.get('ticker');
    if (tickerParam && items.length > 0) {
      const upperTicker = tickerParam.toUpperCase();
      const found = items.find(i => i.ticker === upperTicker);
      if (found) {
        setSelectedTicker(upperTicker);
      } else {
        // Ticker not in current watchlist - prompt to add
        toast(`${upperTicker} not in watchlist`, {
          description: 'Would you like to add it?',
          action: {
            label: 'Add Now',
            onClick: () => {
              setTicker(upperTicker);
              setShowItemModal(true);
            },
          },
        });
      }
      // Clear the param after handling
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, items, setSearchParams]);

  // Load items when watchlist changes
  useEffect(() => {
    if (activeWatchlist) {
      fetchItems(activeWatchlist.id);
    }
  }, [activeWatchlist, fetchItems]);

  // Select default watchlist on load
  useEffect(() => {
    if (watchlists.length > 0 && !activeWatchlist) {
      const defaultWl = getDefaultWatchlist();
      setActiveWatchlist(defaultWl);
    }
  }, [watchlists, activeWatchlist, getDefaultWatchlist]);

  // Fetch quotes and alerts when items change, and subscribe to WebSocket
  useEffect(() => {
    if (items.length > 0) {
      const symbols = items.map(item => item.ticker);
      fetchQuotes(symbols);
      fetchItemAlerts();

      // Subscribe to real-time updates
      subscribe(symbols);

      return () => {
        unsubscribe(symbols);
      };
    }
  }, [items, fetchQuotes, subscribe, unsubscribe, fetchItemAlerts]);

  const fetchItemAlerts = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .eq('user_id', user.id)
      .in('watchlist_item_id', items.map(i => i.id));

    if (!error && data) {
      const alertMap: Record<string, Alert> = {};
      data.forEach(alert => {
        alertMap[alert.watchlist_item_id] = alert;
      });
      setItemAlerts(alertMap);
    }
  }, [items]);

  const handleRefreshQuotes = () => {
    if (items.length > 0) {
      const symbols = items.map(item => item.ticker);
      fetchQuotes(symbols);
    }
  };

  const handleTickerClick = (symbol: string) => {
    setSelectedTicker((prev) => (prev === symbol ? null : symbol));
  };

  const resetWatchlistForm = () => {
    setWatchlistName('');
    setWatchlistDesc('');
  };

  const resetItemForm = () => {
    setTicker('');
    setNotes('');
    setEditItem(null);
  };

  const openItemModal = (item?: WatchlistItem) => {
    if (item) {
      setEditItem(item);
      setTicker(item.ticker);
      setNotes(item.notes || '');
    } else {
      resetItemForm();
    }
    setShowItemModal(true);
  };

  const openAlertModal = (item: WatchlistItem) => {
    setSelectedItem(item);
    const existingAlert = itemAlerts[item.id];
    if (existingAlert) {
      setAlertType(existingAlert.alert_type);
      setAlertThreshold(existingAlert.threshold?.toString() || existingAlert.target_value?.toString() || '');
      setAlertEnabled(existingAlert.is_active);
      setFastEma(existingAlert.fast_period?.toString() || '9');
      setSlowEma(existingAlert.slow_period?.toString() || '21');
    } else {
      setAlertType('price_above');
      setAlertThreshold('');
      setAlertEnabled(true);
      setFastEma('9');
      setSlowEma('21');
    }
    setShowAlertModal(true);
  };

  const handleCreateWatchlist = async () => {
    if (!watchlistName.trim()) return;
    setIsSaving(true);
    try {
      const result = await createWatchlist(watchlistName, watchlistDesc);
      if (result.data) {
        setActiveWatchlist(result.data);
      }
      setShowWatchlistModal(false);
      resetWatchlistForm();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteWatchlist = async (id: string) => {
    if (!confirm('Delete this watchlist and all its items?')) return;
    await deleteWatchlist(id);
    if (activeWatchlist?.id === id) {
      setActiveWatchlist(watchlists.find(w => w.id !== id) || null);
    }
  };

  const handleSaveItem = async () => {
    if (!ticker.trim() || !activeWatchlist) return;
    setIsSaving(true);
    try {
      const data = {
        ticker: ticker.toUpperCase(),
        notes: notes || undefined,
      };

      if (editItem) {
        await updateItem(editItem.id, data);
      } else {
        await addItem(activeWatchlist.id, data);
      }
      setShowItemModal(false);
      resetItemForm();
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAlert = async () => {
    if (!selectedItem) return;
    
    const alertConfig = ALERT_TYPES.find(t => t.value === alertType);
    const needsValue = alertConfig?.needsValue ?? true;
    const needsPeriods = alertConfig?.needsPeriods ?? false;
    
    // Validate required fields
    if (needsValue && !alertThreshold) {
      toast.error('Please enter a value for the alert');
      return;
    }
    
    setIsSaving(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const existingAlert = itemAlerts[selectedItem.id];
      
      // Build alert data
      const alertData: Record<string, string | number | boolean | null> = {
        alert_type: alertType,
        is_active: alertEnabled,
        threshold: null,
        target_value: null,
        fast_period: null,
        slow_period: null,
      };
      
      if (needsValue) {
        if (alertType === 'price_above' || alertType === 'price_below') {
          alertData.target_value = parseFloat(alertThreshold);
        } else {
          alertData.threshold = parseFloat(alertThreshold);
        }
      }
      
      if (needsPeriods) {
        alertData.fast_period = parseInt(fastEma, 10);
        alertData.slow_period = parseInt(slowEma, 10);
      }

      if (existingAlert) {
        // Update existing alert
        const { error } = await supabase
          .from('alerts')
          .update(alertData)
          .eq('id', existingAlert.id);

        if (error) throw error;
        toast.success('Alert updated');
      } else {
        // Create new alert
        const { error } = await supabase
          .from('alerts')
          .insert({
            user_id: user.id,
            watchlist_item_id: selectedItem.id,
            ...alertData,
          });

        if (error) throw error;
        toast.success('Alert created');
      }

      fetchItemAlerts();
      setShowAlertModal(false);
    } catch (error: unknown) {
      logger.error('Alert save error:', error);
      toast.error('Failed to save alert');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAlert = async () => {
    if (!selectedItem) return;
    const existingAlert = itemAlerts[selectedItem.id];
    if (!existingAlert) return;

    try {
      const { error } = await supabase
        .from('alerts')
        .delete()
        .eq('id', existingAlert.id);

      if (error) throw error;
      toast.success('Alert deleted');
      fetchItemAlerts();
      setShowAlertModal(false);
    } catch (error) {
      toast.error('Failed to delete alert');
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (confirm('Remove this ticker?')) {
      await deleteItem(id);
    }
  };

  // Helper to get alert display label
  const getAlertLabel = (alert: Alert) => {
    const config = ALERT_TYPES.find(t => t.value === alert.alert_type);
    if (!config) return alert.alert_type;
    
    if (alert.target_value) {
      return `${config.label.replace(' $', '')} $${alert.target_value}`;
    }
    if (alert.threshold) {
      return `${config.label.replace(' %', '')} ${alert.threshold}%`;
    }
    if (alert.fast_period && alert.slow_period) {
      return `${config.label} (${alert.fast_period}/${alert.slow_period})`;
    }
    return config.label;
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Watchlists</h1>
          <p className="page-subtitle hidden sm:block">Track your favorite tickers and set price alerts</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Live indicator */}
          {wsConnected && items.length > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-profit/10 text-profit text-xs font-medium">
              <Radio className="h-3 w-3 animate-pulse" />
              Live
            </div>
          )}
          {items.length > 0 && (
            <Button 
              variant="outline"
              size="sm"
              onClick={handleRefreshQuotes}
              disabled={quotesLoading}
              className="btn-glass border-0 h-9"
            >
              <RefreshCw className={cn("h-4 w-4", quotesLoading && "animate-spin")} />
            </Button>
          )}
          <Button 
            variant="outline"
            size="sm"
            onClick={() => setShowWatchlistModal(true)}
            className="btn-glass border-0 h-9"
          >
            <FolderPlus className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">New List</span>
          </Button>
          {activeWatchlist && (
            <Button 
              size="sm"
              onClick={() => openItemModal()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 h-9"
            >
              <Plus className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Add Ticker</span>
            </Button>
          )}
        </div>
      </div>

      {/* Watchlist Tabs */}
      {watchlists.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {watchlists.map(wl => (
            <button
              key={wl.id}
              onClick={() => setActiveWatchlist(wl)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2",
                activeWatchlist?.id === wl.id
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "bg-secondary/50 text-muted-foreground hover:text-foreground border border-transparent"
              )}
            >
              {wl.is_default ? (
                <Star className="h-3.5 w-3.5 fill-current" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
              {wl.name}
            </button>
          ))}
        </div>
      )}

      {/* Active Watchlist Header */}
      {activeWatchlist && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{activeWatchlist.name}</h2>
              {activeWatchlist.description && (
                <p className="text-sm text-muted-foreground">{activeWatchlist.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Set as Default Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDefaultWatchlist(activeWatchlist.id)}
              className={cn(
                "text-muted-foreground hover:text-primary",
                activeWatchlist.is_default && "text-primary"
              )}
              title={activeWatchlist.is_default ? "Default watchlist" : "Set as default"}
            >
              <Star className={cn("h-4 w-4", activeWatchlist.is_default && "fill-current")} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDeleteWatchlist(activeWatchlist.id)}
              className="text-muted-foreground hover:text-loss"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}


      {/* Items Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : activeWatchlist ? (
        items.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(item => (
              <WatchlistItemCard
                key={item.id}
                item={item}
                quote={quotes[item.ticker]}
                rtPrice={realtimePrices[item.ticker]}
                alert={itemAlerts[item.id]}
                quotesLoading={quotesLoading}
                isSelected={selectedTicker === item.ticker}
                onSelect={handleTickerClick}
                onOpenAlert={openAlertModal}
                onOpenEdit={openItemModal}
                onDelete={handleDeleteItem}
                getAlertLabel={getAlertLabel}
              />
            ))}
          </div>
        ) : (
          <div className="content-card text-center py-12">
            <List className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">No tickers in this watchlist yet.</p>
            <Button 
              onClick={() => openItemModal()}
              className="mt-4 bg-primary hover:bg-primary/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Ticker
            </Button>
          </div>
        )
      ) : (
        <div className="content-card text-center py-12">
          <Eye className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">Create your first watchlist to start tracking tickers!</p>
          <Button 
            onClick={() => setShowWatchlistModal(true)}
            className="bg-primary hover:bg-primary/90"
          >
            <FolderPlus className="h-4 w-4 mr-2" />
            Create Watchlist
          </Button>
        </div>
      )}

      {/* Create Watchlist Modal */}
      <Dialog open={showWatchlistModal} onOpenChange={setShowWatchlistModal}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>New Watchlist</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wlName">Name</Label>
              <Input
                id="wlName"
                value={watchlistName}
                onChange={(e) => setWatchlistName(e.target.value)}
                placeholder="My Watchlist"
                className="bg-secondary/50 border-border/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wlDesc">Description (optional)</Label>
              <Textarea
                id="wlDesc"
                value={watchlistDesc}
                onChange={(e) => setWatchlistDesc(e.target.value)}
                placeholder="Track high-momentum tech stocks..."
                rows={2}
                className="bg-secondary/50 border-border/50 resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWatchlistModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateWatchlist}
              disabled={!watchlistName.trim() || isSaving}
              className="bg-primary hover:bg-primary/90"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Item Modal */}
      <Dialog open={showItemModal} onOpenChange={setShowItemModal}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Edit Ticker' : 'Add Ticker'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ticker">Ticker Symbol</Label>
              <Input
                id="ticker"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="AAPL"
                className="bg-secondary/50 border-border/50 uppercase"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Watching for earnings..."
                rows={2}
                className="bg-secondary/50 border-border/50 resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowItemModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveItem}
              disabled={!ticker.trim() || isSaving}
              className="bg-primary hover:bg-primary/90"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editItem ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Price Alert Modal */}
      <PriceAlertModal
        open={showAlertModal}
        onOpenChange={setShowAlertModal}
        selectedItem={selectedItem}
        hasExistingAlert={!!itemAlerts[selectedItem?.id || '']}
        alertType={alertType}
        setAlertType={setAlertType}
        alertThreshold={alertThreshold}
        setAlertThreshold={setAlertThreshold}
        alertEnabled={alertEnabled}
        setAlertEnabled={setAlertEnabled}
        fastEma={fastEma}
        setFastEma={setFastEma}
        slowEma={slowEma}
        setSlowEma={setSlowEma}
        isSaving={isSaving}
        onSave={handleSaveAlert}
        onDelete={handleDeleteAlert}
      />

      {/* Company Detail Sidebar - Using Sheet for proper sizing */}
      <CompanyDetailSheet
        ticker={selectedTicker}
        quote={selectedTicker ? quotes[selectedTicker] : null}
        onClose={() => setSelectedTicker(null)}
      />
    </div>
  );
};

export default Watchlist;
