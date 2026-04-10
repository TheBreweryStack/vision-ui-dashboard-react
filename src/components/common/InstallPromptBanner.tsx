import React, { useState, useEffect } from 'react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { X, Smartphone, Share } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Smart install prompt banner that appears on mobile browsers
 * - Shows native install prompt on Android/Chrome
 * - Shows iOS instructions for Safari
 * - Dismissible for 7 days
 */
export const InstallPromptBanner: React.FC = () => {
  const { canInstall, isInstalled, isIOS, isDismissed, promptInstall, dismiss } = useInstallPrompt();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // Delay showing the banner for better UX
  useEffect(() => {
    // Don't show if already installed, dismissed, or not on mobile
    if (isInstalled || isDismissed || !isMobile) {
      setIsVisible(false);
      return;
    }

    // Show only if we can install (Android) or it's iOS
    if (!canInstall && !isIOS) {
      setIsVisible(false);
      return;
    }

    // Delay showing by 5 seconds for better UX
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, [canInstall, isInstalled, isIOS, isDismissed, isMobile]);

  if (!isVisible) return null;

  const handleInstall = async () => {
    if (isIOS) {
      // Navigate to install page for iOS instructions
      navigate('/install');
      dismiss();
      return;
    }

    setIsInstalling(true);
    const success = await promptInstall();
    setIsInstalling(false);
    
    if (success) {
      setIsVisible(false);
    }
  };

  const handleDismiss = () => {
    dismiss();
    setIsVisible(false);
  };

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-card border border-border rounded-xl shadow-lg p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            {isIOS ? (
              <Share className="h-5 w-5 text-primary" />
            ) : (
              <Smartphone className="h-5 w-5 text-primary" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-sm">
              {isIOS ? 'Add to Home Screen' : 'Get the TraderCafé app'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isIOS 
                ? 'Tap Share, then "Add to Home Screen"'
                : 'Install for faster access and offline mode'
              }
            </p>
          </div>

          {/* Dismiss button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 -mt-1 -mr-2"
            aria-label="Dismiss"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Action button */}
        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            onClick={handleInstall}
            disabled={isInstalling}
            className="w-full sm:w-auto"
          >
            {isInstalling ? 'Installing...' : isIOS ? 'Show Me How' : 'Install Now'}
          </Button>
        </div>
      </div>
    </div>
  );
};
