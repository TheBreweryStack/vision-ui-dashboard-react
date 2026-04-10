import { useAuth } from '@/contexts/AuthContext';

export interface AccessInfo {
  hasFullAccess: boolean;
  reason: 'admin' | 'owner' | 'paid_plan' | 'comped' | 'limited';
  isAdmin: boolean;
  isOwner: boolean;
  planStatus: string;
  isComped: boolean;
  // Extended fields for gating
  isLoading: boolean;
  isFree: boolean;
  isTrial: boolean;
  canUseImports: boolean;
  canUseEmailIngest: boolean;
  displayPlanName: string;
}

export function useAccessControl(): AccessInfo {
  const { profile, userRole, isAdmin, isLoading: authLoading, isRoleLoading } = useAuth();
  
  const isLoading = authLoading || isRoleLoading;
  const role = userRole?.role || 'user';
  const isOwner = role === 'owner';
  const planStatus = profile?.plan_status || 'free';
  const isComped = profile?.comped_access || false;
  
  // Full access rule:
  // role IN ('owner','admin') OR plan_status IN ('monthly','lifetime') OR comped_access = true
  const hasPaidPlan = ['monthly', 'lifetime'].includes(planStatus);
  const hasAdminRole = isAdmin || isOwner;
  
  const hasFullAccess = hasAdminRole || hasPaidPlan || isComped;
  
  // Convenience booleans
  const isFree = planStatus === 'free' && !hasFullAccess;
  const isTrial = planStatus === 'trial';
  const canUseImports = hasFullAccess;
  const canUseEmailIngest = hasFullAccess;
  
  // Display name for plan badge
  let displayPlanName = 'Free';
  if (isComped) displayPlanName = 'Comped';
  else if (planStatus === 'lifetime') displayPlanName = 'Lifetime';
  else if (planStatus === 'monthly') displayPlanName = 'Monthly';
  else if (planStatus === 'trial') displayPlanName = 'Trial';
  
  let reason: AccessInfo['reason'] = 'limited';
  if (isOwner) reason = 'owner';
  else if (isAdmin) reason = 'admin';
  else if (hasPaidPlan) reason = 'paid_plan';
  else if (isComped) reason = 'comped';
  
  return {
    hasFullAccess,
    reason,
    isAdmin: isAdmin || isOwner,
    isOwner,
    planStatus,
    isComped,
    isLoading,
    isFree,
    isTrial,
    canUseImports,
    canUseEmailIngest,
    displayPlanName,
  };
}

// Helper function for computing access without hooks (for server-side or edge cases)
export function computeHasFullAccess(
  role: string,
  planStatus: string,
  compedAccess: boolean
): boolean {
  const hasAdminRole = ['owner', 'admin'].includes(role);
  const hasPaidPlan = ['monthly', 'lifetime'].includes(planStatus);
  return hasAdminRole || hasPaidPlan || compedAccess;
}
