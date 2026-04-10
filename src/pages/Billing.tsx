import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Crown, Coffee, Sparkles, Calendar, 
  ExternalLink, Loader2, AlertCircle 
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { PlanBadge, RoleBadge } from '@/components/common/PlanBadge';
import { logger } from '@/lib/logger';

const Billing: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, userRole } = useAuth();
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);

  const planStatus = profile?.plan_status || 'free';
  const isComped = profile?.comped_access || false;
  const isGrandfathered = profile?.grandfathered || false;
  const isEarlySupporter = profile?.early_supporter || false;
  const isAdmin = userRole?.role === 'admin' || userRole?.role === 'owner';
  const renewalDate = profile?.stripe_current_period_end;
  const stripeStatus = profile?.stripe_status;

  const hasFullAccess = planStatus === 'monthly' || planStatus === 'lifetime' || isComped || isGrandfathered || isAdmin;

  const handleManageSubscription = async () => {
    setIsLoadingPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;

      // Handle different response actions
      if (data?.action === 'portal' && data?.url) {
        window.open(data.url, '_blank');
      } else if (data?.action) {
        // Non-portal action - show message as toast
        toast.info(data.message || 'No action needed');
        if (data.redirect_url) {
          navigate(data.redirect_url);
        }
      } else if (data?.url) {
        // Fallback for legacy response format
        window.open(data.url, '_blank');
      } else if (data?.error) {
        toast.error(data.error);
      } else {
        toast.info(data?.message || 'No subscription to manage');
      }
    } catch (error) {
      logger.error('Error opening portal:', error);
      toast.error('Unable to open billing portal. Please try again.');
    } finally {
      setIsLoadingPortal(false);
    }
  };

  // Determine which action button to show
  const showManageButton = planStatus === 'monthly' && profile?.stripe_customer_id;
  const showUpgradeButton = (planStatus === 'free' || planStatus === 'expired' || planStatus === 'trial') && !hasFullAccess;
  const showLifetimeText = planStatus === 'lifetime';
  const showCompedText = isComped;
  const showAdminText = isAdmin && planStatus !== 'monthly' && planStatus !== 'lifetime';

  const getPlanDisplay = () => {
    if (isAdmin) {
      return {
        label: 'Admin Access',
        description: 'Full access as admin (bypasses billing)',
        badge: 'Admin',
        badgeVariant: 'default' as const,
        icon: Crown,
      };
    }
    
    if (isComped) {
      return {
        label: 'Comped Access',
        description: profile?.comped_reason || 'Full access granted by admin',
        badge: 'Comped',
        badgeVariant: 'secondary' as const,
        icon: Sparkles,
      };
    }

    if (isGrandfathered) {
      return {
        label: 'Grandfathered',
        description: 'Legacy full access',
        badge: 'Grandfathered',
        badgeVariant: 'outline' as const,
        icon: Crown,
      };
    }

    switch (planStatus) {
      case 'lifetime':
        return {
          label: 'Lifetime Access',
          description: isEarlySupporter ? 'Early Supporter - Lifetime' : 'One-time purchase, forever access',
          badge: isEarlySupporter ? 'Early Supporter' : 'Lifetime',
          badgeVariant: 'default' as const,
          icon: Crown,
        };
      case 'monthly':
        return {
          label: 'Monthly Subscription',
          description: renewalDate 
            ? `Renews on ${format(new Date(renewalDate), 'MMM d, yyyy')}`
            : 'Active subscription',
          badge: 'Monthly',
          badgeVariant: 'default' as const,
          icon: Coffee,
        };
      case 'trial':
        return {
          label: 'Free Trial',
          description: profile?.trial_ends_at 
            ? `Ends ${format(new Date(profile.trial_ends_at), 'MMM d, yyyy')}`
            : 'Trial period active',
          badge: 'Trial',
          badgeVariant: 'secondary' as const,
          icon: Coffee,
        };
      case 'expired':
        return {
          label: 'Subscription Expired',
          description: 'Upgrade to continue accessing premium features',
          badge: 'Expired',
          badgeVariant: 'destructive' as const,
          icon: AlertCircle,
        };
      default:
        return {
          label: 'Free Plan',
          description: 'Upgrade to unlock all features',
          badge: 'Free',
          badgeVariant: 'outline' as const,
          icon: Coffee,
        };
    }
  };

  const planInfo = getPlanDisplay();
  const PlanIcon = planInfo.icon;

  // Show cancellation notice if subscription is set to cancel
  const showCancelNotice = stripeStatus === 'canceled' || 
    (stripeStatus?.includes && stripeStatus.includes('cancel'));

  return (
    <div className="p-4 md:p-6 space-y-6 pb-24 md:pb-6 animate-in">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Billing & Subscription</h1>
        <p className="text-muted-foreground">Manage your TraderCafé subscription</p>
      </div>

      {/* Current Plan Card */}
      <Card className="p-6 space-y-6">
        {/* Plan Summary with Badges */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-primary/10">
              <PlanIcon className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold text-foreground">{planInfo.label}</h2>
                {isAdmin && <RoleBadge role={userRole?.role} />}
                <PlanBadge 
                  planStatus={planStatus} 
                  compedAccess={isComped} 
                  earlySupporter={isEarlySupporter}
                  showAll
                />
              </div>
              <p className="text-sm text-muted-foreground">{planInfo.description}</p>
            </div>
          </div>
        </div>

        {showCancelNotice && renewalDate && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">
              <AlertCircle className="h-4 w-4 inline mr-1" />
              Cancels on {format(new Date(renewalDate), 'MMM d, yyyy')}
            </p>
          </div>
        )}

        {/* Stripe Details */}
        {profile?.stripe_customer_id && (
          <div className="p-3 rounded-lg bg-muted space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium capitalize">{stripeStatus || 'Active'}</span>
            </div>
            {renewalDate && planStatus === 'monthly' && !showCancelNotice && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Next billing date</span>
                <span className="font-medium">{format(new Date(renewalDate), 'MMM d, yyyy')}</span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          {showManageButton && (
            <Button 
              variant="outline" 
              onClick={handleManageSubscription}
              disabled={isLoadingPortal}
            >
              {isLoadingPortal ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              Manage Subscription
            </Button>
          )}

          {showUpgradeButton && (
            <Button onClick={() => navigate('/pricing')}>
              <Sparkles className="h-4 w-4 mr-2" />
              Upgrade
            </Button>
          )}

          {showLifetimeText && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Crown className="h-4 w-4 text-amber-500" />
              Lifetime access — no subscription to manage
            </div>
          )}

          {showCompedText && !showLifetimeText && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                Comped access — no billing to manage
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/pricing')}>
                Upgrade anyway
              </Button>
            </div>
          )}

          {showAdminText && !showCompedText && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Crown className="h-4 w-4 text-amber-500" />
              Admin access — billing bypassed
            </div>
          )}
        </div>
      </Card>

      {/* View Pricing Link */}
      <div className="text-center">
        <Button variant="link" onClick={() => navigate('/pricing')}>
          <Calendar className="h-4 w-4 mr-2" />
          View all plans
        </Button>
      </div>
    </div>
  );
};

export default Billing;
