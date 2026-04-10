import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  Check, Shield, Star, 
  ChevronRight, Loader2, Coffee, Crown, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { PlanBadge } from '@/components/common/PlanBadge';

interface PricingPlan {
  id: string;
  name: string;
  subtitle: string;
  price: number;
  priceType: 'trial' | 'monthly' | 'lifetime';
  microText?: string;
  features: string[];
  popular?: boolean;
  badge?: string;
  ctaText: string;
}

const plans: PricingPlan[] = [
  {
    id: 'trial',
    name: '7-Day Free Trial',
    subtitle: 'Try your first cup on us ☕',
    price: 0,
    priceType: 'trial',
    microText: 'No credit card • Full access',
    ctaText: 'Start Free Trial',
    features: [
      'Full access to all features for 7 days',
      'Unlimited trade entries',
      'Advanced analytics',
      'Watchlists & alerts',
      'CSV import/export',
    ],
  },
  {
    id: 'monthly',
    name: 'Monthly',
    subtitle: 'Your daily brew ☕ for consistent traders',
    price: 10,
    priceType: 'monthly',
    popular: true,
    ctaText: 'Upgrade to Monthly',
    features: [
      'Unlimited trade entries',
      'Advanced analytics & performance',
      'Watchlists & alerts',
      'CSV import/export',
    ],
  },
  {
    id: 'lifetime',
    name: 'Early Supporters – Lifetime',
    subtitle: 'Pay once. Unlimited refills.',
    price: 199,
    priceType: 'lifetime',
    badge: 'Limited • Best Value',
    ctaText: 'Become an Early Supporter',
    features: [
      'Everything in Monthly',
      'Lifetime access',
      'All future updates',
      'Early access to new features',
      'Priority support',
      'Early Supporter badge',
    ],
  },
];

