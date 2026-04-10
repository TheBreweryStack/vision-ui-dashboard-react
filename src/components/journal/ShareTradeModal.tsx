import { useState } from 'react';
import { format } from 'date-fns';
import { Copy, Check, Share2, Link, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { TickerLogo } from '@/components/common/TickerLogo';
import { supabase, Trade } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

interface ShareTradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trade: Trade;
}

export function ShareTradeModal({ open, onOpenChange, trade }: ShareTradeModalProps) {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [copied, setCopied] = useState(false);

  const generateShareCode = () => {
    // Generate a random 8-character code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleShare = async () => {
    if (!user) return;
    
    setIsGenerating(true);
    try {
      // Check if share already exists
      const { data: existingShare } = await supabase
        .from('trade_shares')
        .select('share_code')
        .eq('trade_id', trade.id)
        .eq('shared_by', user.id)
        .maybeSingle();

      if (existingShare) {
        setShareCode(existingShare.share_code);
        return;
      }

      // Create new share
      const code = generateShareCode();
      const { error } = await supabase
        .from('trade_shares')
        .insert({
          trade_id: trade.id,
          shared_by: user.id,
          share_code: code,
          is_public: isPublic,
          expires_at: null, // No expiration for now
        });

      if (error) throw error;

      setShareCode(code);
      toast.success('Share link created!');
    } catch (error) {
      logger.error('Error creating share:', error);
      toast.error('Failed to create share link');
    } finally {
      setIsGenerating(false);
    }
  };

  const shareUrl = shareCode 
    ? `${window.location.origin}/shared/${shareCode}`
    : null;

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const multiplier = trade.trade_type === 'stock' ? 1 : 100;
  const pnl = trade.pnl || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Share2 className="h-5 w-5 text-primary" />
            Share Trade
          </DialogTitle>
          <DialogDescription>
            Share this trade with others via a unique link
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Trade Preview */}
          <div className="p-4 rounded-xl bg-background border border-border">
            <div className="flex items-center gap-3 mb-3">
              <TickerLogo symbol={trade.ticker} size="lg" />
              <div>
                <p className="font-semibold">{trade.ticker}</p>
                <p className="text-sm text-muted-foreground capitalize">
                  {trade.trade_type} • {trade.quantity} contract{trade.quantity > 1 ? 's' : ''}
                </p>
              </div>
              {trade.status === 'closed' && pnl !== 0 && (
                <div className={cn(
                  'ml-auto font-semibold',
                  pnl >= 0 ? 'text-profit' : 'text-loss'
                )}>
                  {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Entry:</span>
                <span className="ml-2">${trade.entry_price.toFixed(2)}</span>
              </div>
              {trade.exit_price && (
                <div>
                  <span className="text-muted-foreground">Exit:</span>
                  <span className="ml-2">${trade.exit_price.toFixed(2)}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Date:</span>
                <span className="ml-2">{format(new Date(trade.entry_date), 'MMM d, yyyy')}</span>
              </div>
            </div>
          </div>

          {/* Public/Private Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border">
            <div>
              <p className="text-sm font-medium">Public Link</p>
              <p className="text-xs text-muted-foreground">Anyone with the link can view</p>
            </div>
            <Switch
              checked={isPublic}
              onCheckedChange={setIsPublic}
              disabled={!!shareCode}
            />
          </div>

          {/* Share Link */}
          {shareCode ? (
            <div className="space-y-2">
              <Label>Share Link</Label>
              <div className="flex gap-2">
                <Input
                  value={shareUrl || ''}
                  readOnly
                  className="bg-background border-border font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  className="shrink-0"
                  aria-label="Copy"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-profit" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Share code: <span className="font-mono font-semibold">{shareCode}</span>
              </p>
            </div>
          ) : (
            <Button
              onClick={handleShare}
              disabled={isGenerating}
              className="w-full bg-primary hover:bg-primary/90"
            >
              {isGenerating ? (
                'Creating...'
              ) : (
                <>
                  <Link className="h-4 w-4 mr-2" />
                  Generate Share Link
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}