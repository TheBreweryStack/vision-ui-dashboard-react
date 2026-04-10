import { useState, useRef } from 'react';
import { format } from 'date-fns';
import { X, ImagePlus, Loader2, ArrowUp, ArrowDown, Pencil, Check, Save } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { TickerLogo } from '@/components/common/TickerLogo';
import { TradeImageGallery } from './TradeImageGallery';
import { cn, parseDateOnly } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { TradeGroupWithFills, TradeFill } from '@/hooks/useTradeGroups';
import { logger } from '@/lib/logger';

interface TradeGroupDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: TradeGroupWithFills | null;
  onUpdateImages?: (groupId: string, images: string[]) => Promise<void>;
  onRefresh?: () => void;
}

export function TradeGroupDetailSheet({ open, onOpenChange, group, onUpdateImages, onRefresh }: TradeGroupDetailSheetProps) {
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [editingFillId, setEditingFillId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editQty, setEditQty] = useState('');
  const [isSavingFill, setIsSavingFill] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!group) return null;

  const fills = group.fills || [];
  const multiplier = group.trade_type === 'stock' ? 1 : 100;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingImage(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const uploadPromises = Array.from(files).map(async (file) => {
        if (!file.type.startsWith('image/')) {
          toast.error('Please upload image files only');
          return null;
        }

        if (file.size > 5 * 1024 * 1024) {
          toast.error('Image must be less than 5MB');
          return null;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('trade-images')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: signedUrlData } = await supabase.storage
          .from('trade-images')
          .createSignedUrl(fileName, 604800);

        return signedUrlData?.signedUrl;
      });

      const results = await Promise.all(uploadPromises);
      const validUrls = results.filter(Boolean) as string[];

      if (validUrls.length > 0) {
        const newImages = [...(group.images || []), ...validUrls];
        await onUpdateImages?.(group.id, newImages);
        toast.success(`${validUrls.length} image(s) uploaded`);
      }
    } catch (error: unknown) {
      logger.error('Image upload error:', error);
      toast.error('Failed to upload image');
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = async (index: number) => {
    const newImages = (group.images || []).filter((_, i) => i !== index);
    await onUpdateImages?.(group.id, newImages);
    toast.success('Image removed');
  };

  const handleImagesChange = async (images: string[]) => {
    await onUpdateImages?.(group.id, images);
  };

  const startEditFill = (fill: TradeFill) => {
    setEditingFillId(fill.id);
    setEditPrice(fill.price.toString());
    setEditDate(fill.fill_date);
    setEditQty(fill.qty.toString());
  };

  const cancelEditFill = () => {
    setEditingFillId(null);
    setEditPrice('');
    setEditDate('');
    setEditQty('');
  };

  const saveFillEdit = async (fillId: string) => {
    if (!editPrice || !editDate || !editQty) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsSavingFill(true);
    try {
      const { error } = await supabase
        .from('trade_fills')
        .update({
          price: parseFloat(editPrice),
          fill_date: editDate,
          qty: parseInt(editQty),
        })
        .eq('id', fillId);

      if (error) throw error;

      toast.success('Fill updated');
      setEditingFillId(null);
      onRefresh?.();
    } catch (error) {
      logger.error('Error updating fill:', error);
      toast.error('Failed to update fill');
    } finally {
      setIsSavingFill(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-card border-border overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <TickerLogo symbol={group.ticker} size="lg" />
            <div>
              <SheetTitle className="text-left">
                {group.ticker}
                {group.strike_price && <span className="text-muted-foreground"> ${group.strike_price}</span>}
              </SheetTitle>
              <p className="text-sm text-muted-foreground capitalize">
                {group.trade_type}
                {group.expiration_date && <span> • Exp: {format(parseDateOnly(group.expiration_date), 'MMM d, yyyy')}</span>}
              </p>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Status & P&L */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Status</p>
              <Badge variant="outline" className={cn(
                group.status === 'open' 
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'bg-muted text-muted-foreground'
              )}>
                {group.status.toUpperCase()}
              </Badge>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Realized P&L</p>
              <p className={cn(
                'text-xl font-bold',
                (group.realized_pnl || 0) >= 0 ? 'text-profit' : 'text-loss'
              )}>
                {(group.realized_pnl || 0) >= 0 ? '+' : ''}${(group.realized_pnl || 0).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Position Summary */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Position Summary</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">Opened</p>
                <p className="font-medium">{group.opened_qty} contracts</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">Closed</p>
                <p className="font-medium">{group.closed_qty} contracts</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">Remaining</p>
                <p className="font-medium">{group.remaining_qty} contracts</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">Entry Date</p>
                <p className="font-medium">{format(parseDateOnly(group.entry_date), 'MMM d, yyyy')}</p>
              </div>
            </div>
          </div>

          {/* Price Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Prices</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-xs text-muted-foreground">Avg Entry</p>
                <p className="font-semibold text-primary">${group.avg_entry_price.toFixed(2)}</p>
              </div>
              {group.avg_exit_price && (
                <div className={cn(
                  'p-3 rounded-lg border',
                  (group.realized_pnl || 0) >= 0 
                    ? 'bg-profit/10 border-profit/20' 
                    : 'bg-loss/10 border-loss/20'
                )}>
                  <p className="text-xs text-muted-foreground">Avg Exit</p>
                  <p className={cn(
                    'font-semibold',
                    (group.realized_pnl || 0) >= 0 ? 'text-profit' : 'text-loss'
                  )}>${group.avg_exit_price.toFixed(2)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Fills History */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-foreground">Trade History ({fills.length} fills)</h4>
              <p className="text-xs text-muted-foreground">Tap to edit</p>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {fills.map((fill) => (
                <div
                  key={fill.id}
                  className={cn(
                    'p-3 rounded-lg border transition-colors',
                    fill.effect === 'open' 
                      ? 'bg-primary/5 border-primary/20' 
                      : 'bg-muted/30 border-border',
                    editingFillId !== fill.id && 'cursor-pointer hover:bg-muted/50'
                  )}
                  onClick={() => editingFillId !== fill.id && startEditFill(fill)}
                >
                  {editingFillId === fill.id ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">Edit Fill</span>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label="Cancel edit"
                            onClick={(e) => {
                              e.stopPropagation();
                              cancelEditFill();
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-profit"
                            aria-label="Save edit"
                            disabled={isSavingFill}
                            onClick={(e) => {
                              e.stopPropagation();
                              saveFillEdit(fill.id);
                            }}
                          >
                            {isSavingFill ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-xs text-muted-foreground">Qty</label>
                          <Input
                            type="number"
                            value={editQty}
                            onChange={(e) => setEditQty(e.target.value)}
                            className="h-8 text-sm"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Price</label>
                          <Input
                            type="number"
                            step="0.01"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            className="h-8 text-sm"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Date</label>
                          <Input
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className="h-8 text-sm"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {fill.side === 'buy' ? (
                          <ArrowUp className="h-4 w-4 text-profit" />
                        ) : (
                          <ArrowDown className="h-4 w-4 text-loss" />
                        )}
                        <div>
                          <p className="text-sm font-medium">
                            {fill.side.toUpperCase()} {fill.qty} @ ${fill.price.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseDateOnly(fill.fill_date), 'MMM d, yyyy')}
                            {fill.fill_time && ` at ${fill.fill_time}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {fill.effect.toUpperCase()}
                        </Badge>
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Strategy & Notes */}
          {(group.strategy || group.notes) && (
            <div className="space-y-3">
              {group.strategy && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Strategy</p>
                  <p className="text-sm">{group.strategy}</p>
                </div>
              )}
              {group.notes && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{group.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Images */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-foreground">Screenshots</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingImage}
                className="h-8"
              >
                {isUploadingImage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <ImagePlus className="h-4 w-4 mr-1" />
                    Add
                  </>
                )}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageUpload}
              />
            </div>

            <TradeImageGallery
              images={group.images || []}
              tradeId={group.id}
              onImagesChange={handleImagesChange}
              editable={true}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
