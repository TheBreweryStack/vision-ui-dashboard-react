import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEmailIngest } from '@/hooks/useEmailIngest';
import { useTradeInbox } from '@/hooks/useTradeInbox';
import { useAccessControl } from '@/hooks/useAccessControl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Mail, Copy, Check, RefreshCw, Loader2, Inbox, ExternalLink, AlertCircle, Info, ShieldCheck, Lock, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

export const EmailSyncSettings: React.FC = () => {
  const navigate = useNavigate();
  const { address, isLoading, isGenerating, generateAddress, toggleActive, regenerateAddress } = useEmailIngest();
  const { counts, gmailVerification, updateStatus } = useTradeInbox();
  const { canUseEmailIngest, isLoading: accessLoading } = useAccessControl();
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // Show locked state for free users
  if (!accessLoading && !canUseEmailIngest) {
    return (
      <div className="content-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center">
            <Lock className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">Email Trade Import</h2>
              <Badge variant="secondary" className="text-xs">Pro Feature</Badge>
            </div>
            <p className="text-sm text-muted-foreground">Automatically import trades from broker emails</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-secondary/30 border border-border/50 mb-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Mail className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground mb-1">Connect Your Broker Emails</p>
              <p className="text-sm text-muted-foreground">
                Upgrade to unlock automatic trade import from Wealthsimple confirmation emails. 
                No manual data entry required — trades appear in your inbox ready to review.
              </p>
            </div>
          </div>
        </div>

        <Button 
          onClick={() => navigate('/pricing')}
          className="w-full bg-primary hover:bg-primary/90"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Upgrade to Unlock
        </Button>
      </div>
    );
  }

  const handleCopy = () => {
    if (!address) return;
    navigator.clipboard.writeText(address.email_address);
    setCopied(true);
    toast.success('Email address copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  // Extract confirmation code from Gmail verification email
  const extractConfirmationCode = (rawText: string | null | undefined): string | null => {
    if (!rawText) return null;
    // Gmail format: "Confirmation code: XXXXXXX" or just a 9-digit number
    const codeMatch = rawText.match(/Confirmation code:\s*(\d+)/i) 
      || rawText.match(/code[:\s]+(\d{6,9})/i)
      || rawText.match(/\b(\d{9})\b/);
    return codeMatch ? codeMatch[1] : null;
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCodeCopied(true);
    toast.success('Confirmation code copied!');
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleDismissVerification = async () => {
    if (gmailVerification) {
      await updateStatus(gmailVerification.id, 'ignored');
      toast.success('Verification dismissed');
    }
  };

  const confirmationCode = gmailVerification ? extractConfirmationCode(gmailVerification.raw_text) : null;

  const pendingCount = counts.pending + counts.needs_review;

  return (
    <div className="content-card">
      <div className="flex items-center gap-3 mb-6">
        <div className="icon-box-primary">
          <Mail className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">Email Trade Import</h2>
            {pendingCount > 0 && (
              <Badge className="bg-primary text-primary-foreground">
                {pendingCount} pending
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">Import trades from Wealthsimple emails</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !address ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Generate a unique email address to forward your Wealthsimple trade confirmation emails. 
            We'll automatically parse and import your trades.
          </p>
          <Button
            onClick={generateAddress}
            disabled={isGenerating}
            className="bg-primary hover:bg-primary/90"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Mail className="h-4 w-4 mr-2" />
            )}
            Generate Email Address
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Toggle Active */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-2 w-2 rounded-full",
                address.is_active ? "bg-profit" : "bg-muted-foreground"
              )} />
              <Label htmlFor="email-sync-toggle" className="cursor-pointer">
                Email sync {address.is_active ? 'enabled' : 'disabled'}
              </Label>
            </div>
            <Switch
              id="email-sync-toggle"
              checked={address.is_active}
              onCheckedChange={toggleActive}
            />
          </div>

          {/* Gmail Verification Alert */}
          {gmailVerification && confirmationCode && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <p className="font-medium text-foreground">Gmail Forwarding Confirmation Required</p>
                  <p className="text-sm text-muted-foreground">
                    Gmail sent a verification email. Copy the confirmation code below and paste it in your Gmail settings to complete the forwarding setup.
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 p-3 rounded-lg bg-secondary/50 border border-border font-mono text-lg font-bold text-center">
                      {confirmationCode}
                    </div>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleCopyCode(confirmationCode)}
                      className="shrink-0"
                    >
                      {codeCopied ? <Check className="h-4 w-4 text-profit" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDismissVerification}
                    className="text-xs text-muted-foreground mt-2"
                  >
                    Dismiss (I've completed setup)
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Email Address Display */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Your forwarding address</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 p-3 rounded-lg bg-secondary/50 border border-border overflow-x-auto">
                <code className="font-mono text-xs sm:text-sm whitespace-nowrap">
                  {address.email_address}
                </code>
              </div>
              <Button
                size="icon"
                variant="outline"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? <Check className="h-4 w-4 text-profit" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="space-y-3 text-xs sm:text-sm">
                <p className="font-medium text-foreground">Gmail Setup Instructions:</p>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                  <li>Open Gmail Settings → <strong>Forwarding and POP/IMAP</strong></li>
                  <li>Click "Add a forwarding address" and paste in your unique forwarding address above</li>
                  <li>A confirmation email will appear in your <strong>TraderCafé Trade Inbox</strong> — confirm it there</li>
                  <li className="pt-2">
                    <strong>Create a Filter for Wealthsimple Order Fills:</strong>
                    <br />Open Gmail Settings → <strong>Filters and Blocked Addresses</strong>
                  </li>
                  <li>
                    Create a new filter with:
                    <ul className="list-disc list-inside ml-4 mt-1 space-y-0.5">
                      <li>Subject: <code className="px-1 py-0.5 rounded bg-secondary text-[10px] sm:text-xs">Your order has been filled</code></li>
                      <li>Search: <code className="px-1 py-0.5 rounded bg-secondary text-[10px] sm:text-xs">Inbox</code></li>
                    </ul>
                  </li>
                  <li>Click "Continue", then select <strong>"Forward it to:"</strong> and choose your unique address</li>
                  <li>Click <strong>Create Filter</strong></li>
                </ol>
                <p className="text-muted-foreground/80 pt-2 italic text-xs">
                  Moving forward, all Wealthsimple order fills will automatically appear in your Trade Inbox for import.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <Link to="/trade-inbox">
              <Button variant="outline" className="gap-2">
                <Inbox className="h-4 w-4" />
                View Trade Inbox
                {pendingCount > 0 && (
                  <Badge className="ml-1 bg-primary text-primary-foreground text-xs">
                    {pendingCount}
                  </Badge>
                )}
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={regenerateAddress}
              disabled={isGenerating}
              className="text-muted-foreground"
            >
              {isGenerating ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              Regenerate Address
            </Button>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
            <span>
              Regenerating will invalidate your current address. You'll need to update your Gmail filter.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
