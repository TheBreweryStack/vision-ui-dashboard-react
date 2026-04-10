import React from 'react';
import { Clock, Crown } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

const TrialCountdown: React.FC = () => {
  const { isTrial, trial_days_remaining } = useSubscription();
  const navigate = useNavigate();

  if (!isTrial || trial_days_remaining === null) {
    return null;
  }

  const isUrgent = trial_days_remaining <= 2;
  const isExpiring = trial_days_remaining <= 1;

  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded-xl border transition-all",
        isExpiring
          ? "bg-loss/10 border-loss/30"
          : isUrgent
          ? "bg-yellow-500/10 border-yellow-500/30"
          : "bg-primary/10 border-primary/30"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center",
            isExpiring
              ? "bg-loss/20"
              : isUrgent
              ? "bg-yellow-500/20"
              : "bg-primary/20"
          )}
        >
          <Clock
            className={cn(
              "h-5 w-5",
              isExpiring
                ? "text-loss"
                : isUrgent
                ? "text-yellow-500"
                : "text-primary"
            )}
          />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            {trial_days_remaining === 0
              ? "Trial expires today!"
              : trial_days_remaining === 1
              ? "1 day left in your trial"
              : `${trial_days_remaining} days left in your trial`}
          </p>
          <p className="text-xs text-muted-foreground">
            {isExpiring
              ? "Upgrade now to keep premium features"
              : "Enjoying TraderCafé? Subscribe to continue"}
          </p>
        </div>
      </div>
      <Button
        size="sm"
        onClick={() => navigate('/pricing')}
        className={cn(
          isExpiring
            ? "bg-loss hover:bg-loss/90"
            : isUrgent
            ? "bg-yellow-500 hover:bg-yellow-500/90 text-black"
            : "bg-primary hover:bg-primary/90"
        )}
      >
        <Crown className="h-4 w-4 mr-1" />
        Upgrade
      </Button>
    </div>
  );
};

export default TrialCountdown;