const Pricing: React.FC = () => {
  const { user, profile, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState<string | null>(null);

  // Use plan_status from profile for determining current plan
  const planStatus = profile?.plan_status || 'free';
  const isComped = profile?.comped_access || false;
  const isGrandfathered = profile?.grandfathered || false;
  const hasUsedTrial = profile?.has_used_trial || false;
  
  // User has full access if: monthly, lifetime, comped, or grandfathered
  const hasActivePaidPlan = planStatus === 'monthly' || planStatus === 'lifetime' || isComped || isGrandfathered;

  const handleStartTrial = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (hasUsedTrial) {
      toast.error('Trial already used. Please upgrade to continue.');
      return;
    }

    if (hasActivePaidPlan) {
      toast.info("You already have an active subscription!");
      return;
    }

    setIsLoading('trial');
    try {
      // Set trial directly in profile
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 7);

      await updateProfile({
        plan_status: 'trial',
        trial_ends_at: trialEndsAt.toISOString(),
        trial_started_at: new Date().toISOString(),
        has_used_trial: true,
      });

      toast.success('Trial started! You have 7 days of full access.');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error starting trial:', error);
      toast.error('Failed to start trial. Please try again.');
    } finally {
      setIsLoading(null);
    }
  };

  const handleSubscribe = async (plan: PricingPlan) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (hasActivePaidPlan && planStatus !== 'trial') {
      toast.info("You're already subscribed!");
      return;
    }

    // For trial plan, use the handleStartTrial function
    if (plan.priceType === 'trial') {
      return handleStartTrial();
    }
    
    setIsLoading(plan.id);
    
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { 
          planId: 'premium', 
          priceType: plan.priceType,
          successUrl: `${window.location.origin}/billing/success`,
          cancelUrl: `${window.location.origin}/pricing?payment=cancelled`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast.error('Failed to start checkout. Please try again.');
    } finally {
      setIsLoading(null);
    }
  };

  const renderCTA = (plan: PricingPlan) => {
    // For trial card
    if (plan.id === 'trial') {
      if (hasActivePaidPlan) {
        return (
          <div className="w-full text-center py-3 px-4 rounded-lg bg-muted text-muted-foreground">
            <span className="text-sm">Trial not available for subscribers</span>
          </div>
        );
      }
      
      if (hasUsedTrial) {
        return (
          <div className="w-full text-center py-3 px-4 rounded-lg bg-muted text-muted-foreground">
            <span className="text-sm">Trial already used — upgrade to continue</span>
          </div>
        );
      }

      return (
        <Button
          onClick={handleStartTrial}
          disabled={isLoading !== null}
          className="w-full bg-secondary hover:bg-secondary/80"
        >
          {isLoading === 'trial' ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          {plan.ctaText}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      );
    }

    // For paid plans
    if (hasActivePaidPlan && planStatus !== 'trial') {
      return (
        <div className="w-full text-center py-3 px-4 rounded-lg bg-profit/10 text-profit border border-profit/20">
          <span className="text-sm font-medium">You're already subscribed</span>
        </div>
      );
    }

    return (
      <Button
        onClick={() => handleSubscribe(plan)}
        disabled={isLoading !== null}
        className={cn(
          "w-full",
          plan.popular 
            ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25"
            : plan.priceType === 'lifetime'
              ? "bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-600/25"
              : "bg-secondary hover:bg-secondary/80"
        )}
      >
        {isLoading === plan.id ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : null}
        {plan.ctaText}
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-8 pb-24 md:pb-6 animate-in">
      {/* Header */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <div className="flex justify-center">
          <div className="p-3 rounded-full bg-primary/10">
            <Coffee className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">
          Choose Your Trading Edge
        </h1>
        <p className="text-muted-foreground text-lg">
          Unlock your full potential with TraderCafé. Start free and upgrade anytime.
        </p>
        {user && (
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm text-muted-foreground">Current plan:</span>
            <PlanBadge 
              planStatus={planStatus} 
              compedAccess={isComped} 
              earlySupporter={profile?.early_supporter}
              showAll
            />
          </div>
        )}
      </div>

      {/* Pricing Cards - 3 columns on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {plans.map(plan => {
          return (
            <div 
              key={plan.id}
              className={cn(
                "content-card relative overflow-hidden transition-all hover:scale-[1.02]",
                plan.popular && "border-primary ring-2 ring-primary/20",
                plan.priceType === 'lifetime' && "border-amber-600/50 ring-2 ring-amber-600/20"
              )}
            >
              {plan.popular && (
                <div className="absolute top-0 right-0">
                  <Badge className="rounded-none rounded-bl-lg bg-primary text-primary-foreground">
                    <Crown className="h-3 w-3 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}
              {plan.badge && !plan.popular && (
                <div className="absolute top-0 right-0">
                  <Badge className="rounded-none rounded-bl-lg bg-amber-600 text-white">
                    <Sparkles className="h-3 w-3 mr-1" />
                    {plan.badge}
                  </Badge>
                </div>
              )}

              <div className="p-6 space-y-6">
                {/* Plan Header */}
                <div className="space-y-2 pt-2">
                  <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground">{plan.subtitle}</p>
                </div>

                {/* Price */}
                <div className="space-y-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-foreground">
                      ${plan.price}
                    </span>
                    {plan.priceType === 'monthly' && (
                      <span className="text-muted-foreground">/ month</span>
                    )}
                    {plan.priceType === 'lifetime' && (
                      <span className="text-muted-foreground text-sm">one-time</span>
                    )}
                  </div>
                  {plan.microText && (
                    <p className="text-xs text-muted-foreground">
                      {plan.microText}
                    </p>
                  )}
                  {plan.priceType === 'lifetime' && (
                    <p className="text-xs text-amber-500">
                      Early supporter pricing. Available for a limited time.
                    </p>
                  )}
                </div>

                {/* CTA Button */}
                {renderCTA(plan)}

                {/* Features */}
                <div className="pt-4 border-t border-border/50 space-y-3">
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-profit mt-0.5 shrink-0" />
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="max-w-2xl mx-auto text-center space-y-4 pt-8">
        <div className="flex items-center justify-center gap-6 text-muted-foreground flex-wrap">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-sm">Secure payments</span>
          </div>
          <div className="flex items-center gap-2">
            <Coffee className="h-4 w-4 text-primary" />
            <span className="text-sm">Instant access</span>
          </div>
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-primary" />
            <span className="text-sm">Cancel anytime</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground italic">
          Same engine. Different keys.
        </p>
      </div>
    </div>
  );
};

export default Pricing;
