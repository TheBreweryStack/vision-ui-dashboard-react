import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  BookOpen, 
  BarChart3, 
  Eye, 
  Settings, 
  ChevronLeft, 
  ChevronRight, 
  Coffee,
  Sparkles,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface OnboardingGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

const steps = [
  {
    icon: Coffee,
    title: 'Welcome to TraderCafé',
    description: 'Your personal trading journal designed to help you track, analyze, and improve your trading performance.',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  {
    icon: BookOpen,
    title: 'Journal Your Trades',
    description: 'Log every trade with entry/exit prices, track open positions, and document your strategy. Use the Close Week feature to snapshot your weekly performance.',
    color: 'text-profit',
    bgColor: 'bg-profit/10',
  },
  {
    icon: BarChart3,
    title: 'Analyze Performance',
    description: 'Review your win rate, average profit/loss, and identify patterns in your trading. The Analytics page provides deep insights into your trading behavior.',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  {
    icon: Eye,
    title: 'Watch the Market',
    description: 'Create watchlists to monitor stocks, set price alerts, and stay on top of market news for your favorite tickers.',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
  },
  {
    icon: Settings,
    title: 'Customize Your Experience',
    description: 'Set your starting balance, weekly goals, timezone, and notification preferences in Settings. Connect your email to auto-import trades.',
    color: 'text-muted-foreground',
    bgColor: 'bg-secondary',
  },
];

export const OnboardingGuide: React.FC<OnboardingGuideProps> = ({
  open,
  onOpenChange,
  onComplete,
}) => {
  const { user, updateProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = async () => {
    if (!user) return;
    setIsUpdating(true);
    try {
      const dismissUntil = new Date();
      dismissUntil.setHours(dismissUntil.getHours() + 24);
      
      await updateProfile({ 
        onboarding_dismissed_until: dismissUntil.toISOString() 
      });
      
      onOpenChange(false);
      setCurrentStep(0);
    } catch (error) {
      logger.error('Error dismissing onboarding:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemindLater = async () => {
    // Dismiss for 24 hours
    await handleSkip();
    toast.info("We'll remind you tomorrow!");
  };

  const handleComplete = async () => {
    if (!user) return;
    setIsUpdating(true);
    try {
      const { error } = await updateProfile({ 
        onboarding_completed: true,
        onboarding_dismissed_until: null 
      });
      
      if (error) throw error;
      
      toast.success('Welcome aboard! Enjoy TraderCafé ☕');
      onOpenChange(false);
      setCurrentStep(0);
      onComplete?.();
    } catch (error) {
      logger.error('Error completing onboarding:', error);
      toast.error('Failed to save progress');
    } finally {
      setIsUpdating(false);
    }
  };

  const currentStepData = steps[currentStep];
  const Icon = currentStepData.icon;
  const isLastStep = currentStep === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Getting Started
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {/* Step Content */}
          <div className="text-center space-y-4">
            <div className={cn(
              "w-16 h-16 rounded-2xl mx-auto flex items-center justify-center",
              currentStepData.bgColor
            )}>
              <Icon className={cn("h-8 w-8", currentStepData.color)} />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">
                {currentStepData.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed px-4">
                {currentStepData.description}
              </p>
            </div>
          </div>

          {/* Step Indicators */}
          <div className="flex items-center justify-center gap-2 mt-6">
            {steps.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all duration-200",
                  index === currentStep 
                    ? "w-6 bg-primary" 
                    : index < currentStep
                    ? "bg-primary/50"
                    : "bg-border"
                )}
              />
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-2">
            {currentStep > 0 ? (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handlePrev}
                disabled={isUpdating}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            ) : (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleRemindLater}
                disabled={isUpdating}
              >
                Remind Me Later
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            {!isLastStep && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleSkip}
                disabled={isUpdating}
              >
                Skip
              </Button>
            )}
            
            {isLastStep ? (
              <Button 
                onClick={handleComplete}
                disabled={isUpdating}
                className="bg-primary hover:bg-primary/90"
              >
                <Check className="h-4 w-4 mr-1" />
                Complete
              </Button>
            ) : (
              <Button 
                onClick={handleNext}
                disabled={isUpdating}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
