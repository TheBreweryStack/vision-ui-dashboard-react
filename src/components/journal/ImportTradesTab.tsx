import React from 'react';
import { Mail, Mic, Camera, ChevronRight, Inbox, Lock, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTradeInbox } from '@/hooks/useTradeInbox';
import { useNavigate } from 'react-router-dom';
import { useAccessControl } from '@/hooks/useAccessControl';

interface ImportTradesTabProps {
  onClose: () => void;
}

export const ImportTradesTab: React.FC<ImportTradesTabProps> = ({ onClose }) => {
  const { counts } = useTradeInbox();
  const navigate = useNavigate();
  const { canUseEmailIngest } = useAccessControl();
  const pendingCount = counts.pending + counts.needs_review;

  const handleEmailImport = () => {
    if (!canUseEmailIngest) {
      onClose();
      navigate('/pricing');
      return;
    }
    onClose();
    navigate('/trade-inbox');
  };

  const importSources = [
    {
      id: 'email',
      name: 'Email Import (WS)',
      description: canUseEmailIngest ? 'Import from Wealthsimple emails' : 'Upgrade to unlock email imports',
      icon: canUseEmailIngest ? Mail : Lock,
      available: true, // Always clickable, but redirects to pricing if locked
      badge: !canUseEmailIngest ? 'Upgrade to Unlock' : (pendingCount > 0 ? `${pendingCount} pending` : null),
      onClick: handleEmailImport,
      isLocked: !canUseEmailIngest,
    },
    {
      id: 'voice',
      name: 'Voice Entry',
      description: 'Log trades by speaking',
      icon: Mic,
      available: false,
      badge: 'Coming Soon',
      onClick: () => {},
      isLocked: false,
    },
    {
      id: 'screenshot',
      name: 'AI Sync (Screenshots)',
      description: 'Import from trade screenshots',
      icon: Camera,
      available: false,
      badge: 'Coming Soon',
      onClick: () => {},
      isLocked: false,
    },
  ];

  return (
    <div className="p-4 space-y-4">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 mb-3">
          <Inbox className="h-6 w-6 text-primary" />
        </div>
        <h3 className="font-semibold text-foreground">Import Trades</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Choose a source to import your trades
        </p>
      </div>

      <div className="space-y-3">
        {importSources.map((source) => (
          <button
            key={source.id}
            onClick={source.onClick}
            disabled={!source.available}
            className={cn(
              "w-full p-4 rounded-xl border transition-all text-left flex items-center gap-4",
              source.available
                ? "bg-secondary/30 border-border/50 hover:border-primary/50 hover:bg-secondary/50 cursor-pointer"
                : "bg-secondary/10 border-border/30 cursor-not-allowed opacity-60"
            )}
          >
            <div className={cn(
              "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
              source.available ? "bg-primary/10" : "bg-muted/30"
            )}>
              {source.available ? (
                <source.icon className="h-5 w-5 text-primary" />
              ) : (
                <Lock className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "font-medium",
                  source.available ? "text-foreground" : "text-muted-foreground"
                )}>
                  {source.name}
                </span>
                {source.badge && (
                  <Badge 
                    variant={source.isLocked ? "secondary" : (source.available ? "default" : "outline")}
                    className={cn(
                      "text-xs",
                      source.isLocked
                        ? "bg-primary/10 text-primary border-primary/20"
                        : source.available
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground"
                    )}
                  >
                    {source.isLocked && <Crown className="h-3 w-3 mr-1" />}
                    {source.badge}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {source.description}
              </p>
            </div>

            {source.available && (
              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
            )}
          </button>
        ))}
      </div>

      <div className="pt-4 border-t border-border/50">
        <p className="text-xs text-muted-foreground text-center">
          Set up email forwarding in{' '}
          <button 
            onClick={() => { onClose(); navigate('/settings'); }}
            className="text-primary hover:underline"
          >
            Settings → Email Trade Import
          </button>
        </p>
      </div>
    </div>
  );
};
