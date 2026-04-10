import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Crown, Sparkles, Coffee, AlertCircle, Star, Shield, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlanBadgeProps {
  planStatus?: string;
  compedAccess?: boolean;
  earlySupporter?: boolean;
  className?: string;
  showAll?: boolean; // Show all applicable badges (max 2)
}

interface RoleBadgeProps {
  role?: string;
  className?: string;
}

const planConfig: Record<string, { label: string; style: string; icon?: React.ElementType }> = {
  trial: {
    label: 'Trial',
    style: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
    icon: Coffee,
  },
  monthly: {
    label: 'Monthly',
    style: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    icon: Coffee,
  },
  lifetime: {
    label: 'Lifetime',
    style: 'bg-primary/10 text-primary border-primary/30',
    icon: Crown,
  },
  expired: {
    label: 'Expired',
    style: 'bg-loss/10 text-loss border-loss/30',
    icon: AlertCircle,
  },
  free: {
    label: 'Free',
    style: 'bg-muted/50 text-muted-foreground border-border/50',
    icon: undefined,
  },
};

const specialBadges = {
  comped: {
    label: 'Comped',
    style: 'bg-profit/10 text-profit border-profit/30',
    icon: Sparkles,
  },
  earlySupporter: {
    label: 'Early Supporter',
    style: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
    icon: Star,
  },
};

const roleConfig: Record<string, { label: string; style: string; icon?: React.ElementType }> = {
  owner: {
    label: 'Owner',
    style: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
    icon: Crown,
  },
  admin: {
    label: 'Admin',
    style: 'bg-profit/10 text-profit border-profit/30',
    icon: Shield,
  },
  moderator: {
    label: 'Moderator',
    style: 'bg-primary/10 text-primary border-primary/30',
    icon: Users,
  },
  user: {
    label: 'User',
    style: 'bg-muted/50 text-muted-foreground border-border/50',
    icon: undefined,
  },
};

export const PlanBadge: React.FC<PlanBadgeProps> = ({
  planStatus = 'free',
  compedAccess = false,
  earlySupporter = false,
  className,
  showAll = false,
}) => {
  const badges: Array<{ label: string; style: string; icon?: React.ElementType }> = [];

  // Priority 1: If comped_access=true → show "Comped"
  if (compedAccess) {
    badges.push(specialBadges.comped);
  } else {
    // Priority 2: Show plan_status badge
    const planBadge = planConfig[planStatus] || planConfig.free;
    badges.push(planBadge);
  }

  // Priority 3: If early_supporter=true AND lifetime → also show "Early Supporter"
  if (showAll && earlySupporter && planStatus === 'lifetime') {
    badges.push(specialBadges.earlySupporter);
  }

  // Limit to max 2 badges
  const visibleBadges = badges.slice(0, 2);

  return (
    <div className={cn('flex items-center gap-1.5 flex-wrap', className)}>
      {visibleBadges.map((badge, index) => {
        const Icon = badge.icon;
        return (
          <Badge
            key={index}
            variant="outline"
            className={cn('text-xs font-medium', badge.style)}
          >
            {Icon && <Icon className="h-3 w-3 mr-1" />}
            {badge.label}
          </Badge>
        );
      })}
    </div>
  );
};

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role = 'user', className }) => {
  const config = roleConfig[role] || roleConfig.user;
  const Icon = config.icon;

  // Don't show badge for regular users (only admin, owner, moderator)
  if (role === 'user') {
    return null;
  }

  return (
    <Badge
      variant="outline"
      className={cn('text-xs font-medium', config.style, className)}
    >
      {Icon && <Icon className="h-3 w-3 mr-1" />}
      {config.label}
    </Badge>
  );
};

// Combined badge display for user management
interface UserBadgesProps {
  planStatus?: string;
  compedAccess?: boolean;
  earlySupporter?: boolean;
  role?: string;
  showRole?: boolean;
  className?: string;
}

export const UserBadges: React.FC<UserBadgesProps> = ({
  planStatus,
  compedAccess,
  earlySupporter,
  role,
  showRole = false,
  className,
}) => {
  return (
    <div className={cn('flex items-center gap-1.5 flex-wrap', className)}>
      {showRole && role && <RoleBadge role={role} />}
      <PlanBadge
        planStatus={planStatus}
        compedAccess={compedAccess}
        earlySupporter={earlySupporter}
        showAll
      />
    </div>
  );
};

export default PlanBadge;
