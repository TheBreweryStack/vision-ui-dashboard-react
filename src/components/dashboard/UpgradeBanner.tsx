import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Sparkles, X } from 'lucide-react';
import { useState } from 'react';

const UpgradeBanner: React.FC = () => {
  const navigate = useNavigate();
  const { profile, userRole } = useAuth();
  const [isDismissed, setIsDismissed] = useState(false);

  const planStatus = profile?.plan_status || 'free';
  const isComped = profile?.comped_access || false;
  const isGrandfathered = profile?.grandfathered || false;
  const isAdmin = userRole?.role === 'admin' || userRole?.role === 'owner';

  // Don't show banner if user has access or dismissed
  const hasFullAccess = planStatus === 'monthly' || planStatus === 'lifetime' || isComped || isGrandfathered || isAdmin;
  
  if (hasFullAccess || isDismissed) {
    return null;
  }

  // Show banner for free, expired, or trial users
  const showBanner = planStatus === 'free' || planStatus === 'expired' || planStatus === 'trial';
  
  if (!showBanner) {
    return null;
  }

  const getMessage = () => {
    if (planStatus === 'expired') {
      return 'Your subscription has expired. Upgrade to continue accessing premium features.';
    }
    if (planStatus === 'trial') {
      return 'Your trial is active! Upgrade now to lock in your access.';
    }
    return 'Unlock advanced analytics, AI insights, and more with a premium plan.';
  };

  return (
    <div className="relative p-4 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20">
      <button
        onClick={() => setIsDismissed(true)}
        className="absolute top-2 right-2 p-1 rounded-lg hover:bg-primary/10 transition-colors"
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </button>
      
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="p-2 rounded-lg bg-primary/20">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">
              {planStatus === 'expired' ? 'Subscription Expired' : 'Upgrade to Premium'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {getMessage()}
            </p>
          </div>
        </div>
        
        <Button
          onClick={() => navigate('/pricing')}
          size="sm"
          className="bg-primary hover:bg-primary/90 shrink-0"
        >
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          {planStatus === 'expired' ? 'Reactivate' : 'Upgrade Now'}
        </Button>
      </div>
    </div>
  );
};

export default UpgradeBanner;
