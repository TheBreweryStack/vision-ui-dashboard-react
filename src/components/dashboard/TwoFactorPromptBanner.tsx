import React, { useState, useEffect } from 'react';
import { Shield, X, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useTwoFactor } from '@/hooks/useTwoFactor';
import { TwoFactorSetupModal } from '@/components/auth/TwoFactorSetupModal';

const SESSION_DISMISS_KEY = 'tradecafe_2fa_prompt_dismissed';

export const TwoFactorPromptBanner: React.FC = () => {
  const { should2FAPrompt, is2FAMandatory, isLoading: settingsLoading } = useAppSettings();
  const { checkTwoFactorStatus, isLoading: twoFactorLoading } = useTwoFactor();
  
  const [has2FAEnabled, setHas2FAEnabled] = useState<boolean | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);

  // Check if user has 2FA enabled
  useEffect(() => {
    const check2FA = async () => {
      const status = await checkTwoFactorStatus();
      setHas2FAEnabled(status.enabled && status.verified);
    };
    check2FA();
  }, [checkTwoFactorStatus]);

  // Check session storage for dismissal (non-mandatory only)
  useEffect(() => {
    if (!is2FAMandatory) {
      const dismissed = sessionStorage.getItem(SESSION_DISMISS_KEY);
      setIsDismissed(dismissed === 'true');
    }
  }, [is2FAMandatory]);

  const handleDismiss = () => {
    if (!is2FAMandatory) {
      sessionStorage.setItem(SESSION_DISMISS_KEY, 'true');
      setIsDismissed(true);
    }
  };

  const handleSetupComplete = async () => {
    setShowSetupModal(false);
    // Re-check 2FA status
    const status = await checkTwoFactorStatus();
    setHas2FAEnabled(status.enabled && status.verified);
  };

  // Don't render if:
  // - Settings are loading
  // - 2FA prompt not enabled in app settings
  // - User already has 2FA enabled
  // - Banner was dismissed (for non-mandatory)
  if (settingsLoading || twoFactorLoading || !should2FAPrompt || has2FAEnabled === null || has2FAEnabled || (isDismissed && !is2FAMandatory)) {
    return null;
  }

  return (
    <>
      <div className="p-4 rounded-xl bg-warning/5 border border-warning/20">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
            <Shield className="h-5 w-5 text-warning" />
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground">
              {is2FAMandatory ? 'Two-Factor Authentication Required' : 'Secure Your Account'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {is2FAMandatory 
                ? 'Your organization requires two-factor authentication. Set it up to continue using the app.'
                : 'Add two-factor authentication for an extra layer of security on your account.'
              }
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button 
              size="sm" 
              onClick={() => setShowSetupModal(true)}
              className="bg-warning hover:bg-warning/90 text-warning-foreground"
            >
              Set Up 2FA
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
            
            {!is2FAMandatory && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                aria-label="Dismiss"
                onClick={handleDismiss}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <TwoFactorSetupModal 
        open={showSetupModal} 
        onOpenChange={setShowSetupModal}
        onComplete={handleSetupComplete}
      />
    </>
  );
};
