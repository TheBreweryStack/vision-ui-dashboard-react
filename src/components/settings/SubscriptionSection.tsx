import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CreditCard, Loader2, Sparkles, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

export const SubscriptionSection: React.FC = () => {
  const { profile } = useAuth();
  const [isManagingSubscription, setIsManagingSubscription] = useState(false);

  const handleManageSubscription = async () => {
    setIsManagingSubscription(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');

      if (error) throw error;

      if (data?.action === 'portal' && data?.url) {
        window.open(data.url, '_blank');
      } else if (data?.action) {
        toast.info(data.message || 'No action needed');
        if (data.redirect_url) {
          window.location.href = data.redirect_url;
        }
      } else if (data?.url) {
        window.open(data.url, '_blank');
      } else if (data?.error) {
        toast.error(data.error);
      } else {
        toast.info(data?.message || 'No subscription to manage');
      }
    } catch (error: unknown) {
      logger.error('Customer portal error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to open subscription manager');
    } finally {
      setIsManagingSubscription(false);
    }
  };

  const planStatus = profile?.plan_status || 'free';
  const isComped = profile?.comped_access || false;
  const showManageButton = planStatus === 'monthly' && profile?.stripe_customer_id;
  const showUpgradeButton = planStatus === 'free' || planStatus === 'expired' || planStatus === 'trial';

  return (
    <div className="content-card">
      <div className="flex items-center gap-3 mb-6">
        <div className="icon-box-primary">
          <CreditCard className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Subscription</h2>
          <p className="text-sm text-muted-foreground">Manage your billing and subscription</p>
        </div>
      </div>

      {planStatus === 'lifetime' ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Crown className="h-4 w-4 text-amber-500" />
          Lifetime access — no subscription to manage
        </div>
      ) : isComped ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            Comped access — no billing to manage
          </div>
          <Link to="/pricing">
            <Button variant="outline" size="sm" className="btn-glass border-border">
              Upgrade anyway
            </Button>
          </Link>
        </div>
      ) : showManageButton ? (
        <Button
          variant="outline"
          onClick={handleManageSubscription}
          disabled={isManagingSubscription}
          className="btn-glass border-border"
        >
          {isManagingSubscription ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <CreditCard className="h-4 w-4 mr-2" />
          )}
          Manage Subscription
        </Button>
      ) : showUpgradeButton ? (
        <Link to="/pricing">
          <Button className="bg-primary hover:bg-primary/90">
            <Sparkles className="h-4 w-4 mr-2" />
            Upgrade
          </Button>
        </Link>
      ) : null}
    </div>
  );
};
