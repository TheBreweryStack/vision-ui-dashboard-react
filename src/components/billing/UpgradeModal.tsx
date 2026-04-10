import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Coffee, Sparkles, Crown, Loader2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature?: string;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({ 
  open, 
  onOpenChange,
  feature = 'this feature'
}) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState<'monthly' | 'lifetime' | null>(null);

  const handleCheckout = async (plan: 'monthly' | 'lifetime') => {
    setIsLoading(plan);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { 
          planId: 'premium', 
          priceType: plan,
          successUrl: `${window.location.origin}/billing/success`,
          cancelUrl: `${window.location.origin}/pricing?payment=cancelled`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
        onOpenChange(false);
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast.error('Failed to start checkout. Please try again.');
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Coffee className="h-8 w-8 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-xl">Upgrade to continue trading ☕</DialogTitle>
          <DialogDescription className="text-center">
            {feature} is available on Monthly or Lifetime plans.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-4">
          <Button
            onClick={() => navigate('/pricing')}
            variant="outline"
            className="w-full"
          >
            View Pricing
          </Button>

          <Button
            onClick={() => handleCheckout('monthly')}
            disabled={isLoading !== null}
            className="w-full"
          >
            {isLoading === 'monthly' ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Upgrade to Monthly ($10/mo)
          </Button>

          <Button
            onClick={() => handleCheckout('lifetime')}
            disabled={isLoading !== null}
            variant="secondary"
            className="w-full bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isLoading === 'lifetime' ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Crown className="h-4 w-4 mr-2" />
            )}
            Get Lifetime ($199 one-time)
          </Button>

          <Button
            onClick={() => onOpenChange(false)}
            variant="ghost"
            className="w-full text-muted-foreground"
          >
            Not now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradeModal;
