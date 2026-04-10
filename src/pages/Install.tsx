import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Smartphone, Apple, Chrome, Share, Plus, MoreVertical,
  Download, CheckCircle2, ArrowLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';
import appIcon from '@/assets/app-icon.png';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const Install: React.FC = () => {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');

  useEffect(() => {
    // Detect platform
    const userAgent = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setPlatform('ios');
    } else if (/android/.test(userAgent)) {
      setPlatform('android');
    } else {
      setPlatform('desktop');
    }

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    
    setDeferredPrompt(null);
  };

  const Step = ({ number, title, description, icon: Icon }: { 
    number: number; 
    title: string; 
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }) => (
    <div className="flex gap-4 items-start">
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
        {number}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-foreground">{title}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-8 pb-24 md:pb-6 animate-in max-w-2xl mx-auto">
      {/* Back Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/auth')}
        className="text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Sign In
      </Button>

      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <img 
            src={appIcon} 
            alt="TraderCafé" 
            className="w-20 h-20 rounded-2xl shadow-xl"
          />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          Install TraderCafé
        </h1>
        <p className="text-muted-foreground">
          Add TraderCafé to your home screen for the best experience
        </p>

        {isInstalled && (
          <Badge className="bg-profit/10 text-profit border-profit/30">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Already Installed
          </Badge>
        )}
      </div>

      {/* Install Button (Chrome/Android) */}
      {deferredPrompt && !isInstalled && (
        <div className="content-card text-center">
          <Button 
            onClick={handleInstallClick}
            size="lg"
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25"
          >
            <Download className="h-5 w-5 mr-2" />
            Install Now
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            Click to add TraderCafé to your device
          </p>
        </div>
      )}

      {/* Platform-specific instructions */}
      <div className="space-y-6">
        {/* iOS Instructions */}
        <div className={cn(
          "content-card",
          platform === 'ios' && "border-primary ring-2 ring-primary/20"
        )}>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-secondary">
              <Apple className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">iPhone & iPad (Safari)</h2>
              {platform === 'ios' && (
                <Badge variant="outline" className="text-xs mt-1">Your Device</Badge>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <Step 
              number={1} 
              title="Open in Safari" 
              description="Make sure you're viewing this page in Safari (not Chrome or another browser)"
              icon={Chrome}
            />
            <Step 
              number={2} 
              title="Tap the Share button" 
              description="Tap the Share icon at the bottom of the screen (square with arrow pointing up)"
              icon={Share}
            />
            <Step 
              number={3} 
              title="Add to Home Screen" 
              description="Scroll down and tap 'Add to Home Screen', then tap 'Add' in the top right"
              icon={Plus}
            />
          </div>
        </div>

        {/* Android Instructions */}
        <div className={cn(
          "content-card",
          platform === 'android' && "border-primary ring-2 ring-primary/20"
        )}>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-secondary">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Android (Chrome)</h2>
              {platform === 'android' && (
                <Badge variant="outline" className="text-xs mt-1">Your Device</Badge>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <Step 
              number={1} 
              title="Open in Chrome" 
              description="Make sure you're viewing this page in Chrome browser"
              icon={Chrome}
            />
            <Step 
              number={2} 
              title="Tap the menu" 
              description="Tap the three dots (⋮) in the top right corner of Chrome"
              icon={MoreVertical}
            />
            <Step 
              number={3} 
              title="Install app" 
              description="Tap 'Install app' or 'Add to Home screen' and confirm"
              icon={Download}
            />
          </div>
        </div>

        {/* Desktop Instructions */}
        <div className={cn(
          "content-card",
          platform === 'desktop' && "border-primary ring-2 ring-primary/20"
        )}>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-secondary">
              <Chrome className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Desktop (Chrome/Edge)</h2>
              {platform === 'desktop' && (
                <Badge variant="outline" className="text-xs mt-1">Your Device</Badge>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <Step 
              number={1} 
              title="Look for install icon" 
              description="Look for the install icon in the address bar (right side)"
              icon={Download}
            />
            <Step 
              number={2} 
              title="Click Install" 
              description="Click the install button and confirm in the popup"
              icon={Plus}
            />
          </div>
        </div>
      </div>

      {/* Benefits */}
      <div className="content-card">
        <h2 className="font-semibold text-foreground mb-4">Why install?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-profit shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Faster Access</p>
              <p className="text-sm text-muted-foreground">Launch instantly from your home screen</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-profit shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Works Offline</p>
              <p className="text-sm text-muted-foreground">Access your data even without internet</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-profit shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Full Screen</p>
              <p className="text-sm text-muted-foreground">No browser UI, feels like a native app</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-profit shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Notifications</p>
              <p className="text-sm text-muted-foreground">Get alerts for reminders and watchlist</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Install;
