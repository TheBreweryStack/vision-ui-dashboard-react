import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface UseInstallPromptReturn {
  canInstall: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  isDismissed: boolean;
  promptInstall: () => Promise<boolean>;
  dismiss: () => void;
}

const DISMISS_KEY = 'pwa_install_dismissed_at';
const DISMISS_DAYS = 7;

/**
 * Hook to manage PWA install prompt state
 * Handles both Android/Chrome (beforeinstallprompt) and iOS Safari (manual instructions)
 */
export function useInstallPrompt(): UseInstallPromptReturn {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Detect iOS Safari
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && 
    !('standalone' in window.navigator && (window.navigator as Navigator & { standalone: boolean }).standalone);

  // Check if already installed (PWA mode)
  useEffect(() => {
    // Check display-mode media query
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    // Check iOS standalone mode
    const isIOSStandalone = 'standalone' in window.navigator && 
      (window.navigator as Navigator & { standalone: boolean }).standalone;
    
    setIsInstalled(isStandalone || isIOSStandalone);
  }, []);

  // Check if dismissed recently
  useEffect(() => {
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const dismissDate = new Date(dismissedAt);
      const daysSinceDismiss = (Date.now() - dismissDate.getTime()) / (1000 * 60 * 60 * 24);
      setIsDismissed(daysSinceDismiss < DISMISS_DAYS);
    }
  }, []);

  // Listen for beforeinstallprompt event
  useEffect(() => {
    const handler = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Store the event for later use
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      console.log('[useInstallPrompt] beforeinstallprompt event captured');
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Also listen for successful installation
    window.addEventListener('appinstalled', () => {
      console.log('[useInstallPrompt] App was installed');
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  // Trigger the install prompt
  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      console.log('[useInstallPrompt] No deferred prompt available');
      return false;
    }

    try {
      // Show the install prompt
      await deferredPrompt.prompt();
      
      // Wait for the user's response
      const { outcome } = await deferredPrompt.userChoice;
      console.log('[useInstallPrompt] User response:', outcome);
      
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      
      // Clear the deferred prompt - it can only be used once
      setDeferredPrompt(null);
      
      return outcome === 'accepted';
    } catch (error) {
      console.error('[useInstallPrompt] Error prompting install:', error);
      return false;
    }
  }, [deferredPrompt]);

  // Dismiss the prompt for a week
  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    setIsDismissed(true);
  }, []);

  return {
    canInstall: !!deferredPrompt,
    isInstalled,
    isIOS,
    isDismissed,
    promptInstall,
    dismiss,
  };
}
